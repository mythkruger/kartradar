// Tüm tarih hesapları Türkiye saatiyle (sunucu UTC'de çalışsa bile gece yarısı doğru olsun)
process.env.TZ ||= "Europe/Istanbul";

/* =========================
   TÜRKÇE TARİH YARDIMCILARI
   Tüm siteler için tek parser.
========================= */

const MONTHS: Record<string, number> = {
  oca: 1,
  şub: 2,
  sub: 2,
  mar: 3,
  nis: 4,
  may: 5,
  haz: 6,
  tem: 7,
  ağu: 8,
  agu: 8,
  eyl: 9,
  eki: 10,
  kas: 11,
  ara: 12
};

const MONTH_WORD = "([A-Za-zÇĞİÖŞÜçğıöşü]{3,})";
const NUM_DATE = "(\\d{1,2})[./](\\d{1,2})[./](\\d{4}|\\d{2})(?!\\d)";
const TIME = "(?:\\s*(?:saat\\s*)?\\d{1,2}[:.]\\d{2})?";
const SEP = "\\s*(?:[–—-]|\\bile\\b|\\bila\\b|\\bve\\b)\\s*";

/** 26 → 2026 */
function year(y: number) {
  return y < 100 ? 2000 + y : y;
}

const FULL_MONTHS = [
  "ocak", "şubat", "mart", "nisan", "mayıs", "haziran",
  "temmuz", "ağustos", "eylül", "ekim", "kasım", "aralık"
];
const ASCII_MONTHS = [
  "ocak", "subat", "mart", "nisan", "mayis", "haziran",
  "temmuz", "agustos", "eylul", "ekim", "kasim", "aralik"
];

/** "Eylül" / "Eyl" / "eylul" → 9. "Marka", "Kasa" gibi kelimeler eşleşmez. */
function monthNumber(word: string | undefined): number | null {
  if (!word) return null;
  const w = word.toLocaleLowerCase("tr-TR");
  if (w.length === 3) return MONTHS[w] ?? null;
  const i = FULL_MONTHS.indexOf(w);
  if (i >= 0) return i + 1;
  const j = ASCII_MONTHS.indexOf(w);
  return j >= 0 ? j + 1 : null;
}

function pad(value: number | string) {
  return String(value).padStart(2, "0");
}

function iso(year: number, month: number, day: number): string | null {
  if (!year || month < 1 || month > 12 || day < 1 || day > 31) return null;
  return `${year}-${pad(month)}-${pad(day)}`;
}

export interface DateRange {
  startDate: string | null;
  endDate: string | null;
}

const EMPTY: DateRange = { startDate: null, endDate: null };

/**
 * Metin içindeki tarih aralığını bulur. Desteklenen örnekler:
 *  "1 Eylül - 30 Eylül 2026"
 *  "1 Mar 2025 – 30 Eyl 2026"
 *  "15 Aralık - 15 Ocak 2027"      (başlangıç yılı bir önceki yıl olur)
 *  "01.09.2026 - 30.09.2026"
 *  "1-30 Eylül 2026"
 *  "Son gün: 30 Eylül 2026" / "30 Eylül 2026'ya kadar"   (sadece bitiş)
 */
export function parseDateRange(text: string | null | undefined): DateRange {
  if (!text) return EMPTY;

  const t = text.replace(/\s+/g, " ");

  // 01.09.2026 - 30.09.2026 | 01.09.26 - 30.09.26 | 22.09.2026 saat 16:15 ile 29.09.2026
  const numeric = t.match(
    new RegExp(`${NUM_DATE}${TIME}${SEP}${NUM_DATE}`, "i")
  );
  if (numeric) {
    const [, d1, m1, y1, d2, m2, y2] = numeric.map(Number);
    return { startDate: iso(year(y1), m1, d1), endDate: iso(year(y2), m2, d2) };
  }

  // 1 Eylül [2026] - 30 Eylül [2026]
  // (matchAll: ilk eşleşme ay değilse — "10 Adet - 20 Adet" gibi — sonrakilere bak)
  const wordsRe = new RegExp(
    `(\\d{1,2})\\s+${MONTH_WORD}\\s*(\\d{4})?${SEP}(\\d{1,2})\\s+${MONTH_WORD}\\s*(\\d{4})?`,
    "gi"
  );
  for (const [, d1, mw1, y1, d2, mw2, y2] of t.matchAll(wordsRe)) {
    const m1 = monthNumber(mw1);
    const m2 = monthNumber(mw2);
    if (!m1 || !m2) continue;
    const endYear = y2 ? Number(y2) : y1 ? Number(y1) : currentYear();
    let startYear = y1 ? Number(y1) : endYear;
    if (!y1 && m1 > m2) startYear = endYear - 1;
    return {
      startDate: iso(startYear, m1, Number(d1)),
      endDate: iso(endYear, m2, Number(d2))
    };
  }

  // 1-30 Eylül [2026]
  const sameMonthRe = new RegExp(`(\\d{1,2})${SEP}(\\d{1,2})\\s+${MONTH_WORD}\\s*(\\d{4})?`, "gi");
  for (const [, d1, d2, mw, y] of t.matchAll(sameMonthRe)) {
    const m = monthNumber(mw);
    if (!m) continue;
    const yy = y ? Number(y) : currentYear();
    return {
      startDate: iso(yy, m, Number(d1)),
      endDate: iso(yy, m, Number(d2))
    };
  }

  // Sadece tek tarih varsa bitiş tarihi kabul et
  const single = parseSingleDate(t);
  if (single) return { startDate: null, endDate: single };

  return EMPTY;
}

/** Tek bir tarihi YYYY-MM-DD'ye çevirir (ISO, dd.mm.yyyy veya "30 Eylül 2026"). */
export function parseSingleDate(text: string | null | undefined): string | null {
  if (!text) return null;
  const t = text.trim();

  const isoMatch = t.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    return iso(Number(isoMatch[1]), Number(isoMatch[2]), Number(isoMatch[3]));
  }

  const numeric = t.match(new RegExp(NUM_DATE));
  if (numeric) {
    return iso(year(Number(numeric[3])), Number(numeric[2]), Number(numeric[1]));
  }

  for (const [, d, mw, y] of t.matchAll(new RegExp(`(\\d{1,2})\\s+${MONTH_WORD}\\s*(\\d{4})`, "gi"))) {
    const m = monthNumber(mw);
    if (m) return iso(Number(y), m, Number(d));
  }

  return null;
}

function currentYear() {
  return new Date().getFullYear();
}

export function today(): string {
  const now = new Date();
  return iso(now.getFullYear(), now.getMonth() + 1, now.getDate())!;
}
