import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../firebase_options.dart';
import 'push_service.dart';

/*
 * GERÇEK BİLDİRİMLER (Firebase Cloud Messaging)
 *
 * Scraper o saatin konusuna (yeni_1230 / yeni_1930) sessiz bir mesaj gönderir:
 *   { type: "yeni", day, slot, counts: '{"axess":3,"world":1}' }
 * Telefon mesajı alınca (uygulama açık da olsa kapalı da olsa) kullanıcının kartlarını
 * telefondan okur ve sadece onları içeren TEK bildirim gösterir. Kartlarında yeni yoksa bildirim yok.
 * Bildirime dokununca uygulama açılır, liste zaten yenidir.
 */

const _channel = AndroidNotificationChannel(
  'yeni_kampanya',
  'Yeni kampanyalar',
  description: 'Kartlarına gelen yeni kampanyalar (günde en fazla bir kez)',
);

final _local = FlutterLocalNotificationsPlugin();
bool _localReady = false;

Future<void> _initLocal() async {
  if (_localReady) return;
  await _local.initialize(
    settings: const InitializationSettings(
      android: AndroidInitializationSettings('@mipmap/ic_launcher'),
      // İzni biz istiyoruz (bildirim ayarı açılınca), açılışta sormasın
      iOS: DarwinInitializationSettings(
        requestAlertPermission: false,
        requestBadgePermission: false,
        requestSoundPermission: false,
      ),
    ),
  );
  await _local
      .resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>()
      ?.createNotificationChannel(_channel);
  _localReady = true;
}

/// Gelen mesajdan bildirim göster (ön planda ve arka planda aynı fonksiyon)
Future<void> showNewCampaigns(RemoteMessage message) async {
  if (message.data['type'] != 'yeni') return;

  final prefs = await SharedPreferences.getInstance();
  await prefs.reload(); // arka plan işleminde en güncel kart listesini gör
  if (prefs.getBool('notif.enabled') == false) return;
  final mine = (prefs.getStringList('myPrograms') ?? const <String>[]).toSet();

  final msg = newCampaignsMessage(message.data['counts'] as String?, mine);
  if (msg == null) return; // kullanıcının kartlarında yeni yok

  // Aynı mesaj iki kez gelirse tek bildirim
  final stamp = '${message.data['day']}_${message.data['slot']}';
  if (prefs.getString('notif.lastShown') == stamp) return;
  await prefs.setString('notif.lastShown', stamp);

  await _initLocal();
  await _local.show(
    id: 1, // hep aynı ID: yeni bildirim eskisinin yerine geçer, yığılma olmaz
    title: msg.title,
    body: msg.body,
    notificationDetails: NotificationDetails(
      android: AndroidNotificationDetails(
        _channel.id,
        _channel.name,
        channelDescription: _channel.description,
        styleInformation: BigTextStyleInformation(msg.body),
      ),
      iOS: const DarwinNotificationDetails(),
    ),
  );
}

/// Uygulama kapalıyken gelen mesaj. Ayrı bir arka plan işleminde çalışır.
@pragma('vm:entry-point')
Future<void> firebaseBackgroundHandler(RemoteMessage message) async {
  await Firebase.initializeApp(options: DefaultFirebaseOptions.currentPlatform);
  await showNewCampaigns(message);
}

class FcmPushService implements PushService {
  /// main() içinde, Firebase.initializeApp'ten hemen sonra bir kez
  static Future<void> setup() async {
    FirebaseMessaging.onBackgroundMessage(firebaseBackgroundHandler);
    FirebaseMessaging.onMessage.listen(showNewCampaigns); // uygulama açıkken
    await _initLocal();
  }

  @override
  Future<bool> requestPermission() async {
    final settings = await FirebaseMessaging.instance.requestPermission();
    return settings.authorizationStatus == AuthorizationStatus.authorized ||
        settings.authorizationStatus == AuthorizationStatus.provisional;
  }

  @override
  Future<void> subscribe(String topic) => FirebaseMessaging.instance.subscribeToTopic(topic);

  @override
  Future<void> unsubscribe(String topic) => FirebaseMessaging.instance.unsubscribeFromTopic(topic);
}
