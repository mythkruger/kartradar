import 'package:flutter/material.dart';

/*
 * Kart programları ve sektörler.
 * ID'ler scraper'daki site ID'leriyle aynı olmalı (scraper/src/sites/ klasöründeki dosyalar).
 */

/// Kart türü: kart seçme ekranında gruplamak için
enum ProgramKind { kredi, ogrenci, yemek }

const kindTitles = {
  ProgramKind.kredi: 'Kredi kartların',
  ProgramKind.ogrenci: 'Genç ve öğrenci kartların',
  ProgramKind.yemek: 'Yemek ve yan hak kartların',
};

const kindHints = {
  ProgramKind.kredi: 'Bankandan aldığın kredi kartları',
  ProgramKind.ogrenci: 'Gençlere ve öğrencilere özel kartlar',
  ProgramKind.yemek: 'Şirketinin sana verdiği yemek / yan hak kartı',
};

class Program {
  final String id;
  final String name;
  final String bank;
  final Color color;

  /// Kullanıcının kartını tanıması için örnek kart adları
  final String cards;

  /// Kart çiziminde çapraz renkli çizgiler (ör. öğrenci kartı). Boşsa düz renk.
  final List<Color> stripes;

  /// Kart listesinde küçük etiket (ör. "Öğrenci")
  final String? tag;

  final ProgramKind kind;

  const Program({
    required this.id,
    required this.name,
    required this.bank,
    required this.color,
    required this.cards,
    this.stripes = const [],
    this.tag,
    this.kind = ProgramKind.kredi,
  });
}

const programs = <Program>[
  Program(
    id: 'bonus',
    name: 'Bonus',
    bank: 'Garanti BBVA',
    color: Color(0xFF1E9E5A),
    cards: 'Bonus, Bonus Genç, Shop&Fly, Miles&Smiles',
  ),
  Program(
    id: 'world',
    name: 'World',
    bank: 'Yapı Kredi',
    color: Color(0xFF6A3FA0),
    cards: 'Worldcard, Adios, Play, Crystal',
  ),
  Program(
    id: 'maximum',
    name: 'Maximum',
    bank: 'İş Bankası',
    color: Color(0xFFD6336C),
    cards: 'Maximum, Maximiles, Maximum Genç',
  ),
  Program(
    id: 'axess',
    name: 'Axess',
    bank: 'Akbank',
    color: Color(0xFFD83A34),
    cards: 'Axess, Wings, Free, Neo',
  ),
  Program(
    id: 'bankkart',
    name: 'Bankkart',
    bank: 'Ziraat Bankası',
    color: Color(0xFFA16207),
    cards: 'Bankkart, Jest, Prestij, Prestij Plus',
  ),
  Program(
    id: 'paraf',
    name: 'Paraf',
    bank: 'Halkbank',
    color: Color(0xFF1D4ED8),
    cards: 'Paraf, Parafly',
  ),
  Program(
    id: 'qnb',
    name: 'QNB',
    bank: 'QNB (eski CardFinans)',
    color: Color(0xFF831843),
    cards: 'CardFinans, QNB Kredi Kartı, Xtra, GO, First',
  ),
  Program(
    id: 'advantage',
    name: 'Advantage',
    bank: 'HSBC',
    color: Color(0xFF374151),
    cards: 'Advantage, HSBC Premier',
  ),
  Program(
    id: 'enpara',
    name: 'Enpara',
    bank: 'Enpara (QNB)',
    color: Color(0xFF7C3AED),
    cards: 'Enpara Kredi Kartı, Encard, Encard Genç',
  ),
  Program(
    id: 'bankkart-genc',
    name: 'Bankkart Genç',
    bank: 'Ziraat Bankası',
    color: Color(0xFF4F46E5),
    cards: 'KYK burs / öğrenim kredisi alan öğrencilerin kartı',
    stripes: [Color(0xFFF43F5E), Color(0xFFF59E0B), Color(0xFF10B981), Color(0xFF3B82F6)],
    tag: 'Öğrenci',
    kind: ProgramKind.ogrenci,
  ),
  Program(
    id: 'bonus-genc',
    name: 'Bonus Genç',
    bank: 'Garanti BBVA',
    color: Color(0xFF15803D),
    cards: 'Gençlere özel Bonus kartı',
    stripes: [Color(0xFFFACC15), Color(0xFF22D3EE), Color(0xFFF472B6)],
    tag: 'Genç',
    kind: ProgramKind.ogrenci,
  ),
  Program(
    id: 'encard-genc',
    name: 'Encard Genç',
    bank: 'Enpara (QNB)',
    color: Color(0xFF6D28D9),
    cards: 'Gençlere özel Encard',
    stripes: [Color(0xFF34D399), Color(0xFFFBBF24)],
    tag: 'Genç',
    kind: ProgramKind.ogrenci,
  ),
  Program(
    id: 'multinet',
    name: 'Multinet',
    bank: 'Multinet Up',
    color: Color(0xFF0E7490),
    cards: 'Yemek kartı · MultiPay',
    kind: ProgramKind.yemek,
  ),
  Program(
    id: 'setcard',
    name: 'Setcard',
    bank: 'Setcard',
    color: Color(0xFFEA580C),
    cards: 'Yemek kartı · Setcard Mobil',
    kind: ProgramKind.yemek,
  ),
];

/// Türe göre gruplu liste (boş gruplar atlanır)
List<(ProgramKind, List<Program>)> programsByKind([Iterable<Program>? source]) {
  final list = (source ?? programs).toList();
  return [
    for (final k in ProgramKind.values)
      if (list.any((p) => p.kind == k)) (k, list.where((p) => p.kind == k).toList()),
  ];
}

Program programById(String id) => programs.firstWhere(
      (p) => p.id == id,
      orElse: () => Program(
        id: id,
        name: id,
        bank: '',
        color: const Color(0xFF64748B),
        cards: '',
      ),
    );

/// Sektör anahtarı → (etiket, ikon). Kaynak: scraper/src/core/sectors.ts
const sectors = <String, (String, IconData)>{
  'market': ('Market', Icons.shopping_cart_outlined),
  'akaryakit': ('Akaryakıt', Icons.local_gas_station_outlined),
  'giyim': ('Giyim', Icons.checkroom_outlined),
  'elektronik': ('Elektronik', Icons.devices_other_outlined),
  'beyaz-esya': ('Beyaz Eşya', Icons.kitchen_outlined),
  'mobilya': ('Mobilya & Ev', Icons.chair_outlined),
  'e-ticaret': ('Online', Icons.shopping_bag_outlined),
  'seyahat': ('Seyahat', Icons.flight_outlined),
  'yeme-icme': ('Yeme & İçme', Icons.restaurant_outlined),
  'egitim': ('Eğitim', Icons.school_outlined),
  'saglik': ('Sağlık & Kozmetik', Icons.spa_outlined),
  'eglence': ('Eğlence', Icons.theaters_outlined),
  'otomotiv': ('Otomotiv', Icons.directions_car_outlined),
  'fatura': ('Fatura & Vergi', Icons.receipt_long_outlined),
  'telekom': ('Telekom', Icons.smartphone_outlined),
  'spor': ('Spor', Icons.sports_soccer_outlined),
  'genel': ('Tüm Harcamalar', Icons.all_inclusive),
  'diger': ('Diğer', Icons.more_horiz),
};

String sectorLabel(String key) => sectors[key]?.$1 ?? key;
IconData sectorIcon(String key) => sectors[key]?.$2 ?? Icons.local_offer_outlined;
