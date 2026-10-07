import '../models/campaign.dart';

/// 12500 → "12.500"
String tl(num n) {
  final s = n.round().toString();
  final buf = StringBuffer();
  for (var i = 0; i < s.length; i++) {
    if (i > 0 && (s.length - i) % 3 == 0) buf.write('.');
    buf.write(s[i]);
  }
  return buf.toString();
}

const _months = [
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık',
];

String dayMonth(DateTime d) => '${d.day} ${_months[d.month - 1]}';

String dateRange(Campaign c) {
  final s = c.startDate, e = c.endDate;
  if (s == null && e == null) return 'Tarih belirtilmemiş';
  if (s == null) return '${dayMonth(e!)} tarihine kadar';
  if (e == null) return '${dayMonth(s)} tarihinden itibaren';
  return '${dayMonth(s)} – ${dayMonth(e)}';
}

String? daysLeftText(Campaign c) {
  final d = c.daysLeft;
  if (d == null) return null;
  if (d <= 0) return 'Bugün bitiyor';
  if (d == 1) return 'Yarın bitiyor';
  return '$d gün kaldı';
}

/// Kartta görünen kısa kazanç: "400 TL puan", "%20 indirim", "+3 taksit"
String benefitHeadline(Benefit b) {
  final parts = <String>[];
  final t = b.types;
  if (t.contains(BenefitType.puan)) {
    parts.add(b.amount != null ? '${tl(b.amount!)} TL puan' : 'Puan');
  }
  if (t.contains(BenefitType.indirim)) {
    if (b.percent != null) {
      parts.add('%${b.percent} indirim');
    } else if (b.amount != null && !t.contains(BenefitType.puan)) {
      parts.add('${tl(b.amount!)} TL indirim');
    } else {
      parts.add('İndirim');
    }
  }
  if (t.contains(BenefitType.nakit)) {
    if (b.percent != null && !t.contains(BenefitType.indirim)) {
      parts.add('%${b.percent} iade');
    } else if (b.amount != null && !t.contains(BenefitType.puan)) {
      parts.add('${tl(b.amount!)} TL iade');
    } else {
      parts.add('Nakit iade');
    }
  }
  if (t.contains(BenefitType.taksit)) {
    parts.add(b.installments != null ? '${b.installments} taksit' : 'Taksit');
  }
  if (parts.isEmpty) return 'Detaylar bankada';
  return parts.join(' + ');
}

String? minSpendText(Benefit b) =>
    b.minSpend != null ? '${tl(b.minSpend!)} TL ve üzeri harcamada' : null;

String joinLabel(JoinMethod? j) => switch (j) {
      JoinMethod.app => 'Uygulamadan katıl',
      JoinMethod.sms => 'SMS ile katıl',
      JoinMethod.auto => 'Katılım gerekmez',
      null => 'Katılım şekli bankada',
    };

String benefitTypeLabel(BenefitType t) => switch (t) {
      BenefitType.puan => 'Puan',
      BenefitType.indirim => 'İndirim',
      BenefitType.nakit => 'Nakit iade',
      BenefitType.taksit => 'Taksit',
    };
