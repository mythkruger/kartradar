import 'dart:convert';

import 'package:flutter/foundation.dart';

import '../models/programs.dart';

/*
 * Bildirim altyapısı (FCM konuları).
 *
 * Uygulama Firestore'a cihaz / token yazmaz. Seçtiği saatin konusuna abone olur:
 * yeni_1230 ya da yeni_1930. Scraper (scraper/src/services/notifyService.ts) o saatte
 * bu konuya TEK sessiz mesaj gönderir: hangi kartta kaç yeni kampanya var.
 * Telefon kullanıcının kendi kartlarını süzüp tek bildirim gösterir (newCampaignsMessage).
 *
 * Gerçek gönderim: FcmPushService (fcm_push_service.dart). NoopPushService testler / Firebase'siz deneme için.
 */
abstract class PushService {
  /// Bildirim izni (Android 13+, iOS). Kullanıcı reddederse false.
  Future<bool> requestPermission();

  Future<void> subscribe(String topic);

  Future<void> unsubscribe(String topic);
}

class NoopPushService implements PushService {
  @override
  Future<bool> requestPermission() async => true;

  @override
  Future<void> subscribe(String topic) async => debugPrint('[push] abone (taslak): $topic');

  @override
  Future<void> unsubscribe(String topic) async => debugPrint('[push] abonelik bitti (taslak): $topic');
}

/// Bildirim saatleri. Değerler scraper'daki SLOTS ile aynı olmalı.
enum NotifySlot {
  noon('1230', 'Öğle 12:30', 'Öğle arasında göz at'),
  evening('1930', 'Akşam 19:30', 'İşten sonra, alışveriş saatinde');

  const NotifySlot(this.code, this.label, this.hint);

  final String code;
  final String label;
  final String hint;

  static NotifySlot fromCode(String? code) =>
      NotifySlot.values.firstWhere((s) => s.code == code, orElse: () => NotifySlot.evening);
}

String topicFor(NotifySlot slot) => 'yeni_${slot.code}';

/// Olması gereken konular: bildirim açıksa seçili saatin konusu (tek konu).
Set<String> desiredTopics({required bool enabled, required NotifySlot slot}) =>
    enabled ? {topicFor(slot)} : <String>{};

/// Gelen mesajdan kullanıcının kartlarına göre TEK bildirim metni.
/// [countsJson]: '{"axess":3,"world":1}'. Kullanıcının kartlarında yeni yoksa null (bildirim yok).
({String title, String body})? newCampaignsMessage(String? countsJson, Set<String> myPrograms) {
  if (countsJson == null || myPrograms.isEmpty) return null;
  Map<String, dynamic> counts;
  try {
    counts = Map<String, dynamic>.from(jsonDecode(countsJson) as Map);
  } catch (_) {
    return null;
  }
  final mine = [
    for (final e in counts.entries)
      if (myPrograms.contains(e.key) && e.value is num && (e.value as num) > 0) (programById(e.key).name, (e.value as num).toInt()),
  ]..sort((a, b) => b.$2.compareTo(a.$2));
  if (mine.isEmpty) return null;
  final parts = mine.map((m) => '${m.$1}: ${m.$2}').join(' · ');
  return (title: 'KartRadar', body: 'Yeni kampanyalar radarımıza takıldı! $parts');
}
