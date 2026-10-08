import 'dart:async';

import 'package:firebase_auth/firebase_auth.dart' show User;
import 'package:flutter/widgets.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../auth/auth_service.dart';
import '../data/campaign_repository.dart';
import '../data/card_store.dart';
import '../data/notification_store.dart';
import '../data/user_cards_sync.dart';
import '../models/campaign.dart';
import '../push/push_service.dart';

/*
 * Uygulamanın tek durumu: seçili kartlar, kampanyalar, filtreler.
 * Filtreleme tamamen telefonda yapılır → Firestore'a ek okuma yok.
 */
class AppState extends ChangeNotifier {
  AppState({
    required this.repository,
    required this.cardStore,
    PushService? push,
    NotificationStore? notificationStore,
    this.auth,
    this.userCards,
  })  : push = push ?? NoopPushService(),
        notificationStore = notificationStore ?? NotificationStore();

  final CampaignRepository repository;
  final CardStore cardStore;
  final PushService push;
  final NotificationStore notificationStore;

  /// Firebase bağlı değilse null (giriş özellikleri gizlenir)
  final AuthService? auth;
  final UserCardsSync? userCards;

  // ---------- Hesap ----------

  User? user;
  StreamSubscription<User?>? _authSub;
  String? _cardsSyncedFor;

  /// Gerçek hesapla girmiş mi (anonim değil)
  bool get signedIn => user != null && !user!.isAnonymous;

  /// Girişten hemen sonra hesaptaki kartlar okunurken true (ekran kart seçimine atlamasın)
  bool syncingCards = false;

  // Yeni kampanya bildirimleri
  bool notifyEnabled = false;
  NotifySlot notifySlot = NotifySlot.evening;
  Set<String> _subscribedTopics = {};

  Set<String> myPrograms = {};
  bool ready = false;

  /// İlk açılış tanıtımı görüldü mü (telefonda tutulur)
  bool introSeen = true;

  List<Campaign> campaigns = [];
  bool loading = false;
  String? error;

  // Filtreler
  String query = '';
  String? sector;
  final Set<BenefitType> benefitTypes = {};
  JoinMethod? join;

  /// Ana sayfadaki kart çipleri: bugün hangi kartlarımı görmek istiyorum?
  /// Boş = hepsi. Sadece bu oturumda geçerli (uygulama kapanınca tüm kartlar).
  final Set<String> shownPrograms = {};

  Future<void> init() async {
    myPrograms = await cardStore.load();
    final n = await notificationStore.load();
    notifyEnabled = n.enabled;
    notifySlot = n.slot;
    _subscribedTopics = {...n.subscribed};
    introSeen = (await SharedPreferences.getInstance()).getBool(_introKey) ?? false;
    // Telefonda kayıtlı oturumu bekle: giriş ekranı bir an görünüp kaybolmasın
    await auth?.ready();
    user = auth?.user;
    ready = true;
    notifyListeners();
    _authSub ??= auth?.changes.listen(_onUser);
    // Yarım kalan abonelik varsa tamamla (arka planda, açılışı bekletmez)
    _syncTopics();
    if (myPrograms.isNotEmpty) await refresh();
  }

  static const _introKey = 'intro.seen';

  Future<void> markIntroSeen() async {
    introSeen = true;
    notifyListeners();
    await (await SharedPreferences.getInstance()).setBool(_introKey, true);
  }

  Future<void> setPrograms(Set<String> ids) async {
    myPrograms = {...ids};
    shownPrograms.removeWhere((id) => !myPrograms.contains(id));
    await cardStore.save(myPrograms);
    notifyListeners();
    _pushCards();
    await refresh();
  }

  void _onUser(User? u) {
    final wasSignedIn = signedIn;
    user = u;
    if (signedIn) {
      if (_cardsSyncedFor != u!.uid) {
        syncingCards = myPrograms.isEmpty; // kartı yoksa hesabından gelmesini bekle
        _pullCards(u.uid).whenComplete(() {
          syncingCards = false;
          notifyListeners();
          refresh(); // girişten önce okuma yapılamıyordu (kurallar giriş ister)
        });
      }
    } else {
      _cardsSyncedFor = null;
      if (wasSignedIn) _clearLocal(); // çıkış / hesap silme: sıradaki kişi önceki kartları görmesin
    }
    notifyListeners();
  }

  /// Çıkışta telefondaki kişisel durumu temizle
  Future<void> _clearLocal() async {
    myPrograms = {};
    campaigns = [];
    shownPrograms.clear();
    clearFilters();
    await cardStore.save(myPrograms);
    if (notifyEnabled) await setNotifications(enabled: false);
    notifyListeners();
  }

  /// Girişte: hesaptaki kartlarla telefondakileri birleştir (hiçbir kart kaybolmaz).
  Future<void> _pullCards(String uid) async {
    final sync = userCards;
    if (sync == null) return;
    _cardsSyncedFor = uid;
    try {
      final remote = await sync.load(uid);
      final merged = {...?remote, ...myPrograms};
      if (remote == null || remote.length != merged.length) {
        if (merged.isNotEmpty) await sync.save(uid, merged);
      }
      if (merged.length != myPrograms.length) {
        myPrograms = merged;
        await cardStore.save(myPrograms);
        notifyListeners();
        _syncTopics();
      }
    } catch (_) {
      _cardsSyncedFor = null; // sonraki açılışta tekrar dene
    }
  }

  /// Kart değişince hesaba yaz (giriş yapılmışsa)
  void _pushCards() {
    final u = user;
    if (!signedIn || userCards == null || myPrograms.isEmpty) return;
    userCards!.save(u!.uid, myPrograms).catchError((_) {});
  }

  /// Hesabı sil: önce kart belgesi, sonra hesap. Hesap silinemezse belge geri yazılır.
  Future<void> deleteAccount() async {
    final u = user;
    if (u == null || auth == null) return;
    await userCards?.delete(u.uid);
    try {
      await auth!.deleteAccount();
    } catch (_) {
      if (myPrograms.isNotEmpty) await userCards?.save(u.uid, myPrograms);
      rethrow;
    }
  }

  @override
  void dispose() {
    _authSub?.cancel();
    super.dispose();
  }

  // ---------- Bildirimler ----------

  /// Açarken izin ister. İzin verilmezse false döner ve ayar kapalı kalır.
  Future<bool> setNotifications({required bool enabled, NotifySlot? slot}) async {
    if (enabled && !notifyEnabled) {
      final granted = await push.requestPermission();
      if (!granted) return false;
    }
    notifyEnabled = enabled;
    notifySlot = slot ?? notifySlot;
    await notificationStore.saveSettings(enabled: notifyEnabled, slot: notifySlot);
    notifyListeners();
    await _syncTopics();
    return true;
  }

  Future<void>? _syncing;

  /// Olması gereken konularla abone olunanları eşitle: sadece farkı gönder.
  Future<void> _syncTopics() {
    // Üst üste çağrılırsa sırayla çalışsın
    final previous = (_syncing ?? Future<void>.value()).catchError((_) {});
    final next = previous.then((_) async {
      final want = desiredTopics(enabled: notifyEnabled, slot: notifySlot);
      for (final t in _subscribedTopics.difference(want).toList()) {
        try {
          await push.unsubscribe(t);
          _subscribedTopics.remove(t);
        } catch (_) {/* sonraki açılışta tekrar denenir */}
      }
      for (final t in want.difference(_subscribedTopics).toList()) {
        try {
          await push.subscribe(t);
          _subscribedTopics.add(t);
        } catch (_) {/* sonraki açılışta tekrar denenir */}
      }
      await notificationStore.saveSubscribed(_subscribedTopics);
    });
    _syncing = next;
    return next;
  }

  /// [force]: kullanıcı listeyi aşağı çekti → sunucuya mutlaka sor
  Future<void> refresh({bool force = false}) async {
    if (auth != null && !signedIn) return; // giriş ekranındayken okuma yok
    if (myPrograms.isEmpty) {
      campaigns = [];
      notifyListeners();
      return;
    }
    loading = true;
    error = null;
    notifyListeners();
    try {
      final list = await repository.fetch(myPrograms, force: force);
      // Firestore günde 2 kez güncelleniyor: gece biten kampanyayı telefonda biz gizliyoruz
      list.removeWhere((c) => (c.daysLeft ?? 0) < 0);
      list.sort(_byEndDate);
      campaigns = list;
    } catch (e) {
      debugPrint('[kampanyalar] $e');
      error = e.toString();
    } finally {
      loading = false;
      notifyListeners();
    }
  }

  // ---------- Filtreler ----------

  bool get hasFilters =>
      query.isNotEmpty || sector != null || benefitTypes.isNotEmpty || join != null;

  int get advancedFilterCount =>
      benefitTypes.length + (join != null ? 1 : 0);

  void setQuery(String q) {
    query = q.trim();
    notifyListeners();
  }

  void setSector(String? s) {
    sector = s;
    notifyListeners();
  }

  /// Tek kazanç türü seç (açılır menü). null = hepsi.
  void setBenefit(BenefitType? t) {
    benefitTypes
      ..clear()
      ..addAll([if (t != null) t]);
    notifyListeners();
  }

  void toggleBenefit(BenefitType t) {
    if (!benefitTypes.remove(t)) benefitTypes.add(t);
    notifyListeners();
  }

  void setJoin(JoinMethod? j) {
    join = j;
    notifyListeners();
  }

  // ---------- Kart çipleri ----------

  bool isShown(String id) => shownPrograms.isEmpty || shownPrograms.contains(id);

  /// Çipe dokununca: "hepsi" durumundan sadece o karta geç; sonra ekle/çıkar.
  void toggleShown(String id) {
    if (shownPrograms.isEmpty) {
      shownPrograms.add(id);
    } else if (!shownPrograms.remove(id)) {
      shownPrograms.add(id);
    }
    // Hepsi seçildiyse veya hiçbiri kalmadıysa → "Tüm kartlarım"
    if (shownPrograms.length == myPrograms.length) shownPrograms.clear();
    notifyListeners();
  }

  void showAllPrograms() {
    shownPrograms.clear();
    notifyListeners();
  }

  // ---------- Kartlarım: ekle / çıkar ----------

  Future<void> addProgram(String id) => setPrograms({...myPrograms, id});

  /// Son kart çıkarılamaz (en az bir kart gerekli).
  Future<bool> removeProgram(String id) async {
    if (myPrograms.length <= 1) return false;
    await setPrograms({...myPrograms}..remove(id));
    return true;
  }

  void clearFilters() {
    query = '';
    sector = null;
    benefitTypes.clear();
    join = null;
    notifyListeners();
  }

  List<Campaign> get filtered {
    final q = _fold(query);
    return byCard.where((c) {
      if (sector != null && !c.sectors.contains(sector)) return false;
      if (benefitTypes.isNotEmpty && !c.benefit.types.any(benefitTypes.contains)) return false;
      if (join != null && c.join != join) return false;
      if (q.isNotEmpty) {
        final hay = _fold('${c.title} ${c.merchant ?? ''} ${c.summary ?? ''}');
        if (!hay.contains(q)) return false;
      }
      return true;
    }).toList();
  }

  /// Kart çiplerine göre süzülmüş liste (diğer tüm filtrelerin tabanı).
  /// Aynı kampanya iki kartta birden olabilir (ör. Bankkart ve Bankkart Genç):
  /// aynı bağlantıyı bir kez gösteriyoruz.
  List<Campaign> get byCard {
    final seen = <String>{};
    return campaigns
        .where((c) => shownPrograms.isEmpty || shownPrograms.contains(c.programId))
        .where((c) => seen.add(c.url))
        .toList();
  }

  /// Bitmesine 3 gün veya daha az kalanlar
  List<Campaign> get endingSoon => byCard.where((c) => c.isEndingSoon).toList();

  int countFor(String programId) => campaigns.where((c) => c.programId == programId).length;

  /// Sektör çipleri: sadece listede olan sektörler, en kalabalık önce
  List<MapEntry<String, int>> get sectorCounts {
    final counts = <String, int>{};
    for (final c in byCard) {
      for (final s in c.sectors) {
        counts[s] = (counts[s] ?? 0) + 1;
      }
    }
    final list = counts.entries.toList()..sort((a, b) => b.value.compareTo(a.value));
    return list;
  }
}

int _byEndDate(Campaign a, Campaign b) {
  final ae = a.endDate, be = b.endDate;
  if (ae == null && be == null) return 0;
  if (ae == null) return 1;
  if (be == null) return -1;
  return ae.compareTo(be);
}

String _fold(String s) => s
    .toLowerCase()
    .replaceAll('ı', 'i')
    .replaceAll('İ', 'i')
    .replaceAll('i̇', 'i')
    .replaceAll('ş', 's')
    .replaceAll('ğ', 'g')
    .replaceAll('ü', 'u')
    .replaceAll('ö', 'o')
    .replaceAll('ç', 'c');

/// Ağaçta AppState'e erişim (ör. detay sayfası özet için repository'yi kullanır)
class AppScope extends InheritedWidget {
  const AppScope({super.key, required this.state, required super.child});

  final AppState state;

  static AppState of(BuildContext context) =>
      context.dependOnInheritedWidgetOfExactType<AppScope>()!.state;

  @override
  bool updateShouldNotify(AppScope oldWidget) => oldWidget.state != state;
}
