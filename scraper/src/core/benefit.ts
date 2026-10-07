import type { Benefit, BenefitType, JoinMethod } from "./types.js";
import { fold, parseTlNumber } from "./text.js";

/*
 * KAZANÇ PARSER'I
 * Kampanya metninden ne kazanıldığını çıkarır. Örnekler:
 *   "Migros Hemen'de her 1.000 TL ve üzeri alışverişe 100 TL, toplam 400 TL bonus"
 *       → puan, amount 400, minSpend 1000
 *   "450 TL'ye varan Worldpuan"                       → puan, amount 450
 *   "Pazarama'da sepette %20 indirim"                 → indirim, percent 20
 *   "peşin fiyatına 3 taksit" / "+3 taksit"           → taksit, installments 3
 *   "350 TL chip-para, üstelik peşin fiyatına 3 taksitle" → puan + taksit
 *   "%5 nakit iade" / "500 TL iade"                   → nakit
 *   "A101 Marketler'de 1.500 TL Jest Lira" (Bankkart)  → puan, amount 1500
 *
 * Kural: bulunamayan alan null kalır. Uydurmak yerine boş bırakmak daha iyi;
 * kullanıcı zaten detayı bankanın sayfasında görüyor.
 */

const POINT_WORDS = [
  "bonus", "worldpuan", "maxipuan", "maxi puan", "chip-para", "chip para", "chippara",
  "puan", "maximil", "chippuan", "jest lira", "jestlira", "bankkart lira",
  "parafpara", "parapuan", "nakitpuan"
];

// sadeleştirilmiş metin üzerinde çalışır (ç→c, ş→s…)
// Binlik ayıracı nokta ("1.500") ya da virgül ("1,500" — HSBC böyle yazıyor) olabilir
const TL = "(\\d{1,3}(?:[.,]\\d{3})+(?!\\d)|\\d+)(?:,\\d{1,2}(?!\\d))?\\s*(?:tl|₺)";
// Puan tutarı "TL" olmadan da yazılabiliyor: "100 Worldpuan", "500 MaxiPuan"
const NUM_TL_OPT = "(\\d{1,3}(?:[.,]\\d{3})+(?!\\d)|\\d+)(?:,\\d{1,2}(?!\\d))?\\s*(?:tl|₺)?";
const POINT_RE = new RegExp(
  `${NUM_TL_OPT}(?:'?(?:ye|ya|e|a|yi|i|u|yu)?\\s*(?:varan|asan|uzeri))?(?:\\s*(?:ek|hediye|degerinde))?\\s*(?:${POINT_WORDS.map((w) => w.replace(/[-\s]/g, "[- ]?")).join("|")})`,
  "g"
);
const TOTAL_RE = new RegExp(`(?:toplam(?:da)?|toplamda|en fazla|max(?:imum)?\\.?)\\s*${TL}`, "g");
const MIN_SPEND_RE = new RegExp(`${TL}\\s*(?:ve|ile)\\s*(?:uzeri|ustu)`, "g");
const PERCENT_RE = /(?:%\s*(\d{1,2})|(\d{1,2})\s*%)(?:'?(?:ye|ya|e|a)?\s*varan)?\s*(?:[a-z]+\s+){0,2}?(indirim|iade|nakit)/g;
const INSTALLMENT_RE = /(?:\+\s*(\d{1,2})|(\d{1,2})\s*(?:aya?\s*)?(?:'?(?:ye|ya|e|a)\s*)?(?:varan\s*)?(?:ek\s*)?)\s*taksit/g;
const DISCOUNT_TL_RE = new RegExp(`${TL}(?:'?(?:ye|ya|e|a)?\\s*varan)?\\s*(indirim|iade|nakit iade|hediye bakiye)`, "g");

function num(s: string | undefined) {
  return s ? parseTlNumber(s) : null;
}

function maxOf(values: (number | null)[]) {
  const v = values.filter((x): x is number => x != null && x > 0);
  return v.length ? Math.max(...v) : null;
}

export function parseBenefit(text: string, hint?: string | null): Benefit {
  const t = fold(text).replace(/\s+/g, " ");
  const types = new Set<BenefitType>();

  // Puan (bonus, worldpuan, maxipuan, chip-para…)
  const pointAmounts = [...t.matchAll(POINT_RE)].map((m) => num(m[1]));
  if (pointAmounts.length) types.add("puan");

  // İndirim / iade: yüzde
  const percents: number[] = [];
  for (const m of t.matchAll(PERCENT_RE)) {
    const p = Number(m[1] ?? m[2]);
    if (p > 0 && p <= 90) percents.push(p);
    types.add(m[3] === "indirim" ? "indirim" : "nakit");
  }

  // İndirim / iade: TL
  const discountAmounts: (number | null)[] = [];
  for (const m of t.matchAll(DISCOUNT_TL_RE)) {
    discountAmounts.push(num(m[1]));
    types.add(m[2] === "indirim" ? "indirim" : "nakit");
  }

  // Taksit
  const installments: number[] = [];
  for (const m of t.matchAll(INSTALLMENT_RE)) {
    const n = Number(m[1] ?? m[2]);
    if (n >= 2 && n <= 36) installments.push(n);
  }
  if (installments.length || /taksit/.test(t)) types.add("taksit");

  // Bankanın ipucu (ör. World API: "Worldpuan", "Taksit", "İndirim")
  for (const h of (hint ?? "").split(/[;,]/).map((x) => fold(x.trim()))) {
    if (!h) continue;
    if (/puan|bonus|chip/.test(h)) types.add("puan");
    else if (/taksit/.test(h)) types.add("taksit");
    else if (/indirim/.test(h)) types.add("indirim");
    else if (/iade|nakit/.test(h)) types.add("nakit");
  }

  // Toplam / en fazla ifadesi varsa o, yoksa en büyük puan/indirim tutarı
  const totals = [...t.matchAll(TOTAL_RE)].map((m) => num(m[1]));
  const amount = maxOf(totals) ?? maxOf([...pointAmounts, ...discountAmounts]);

  const minSpends = [...t.matchAll(MIN_SPEND_RE)].map((m) => num(m[1]));
  const minSpend = minSpends.find((x) => x != null) ?? null;

  return {
    types: [...types].sort(order),
    amount: amount != null && amount !== minSpend ? amount : maxOf([...pointAmounts, ...discountAmounts].filter((a) => a !== minSpend)),
    percent: maxOf(percents),
    installments: maxOf(installments),
    minSpend
  };
}

const ORDER: BenefitType[] = ["puan", "indirim", "nakit", "taksit"];
function order(a: BenefitType, b: BenefitType) {
  return ORDER.indexOf(a) - ORDER.indexOf(b);
}

/*
 * KATILIM ŞEKLİ
 *   "... yazıp 4566'ya SMS gönderin"         → sms
 *   "BonusFlaş'tan HEMEN KATIL", "Juzdan'dan" → app
 *   "katılım gerektirmez", "otomatik"          → auto
 * Birden fazla yol varsa uygulama (app) önceliklidir; kullanıcı için en kolayı.
 */
export function parseJoin(text: string): JoinMethod | null {
  const t = fold(text);
  if (/(katilim|kayit)\s*(gerektirmez|gerekmez|gerekmemektedir|gerekmektedir\s*degil)|otomatik olarak (tanimlan|kazan)/.test(t)) {
    return "auto";
  }
  if (/hemen katil|katil butonu|bonusflas|juzdan|world mobil|iscep|maximum mobil|bankkart mobil|multipay|setcard mobil|qnb mobil|hsbc mobil|halkbank mobil|paraf mobil|enpara.com cep|mobil uygulama|uygulamasindan|uygulamadan katil/.test(t)) {
    return "app";
  }
  if (/\bsms\b|\d{4}'?\s*(?:e|a|ye|ya)?\s*(?:sms|mesaj)/.test(t)) return "sms";
  return null;
}
