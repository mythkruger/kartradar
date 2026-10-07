import 'package:flutter_test/flutter_test.dart';
import 'package:kartradar/models/campaign.dart';
import 'package:kartradar/push/push_service.dart';
import 'package:kartradar/ui/format.dart';

void main() {
  test('TL biçimi', () {
    expect(tl(400), '400');
    expect(tl(12500), '12.500');
    expect(tl(1000000), '1.000.000');
  });

  test('Kazanç başlığı', () {
    expect(benefitHeadline(const Benefit(types: [BenefitType.puan], amount: 400)), '400 TL puan');
    expect(benefitHeadline(const Benefit(types: [BenefitType.indirim], percent: 20)), '%20 indirim');
    expect(
      benefitHeadline(const Benefit(types: [BenefitType.puan, BenefitType.taksit], amount: 350, installments: 3)),
      '350 TL puan + 3 taksit',
    );
    expect(benefitHeadline(const Benefit()), 'Detaylar bankada');
  });

  test('JSON → Campaign', () {
    final c = Campaign.fromJson({
      'id': 'bonus-x',
      'programId': 'bonus',
      'title': 'Test',
      'url': 'https://example.com',
      'endDate': '2099-01-01',
      'sectors': ['market'],
      'benefit': {'types': ['puan'], 'amount': 100, 'minSpend': 1000},
      'join': 'app',
    });
    expect(c.programId, 'bonus');
    expect(c.join, JoinMethod.app);
    expect(c.benefit.minSpend, 1000);
    expect(c.isEndingSoon, false);
  });

  test('Bildirim konusu ve tek bildirim metni', () {
    expect(topicFor(NotifySlot.noon), 'yeni_1230');
    expect(desiredTopics(enabled: true, slot: NotifySlot.evening), {'yeni_1930'});
    expect(desiredTopics(enabled: false, slot: NotifySlot.evening), isEmpty);
    expect(NotifySlot.fromCode('1230'), NotifySlot.noon);
    expect(NotifySlot.fromCode(null), NotifySlot.evening);

    const counts = '{"world":1,"axess":3,"bonus":2}';
    final m = newCampaignsMessage(counts, {'axess', 'world', 'paraf'});
    expect(m?.title, 'KartRadar');
    expect(m?.body, 'Yeni kampanyalar radarımıza takıldı! Axess: 3 · World: 1');
    expect(newCampaignsMessage(counts, {'paraf'}), isNull); // kartlarında yeni yok → bildirim yok
    expect(newCampaignsMessage('bozuk', {'axess'}), isNull);
  });
}
