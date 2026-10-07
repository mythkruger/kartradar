import type { Page } from "playwright";

/* =========================
   KAMPANYA (tek veri modeli)
========================= */

/** Kazanç türleri */
export type BenefitType = "puan" | "taksit" | "indirim" | "nakit";

/** Katılım şekli */
export type JoinMethod = "sms" | "app" | "auto";

export interface Benefit {
  /** Kampanyada geçen kazanç türleri (bir kampanyada birden fazla olabilir) */
  types: BenefitType[];
  /** TL cinsinden kazanç: "400 TL bonus", "450 TL'ye varan Worldpuan" → 400 / 450 */
  amount: number | null;
  /** Yüzde: "%20 indirim" → 20 */
  percent: number | null;
  /** Taksit sayısı: "9 taksit", "+3 taksit" → 9 / 3 */
  installments: number | null;
  /** Alt limit: "1.000 TL ve üzeri" → 1000 */
  minSpend: number | null;
}

export interface Campaign {
  id: string;

  /** Kart programı: bonus, world, maximum, axess */
  programId: string;
  programName: string;
  bank: string;

  title: string;
  /** Kısa açıklama (en fazla ~300 karakter). Tam metin bankanın sayfasında. */
  summary: string | null;

  imageUrl: string | null;
  url: string;

  startDate: string | null; // YYYY-MM-DD
  endDate: string | null; // YYYY-MM-DD
  isActive: boolean;

  /** Standart sektör anahtarları (core/sectors.ts): market, akaryakit, giyim… */
  sectors: string[];
  /** Üye işyeri / marka ("Migros", "Shell") — bulunamazsa null */
  merchant: string | null;

  benefit: Benefit;
  join: JoinMethod | null;

  firstSeenAt?: string;
  lastSeenAt?: string;
}

/* =========================
   SELECTOR TANIMLARI
========================= */

/**
 * Bir alanın nasıl okunacağı.
 * - "string"        → o selector'ın textContent'i
 * - { sel, attr }   → selector'daki element'in attribute'u
 * - sel dizi olabilir: ilk bulunan kullanılır (fallback)
 * - attr dizi olabilir: ilk dolu olan kullanılır
 * - self: true      → item'ın kendisinden oku
 * - all: true       → eşleşen TÜM elementlerin metnini birleştir
 */
export type FieldSpec =
  | string
  | {
      sel?: string | string[];
      attr?: string | string[];
      self?: boolean;
      all?: boolean;
    };

/**
 * Siteden okunan ham alanlar.
 *  - title, description, imageUrl, campaignUrl
 *  - dateText / startDate / endDate      → tarih
 *  - category                            → bankanın kendi sektör etiketi ("MARKET", "giyim")
 *  - merchant                            → marka
 *  - benefitHint                         → bankanın verdiği tür ipucu ("puan", "taksit", "indirim")
 *  - detailText                          → detay sayfasının metni (kazanç/katılım/tarih buradan çıkarılır)
 */
export type RawField =
  | "title"
  | "description"
  | "imageUrl"
  | "campaignUrl"
  | "dateText"
  | "startDate"
  | "endDate"
  | "category"
  | "merchant"
  | "benefitHint"
  | "detailText";

export type FieldMap = Partial<Record<RawField, FieldSpec>>;

/** pageUrl: kartın bulunduğu sayfa (adapter doldurur) */
export type RawCampaign = Partial<Record<RawField | "pageUrl", string | null>>;

/**
 * Kart seçimi:
 * - "string"          → querySelectorAll
 * - { anchor, up }    → anchor element'ten `up` seviye yukarı çık (class'sız siteler için)
 */
export type ItemSpec = string | { anchor: string; up: number };

/* =========================
   PROGRAM (SİTE) CONFIG
========================= */

export type AdapterName = "listPage" | "custom";

export interface Log {
  info(msg: string): void;
  warn(msg: string): void;
}

export interface SiteConfig {
  /** Program anahtarı. Firestore belge ID'si ve kampanya ID prefix'i. Örn: "bonus" */
  id: string;
  /** Görünen ad: "Bonus" */
  name: string;
  /** Banka: "Garanti BBVA" */
  bank: string;

  baseUrl: string;
  startUrls: string[];

  adapter: AdapterName;
  enabled?: boolean;

  waitFor?: string;
  waitMs?: number;
  scroll?: boolean;
  timeoutMs?: number;
  retries?: number;

  /** listPage: kartları listeden oku */
  list?: {
    item: ItemSpec;
    fields: FieldMap;
  };

  /**
   * custom: kampanyaları kendin topla (JSON API, sayfalı AJAX…).
   * Sayfa açık ve hazır halde verilir; ham kayıt listesi döndür.
   */
  run?: (page: Page, ctx: { site: SiteConfig; log: Log }) => Promise<RawCampaign[]>;

  /**
   * Detay sayfası (isteğe bağlı). Her kampanyanın sayfasına girip ek alan okur.
   * Detaylar yerel önbellekte tutulur: sadece YENİ kampanyaların sayfasına girilir.
   */
  detail?: {
    root?: string;
    fields: FieldMap;
    /** Bir çalışmada en fazla kaç yeni detay sayfası açılsın (siteyi yormamak için). Varsayılan 40 */
    maxPerRun?: number;
    /** İki detay isteği arası bekleme (ms). Varsayılan 800 */
    delayMs?: number;
    /** Önbellekteki detay kaç gün sonra yenilensin. Varsayılan 7 */
    refreshDays?: number;
  };

  /** Tarih hangi alanlardan parse edilsin (sırayla). Varsayılan: dateText, detailText, description, title */
  datesFrom?: RawField[];

  idFrom?: "campaignUrl" | "title";
  urlFallback?: "page";
  titleFallback?: "url";
  excludeTitle?: string;
  required?: RawField[];

  hooks?: {
    beforeExtract?: (page: Page) => Promise<void>;
    transform?: (raw: RawCampaign) => RawCampaign | null;
  };
}

export function defineSite(config: SiteConfig): SiteConfig {
  return config;
}

/* =========================
   ÇALIŞMA SONUCU
========================= */

export interface SiteResult {
  siteId: string;
  name: string;
  ok: boolean;
  campaigns: Campaign[];
  warnings: string[];
  error?: string;
  durationMs: number;
  debugScreenshot?: string;
}
