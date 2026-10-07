import 'dart:convert';

import 'package:http/http.dart' as http;

import '../models/campaign.dart';

/*
 * VERİ KAYNAĞI
 * Uygulamanın geri kalanı sadece bu arayüzü bilir.
 *   FirestoreCampaignRepository (firestore_campaign_repository.dart) → gerçek kullanım
 *   ApiCampaignRepository → geliştirme: bilgisayardaki admin sunucusu
 *     (flutter run --dart-define=USE_API=true)
 */
abstract class CampaignRepository {
  /// Sadece seçili programların güncel kampanyaları (listede özet YOK).
  /// [force]: kullanıcı listeyi aşağı çekip yeniledi → kısa süreli önbelleği atla.
  Future<List<Campaign>> fetch(Set<String> programIds, {bool force = false});

  /// Kampanyanın özeti. Firestore'da ayrı küçük belgede durur; sadece detay açılınca okunur
  /// (listeyi küçük tutmak = kullanıcı başına indirilen veri yarıya iner).
  Future<String?> summary(Campaign campaign);
}

/// Geliştirme: `npm run dev` ile açılan admin sunucusu.
/// Android emülatöründe bilgisayarın localhost'u = 10.0.2.2
/// Gerçek telefonda: flutter run --dart-define=API_BASE=http://BILGISAYAR_IP:3000
class ApiCampaignRepository implements CampaignRepository {
  ApiCampaignRepository({String? baseUrl})
      : baseUrl = baseUrl ??
            const String.fromEnvironment('API_BASE', defaultValue: 'http://10.0.2.2:3000');

  final String baseUrl;

  @override
  Future<List<Campaign>> fetch(Set<String> programIds, {bool force = false}) async {
    final res = await http
        .get(Uri.parse('$baseUrl/api/campaigns'))
        .timeout(const Duration(seconds: 10));
    if (res.statusCode != 200) {
      throw Exception('Sunucu ${res.statusCode} döndü');
    }
    final list = jsonDecode(utf8.decode(res.bodyBytes)) as List;
    return list
        .cast<Map<String, dynamic>>()
        .where((j) => programIds.contains(j['programId']))
        .map(Campaign.fromJson)
        .toList();
  }

  /// Admin sunucusu özeti zaten listede veriyor; Firestore sürümünde
  /// campaignDetails/{id} belgesi okunacak.
  @override
  Future<String?> summary(Campaign campaign) async => campaign.summary;
}
