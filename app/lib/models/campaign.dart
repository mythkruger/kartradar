/*
 * Kampanya modeli. Alanlar ../docs/veri-yapisi.md ile birebir aynı.
 * Scraper'ın yazdığı JSON'u (admin API veya Firestore) buraya çeviriyoruz.
 */

enum BenefitType { puan, indirim, nakit, taksit }

enum JoinMethod { app, sms, auto }

class Benefit {
  final List<BenefitType> types;
  final num? amount;
  final num? percent;
  final int? installments;
  final num? minSpend;

  const Benefit({
    this.types = const [],
    this.amount,
    this.percent,
    this.installments,
    this.minSpend,
  });

  bool get isEmpty =>
      types.isEmpty && amount == null && percent == null && installments == null;

  factory Benefit.fromJson(Map<String, dynamic>? json) {
    if (json == null) return const Benefit();
    final types = <BenefitType>[];
    for (final t in (json['types'] as List? ?? const [])) {
      for (final v in BenefitType.values) {
        if (v.name == t) types.add(v);
      }
    }
    return Benefit(
      types: types,
      amount: json['amount'] as num?,
      percent: json['percent'] as num?,
      installments: (json['installments'] as num?)?.toInt(),
      minSpend: json['minSpend'] as num?,
    );
  }
}

class Campaign {
  final String id;
  final String programId;
  final String title;
  final String? summary;
  final String? imageUrl;
  final String url;
  final DateTime? startDate;
  final DateTime? endDate;
  final List<String> sectors;
  final String? merchant;
  final Benefit benefit;
  final JoinMethod? join;
  final DateTime? firstSeenAt;

  const Campaign({
    required this.id,
    required this.programId,
    required this.title,
    required this.url,
    this.summary,
    this.imageUrl,
    this.startDate,
    this.endDate,
    this.sectors = const ['diger'],
    this.merchant,
    this.benefit = const Benefit(),
    this.join,
    this.firstSeenAt,
  });

  /// [programId] Firestore belgesinden okurken dışarıdan verilir
  /// (dizideki kampanyalarda programId alanı yok, belgenin kendisinde var).
  factory Campaign.fromJson(Map<String, dynamic> json, {String? programId}) {
    JoinMethod? join;
    for (final v in JoinMethod.values) {
      if (v.name == json['join']) join = v;
    }
    final sectors = (json['sectors'] as List? ?? const []).cast<String>();
    return Campaign(
      id: json['id'] as String,
      programId: programId ?? json['programId'] as String,
      title: (json['title'] as String?)?.trim() ?? '',
      summary: json['summary'] as String?,
      imageUrl: json['imageUrl'] as String?,
      url: json['url'] as String,
      startDate: _date(json['startDate']),
      endDate: _date(json['endDate']),
      sectors: sectors.isEmpty ? const ['diger'] : sectors,
      merchant: json['merchant'] as String?,
      benefit: Benefit.fromJson(json['benefit'] as Map<String, dynamic>?),
      join: join,
      firstSeenAt: _date(json['firstSeenAt']),
    );
  }

  /// Bugün dahil kalan gün. Bitiş tarihi yoksa null.
  int? get daysLeft {
    if (endDate == null) return null;
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    return endDate!.difference(today).inDays;
  }

  bool get isEndingSoon {
    final d = daysLeft;
    return d != null && d >= 0 && d <= 3;
  }

  bool get isNew {
    if (firstSeenAt == null) return false;
    return DateTime.now().difference(firstSeenAt!).inDays < 2;
  }
}

DateTime? _date(Object? v) {
  if (v is! String || v.isEmpty) return null;
  return DateTime.tryParse(v);
}
