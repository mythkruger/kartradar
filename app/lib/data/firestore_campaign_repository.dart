import 'dart:convert';

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../models/campaign.dart';
import 'campaign_repository.dart';

/*
 * KAMPANYALAR FIRESTORE'DAN (scraper'ın yazdığı yapı, scraper/src/services/firestoreService.ts)
 *
 *   meta/programIndex           { programs: { bonus: { hash, count, ... }, ... } }
 *   programCampaigns/{program}  { hash, campaigns: [...] }   (özetsiz)
 *   campaignDetails/{campaign}  { summary }                  (detay açılınca)
 *
 * Okuma tasarrufu:
 *  1. Index en fazla 15 dakikada bir sunucudan okunur (1 okuma). Arada telefonun önbelleği.
 *     Kullanıcı listeyi aşağı çekerse hemen okunur.
 *  2. Bir kartın hash'i son indirdiğimizle aynıysa belge telefonun önbelleğinden gelir (0 okuma).
 *     Firestore'un kendi çevrimdışı önbelleği kullanılıyor; önbellekte yoksa sunucudan okunur.
 *  3. Özet: önce önbellek, yoksa sunucu. Aynı kampanya ikinci kez açılınca okuma yok.
 *
 * Örnek: kullanıcı günde 5 kez açıyor, 3 kartı var, veri günde 2 kez değişiyor
 *   → günde ~5 index + en fazla 6 kart okuması.
 *
 * "Yeni" rozeti: Firestore'da firstSeenAt yok. Telefon her kartta gördüğü kampanyaları hatırlar,
 * ilk kez gördüğüne bugünün tarihini yazar.
 */
class FirestoreCampaignRepository implements CampaignRepository {
  FirestoreCampaignRepository({FirebaseFirestore? db, this.beforeRead})
      : _db = db ?? FirebaseFirestore.instance;

  final FirebaseFirestore _db;

  /// Okumadan önce çalışır (anonim girişin bitmesini beklemek için: kurallar giriş istiyor)
  final Future<void> Function()? beforeRead;

  static const indexMaxAge = Duration(minutes: 15);
  static const _prefIndexAt = 'fs.indexAt';
  static String _prefHash(String id) => 'fs.hash.$id';
  static String _prefSeen(String id) => 'fs.seen.$id';

  DocumentReference<Map<String, dynamic>> get _indexDoc => _db.collection('meta').doc('programIndex');

  @override
  Future<List<Campaign>> fetch(Set<String> programIds, {bool force = false}) async {
    await beforeRead?.call();
    final prefs = await SharedPreferences.getInstance();

    final programsIndex = await _readIndex(prefs, force);

    final results = await Future.wait([
      for (final id in programIds)
        if (programsIndex.containsKey(id)) _readProgram(prefs, id, programsIndex[id]),
    ]);
    return [for (final list in results) ...list];
  }

  /// programId → index kaydı
  Future<Map<String, dynamic>> _readIndex(SharedPreferences prefs, bool force) async {
    final last = prefs.getInt(_prefIndexAt) ?? 0;
    final fresh = DateTime.now().millisecondsSinceEpoch - last < indexMaxAge.inMilliseconds;

    DocumentSnapshot<Map<String, dynamic>>? snap;
    if (fresh && !force) {
      snap = await _tryCache(_indexDoc);
    }
    if (snap == null) {
      // Sunucu; internet yoksa Firestore kendisi önbelleğe düşer
      snap = await _indexDoc.get();
      if (!snap.metadata.isFromCache) {
        await prefs.setInt(_prefIndexAt, DateTime.now().millisecondsSinceEpoch);
      }
    }
    final programs = snap.data()?['programs'];
    return programs is Map ? Map<String, dynamic>.from(programs) : {};
  }

  Future<List<Campaign>> _readProgram(SharedPreferences prefs, String id, Object? indexEntry) async {
    final hash = indexEntry is Map ? indexEntry['hash'] as String? : null;
    final doc = _db.collection('programCampaigns').doc(id);

    DocumentSnapshot<Map<String, dynamic>>? snap;
    // Hash değişmediyse telefondaki kopya güncel
    if (hash != null && prefs.getString(_prefHash(id)) == hash) {
      snap = await _tryCache(doc);
      if (snap != null && snap.data()?['hash'] != hash) snap = null;
    }
    snap ??= await doc.get();
    final data = snap.data();
    if (data == null) return const [];
    if (data['hash'] is String) await prefs.setString(_prefHash(id), data['hash'] as String);

    final raw = (data['campaigns'] as List? ?? const [])
        .whereType<Map>()
        .map((m) => Map<String, dynamic>.from(m))
        .toList();
    final firstSeen = await _firstSeen(prefs, id, raw.map((m) => m['id'] as String? ?? ''));

    final out = <Campaign>[];
    for (final m in raw) {
      try {
        out.add(Campaign.fromJson({...m, 'firstSeenAt': firstSeen[m['id']]}, programId: id));
      } catch (_) {
        // Bozuk tek kayıt listeyi düşürmesin
      }
    }
    return out;
  }

  /// Kampanyayı ilk gördüğümüz gün. Kartı ilk kez yüklüyorsak hepsi "eski" sayılır.
  Future<Map<String, String?>> _firstSeen(SharedPreferences prefs, String programId, Iterable<String> ids) async {
    final stored = prefs.getString(_prefSeen(programId));
    final known = stored == null ? null : Map<String, String>.from(jsonDecode(stored) as Map);
    final today = DateTime.now().toIso8601String().substring(0, 10);
    final next = <String, String>{};
    for (final id in ids) {
      if (id.isEmpty) continue;
      next[id] = known?[id] ?? (known == null ? '2000-01-01' : today);
    }
    await prefs.setString(_prefSeen(programId), jsonEncode(next)); // kalkanlar da düşer
    return next;
  }

  @override
  Future<String?> summary(Campaign campaign) async {
    await beforeRead?.call();
    final doc = _db.collection('campaignDetails').doc(campaign.id);
    final snap = await _tryCache(doc) ?? await doc.get();
    return snap.data()?['summary'] as String?;
  }

  /// Önbellekte varsa döner, yoksa null (okuma sayılmaz)
  static Future<DocumentSnapshot<Map<String, dynamic>>?> _tryCache(
      DocumentReference<Map<String, dynamic>> doc) async {
    try {
      final snap = await doc.get(const GetOptions(source: Source.cache));
      return snap.exists ? snap : null;
    } catch (_) {
      return null;
    }
  }
}
