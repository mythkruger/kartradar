import 'package:shared_preferences/shared_preferences.dart';

import '../push/push_service.dart';

/*
 * Bildirim ayarları SADECE telefonda tutulur (kart seçimi gibi).
 * subscribed: şu an abone olunan konular. Uygulama her açılışta olması gerekenle
 * karşılaştırır, sadece farkı abone eder / çıkarır (internet yoksa sonraki açılışta tamamlanır).
 */
class NotificationSettings {
  final bool enabled;
  final NotifySlot slot;
  final Set<String> subscribed;

  const NotificationSettings({this.enabled = false, this.slot = NotifySlot.evening, this.subscribed = const {}});
}

class NotificationStore {
  static const _enabled = 'notif.enabled';
  static const _slot = 'notif.slot';
  static const _subscribed = 'notif.subscribed';

  Future<NotificationSettings> load() async {
    final prefs = await SharedPreferences.getInstance();
    return NotificationSettings(
      enabled: prefs.getBool(_enabled) ?? false,
      slot: NotifySlot.fromCode(prefs.getString(_slot)),
      subscribed: (prefs.getStringList(_subscribed) ?? const []).toSet(),
    );
  }

  Future<void> saveSettings({required bool enabled, required NotifySlot slot}) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_enabled, enabled);
    await prefs.setString(_slot, slot.code);
  }

  Future<void> saveSubscribed(Set<String> topics) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setStringList(_subscribed, topics.toList()..sort());
  }
}
