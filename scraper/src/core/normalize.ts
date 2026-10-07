/* =========================
   ORTAK NORMALİZASYON
========================= */

export function clean(value: string | null | undefined): string | null {
  if (value == null) return null;
  const text = value.replace(/\s+/g, " ").trim();
  return text || null;
}

/** srcset ise ilk URL'yi alır: "a.jpg 1x, b.jpg 2x" → "a.jpg" */
export function firstFromSrcset(value: string): string {
  if (!value.includes(",") && !/\s\d+[wx]\b/.test(value)) return value.trim();
  return value.split(",")[0].trim().split(/\s+/)[0];
}

export function absoluteUrl(
  value: string | null | undefined,
  base: string
): string | null {
  let v = clean(value);
  if (!v || v.startsWith("javascript:") || v.startsWith("data:") || v === "#") {
    return null;
  }
  // CMS hatası: "https://a.com/xhttps://a.com/x" → sonuncuyu al
  const lastProto = v.lastIndexOf("http", v.length - 8);
  if (lastProto > 0 && /^https?:\/\//.test(v.slice(lastProto)) && /[a-z0-9]/i.test(v[lastProto - 1])) {
    v = v.slice(lastProto);
  }
  try {
    return new URL(v, base).href;
  } catch {
    return null;
  }
}

/** Next.js / CDN görsel proxy'lerini (…/_next/image?url=…) açar. */
export function unwrapImageProxy(url: string): string {
  try {
    const parsed = new URL(url);
    const inner = parsed.searchParams.get("url");
    if (inner && /_next\/image|\/image\?|\/img\?/.test(parsed.pathname + "?")) {
      return new URL(inner, parsed.origin).href;
    }
  } catch {
    /* yoksay */
  }
  return url;
}

export function imageUrl(
  value: string | null | undefined,
  base: string
): string | null {
  const v = clean(value);
  if (!v) return null;
  const abs = absoluteUrl(firstFromSrcset(v), base);
  return abs ? unwrapImageProxy(abs) : null;
}

export function slug(value: string): string {
  return value
    .replace(/^https?:\/\//, "")
    .replace(/[^a-zA-Z0-9]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

/**
 * Kampanya ID'si: "<program>-<url yolu>"
 *   bonus + https://www.bonus.com.tr/kampanyalar/migros-hemen → "bonus-kampanyalar-migros-hemen"
 * URL yoksa başlıktan üretilir.
 */
export function makeId(siteId: string, campaignUrl: string, title: string) {
  let key = title;
  if (campaignUrl) {
    try {
      const u = new URL(campaignUrl);
      key = u.pathname + (u.search || "");
    } catch {
      key = campaignUrl;
    }
  }
  return `${siteId}-${slug(key)}`.slice(0, 120);
}

/** Baştaki/sondaki tırnakları temizler: “Bahçe Keyfi!” → Bahçe Keyfi! */
export function stripQuotes(value: string | null): string | null {
  if (!value) return value;
  return clean(value.replace(/^["'“”‘’«»]+|["'“”‘’«»]+$/g, ""));
}

/**
 * URL'den okunabilir başlık üretir:
 *  /kampanya/okula-donus-koleksiyonu → "Okula Donus Koleksiyonu"
 *  /Arama?kelime=Iconic%20Kahvaltı   → "Iconic Kahvaltı"
 */
export function titleFromUrl(url: string | null): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    const q = u.searchParams.get("kelime") ?? u.searchParams.get("q") ?? u.searchParams.get("search");
    const raw = q ?? decodeURIComponent(u.pathname.split("/").filter(Boolean).pop() ?? "");
    const words = raw
      .replace(/\.[a-z]{2,4}$/i, "")
      .replace(/^c-/, "")
      .replace(/([a-zçğıöşü])\d+$/i, "$1") // "koleksiyonu10" → "koleksiyonu"
      .split(/[-_\s]+/)
      .filter(Boolean)
      .map((w) => w.charAt(0).toLocaleUpperCase("tr-TR") + w.slice(1));
    return words.length ? words.join(" ") : null;
  } catch {
    return null;
  }
}
