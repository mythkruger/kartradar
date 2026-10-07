import { escapeRegex, fold } from "./text.js";

/*
 * STANDART SEKTÖRLER
 * Her bankanın kendi etiketi var ("GİYİM-AKSESUAR", "Moda ve Tekstil", "giyim").
 * Hepsini tek bir listeye çeviriyoruz; uygulama filtreleri bu anahtarları kullanır.
 *
 * Anahtar eklersen uygulamadaki sektör listesine de eklemeyi unutma.
 */

export const SECTORS = {
  market: "Market",
  akaryakit: "Akaryakıt",
  giyim: "Giyim & Aksesuar",
  elektronik: "Elektronik",
  "beyaz-esya": "Beyaz Eşya",
  mobilya: "Mobilya & Ev",
  "e-ticaret": "Online Alışveriş",
  seyahat: "Seyahat & Otel",
  "yeme-icme": "Yeme & İçme",
  egitim: "Eğitim & Kırtasiye",
  saglik: "Sağlık & Kozmetik",
  eglence: "Eğlence & Kültür",
  otomotiv: "Otomotiv & Ulaşım",
  fatura: "Fatura & Vergi",
  telekom: "Telekom & Dijital",
  spor: "Spor",
  genel: "Tüm Harcamalar",
  diger: "Diğer"
} as const;

export type Sector = keyof typeof SECTORS;

/** Anahtar kelimeler (sadeleştirilmiş, kelime başından eşleşir) */
const KEYWORDS: Record<Exclude<Sector, "diger">, string[]> = {
  market: ["market", "gida", "migros", "carrefour", "a101", "bim", "sok market", "file market", "macrocenter", "getir"],
  akaryakit: ["akaryakit", "otogaz", "shell", "opet", "bp ", "petrol ofisi", "total", "aytemiz", "po "],
  giyim: ["giyim", "ayakkabi", "canta", "aksesuar", "moda", "tekstil", "lc waikiki", "koton", "defacto", "boyner", "zara", "kuyum", "optik"],
  elektronik: ["elektronik", "teknoloji", "telefon", "bilgisayar", "mediamarkt", "teknosa", "vatan", "apple"],
  "beyaz-esya": ["beyaz esya", "ev aletleri", "arcelik", "beko", "vestel", "bosch", "isitma", "sogutma", "isitmasogutma", "klima"],
  mobilya: ["mobilya", "dekorasyon", "ev tekstili", "yapi market", "yapi sektoru", "ikea", "istikbal", "bellona", "koctas", "bauhaus", "madame coco", "english home"],
  "e-ticaret": ["e-ticaret", "online alisveris", "internet alisveris", "trendyol", "hepsiburada", "amazon", "n11", "pazarama", "ciceksepeti"],
  seyahat: ["seyahat", "turizm", "otel", "tatil", "havayol", "ucak", "thy", "pegasus", "ajet", "yurt disi", "ets", "jolly", "setur", "arac kiralama", "rent a car"],
  "yeme-icme": ["restoran", "restaurant", "cafe", "kafe", "yeme-icme", "yeme icme", "yemeksepeti", "kahve", "pastane", "starbucks", "burger"],
  egitim: ["egitim", "kirtasiye", "okul", "okula donus", "kitap", "universite", "kurs"],
  saglik: ["saglik", "hastane", "eczane", "kozmetik", "gratis", "watsons", "sephora"],
  eglence: ["eglence", "sinema", "tiyatro", "konser", "kultur", "sanat", "oyuncak", "biletix"],
  otomotiv: ["otomotiv", "oto bakim", "lastik", "arac bakim", "arac muayene", "ulasim", "hgs", "ogs", "otopark", "taksi", "istanbulkart"],
  fatura: ["fatura", "vergi", "kamu", "mtv", "sgk", "otomatik odeme", "talimat"],
  telekom: ["telekom", "telekomin", "gsm", "turkcell", "vodafone", "turk telekom", "dijital platform", "netflix", "spotify", "youtube", "disney"],
  spor: ["spor salonu", "spor", "fitness", "macfit", "decathlon"],
  genel: ["tum sektor", "tum harcama", "tum alisveris", "her harcama", "genel kampanya"]
};

const PATTERNS = (Object.entries(KEYWORDS) as [Sector, string[]][]).map(([sector, words]) => ({
  sector,
  re: new RegExp(`(^|[^a-z0-9])(${words.map((w) => escapeRegex(normalize(w))).join("|")})`)
}));

/**
 * Bankanın sektör etiketi(leri) + başlık/metinden standart sektörleri çıkarır.
 * Önce bankanın etiketi kullanılır; etiket yoksa ya da "diğer" ise metne bakılır.
 */
export function sectorsFor(bankLabel: string | null, text: string): Sector[] {
  const fromLabel = bankLabel ? match(bankLabel) : [];
  if (fromLabel.length) return fromLabel;
  const fromText = match(text);
  return fromText.length ? fromText.slice(0, 3) : ["diger"];
}

/** Sadeleştir + ayırıcıları boşluğa çevir ("e-ticaret" → "e ticaret") */
function normalize(text: string) {
  return fold(text).replace(/[-_,;/|]+/g, " ");
}

function match(text: string): Sector[] {
  const t = ` ${normalize(text)} `;
  return PATTERNS.filter((p) => p.re.test(t)).map((p) => p.sector);
}
