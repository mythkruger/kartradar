import type { Page } from "playwright";
import type { FieldMap, ItemSpec, RawCampaign } from "./types.js";

/*
 * Tarayıcı içinde çalışan kod bilerek string olarak tutuluyor.
 * tsx/esbuild fonksiyonlara `__name` helper'ı ekleyebiliyor ve bu
 * page.evaluate içinde "__name is not defined" hatasına yol açıyor.
 */
export const BROWSER_EXTRACT = String.raw`
(spec) => {
  const toArray = (v) => (v == null ? [] : Array.isArray(v) ? v : [v]);

  // <br> ve blok etiketleri arasına boşluk koy: "çanta<br>alışveriş" → "çanta alışveriş"
  const text = (el) => {
    if (!el) return "";
    let t = el.textContent || "";
    if (el.children && el.children.length) {
      // DOMParser ile (script/onerror çalışmaz, sadece metin)
      const html = el.innerHTML.replace(/<br\s*\/?>|<\/(p|div|h[1-6]|li|tr|td|section|strong|b|span)>/gi, " $&");
      t = new DOMParser().parseFromString(html, "text/html").body.textContent || "";
    }
    return t.replace(/\s+/g, " ").trim();
  };

  const readValue = (el, attrs) => {
    if (!el) return null;
    if (!attrs.length) return text(el) || null;
    for (const a of attrs) {
      const v = el.getAttribute(a);
      if (v && v.trim()) return v.trim();
    }
    return null;
  };

  const readField = (root, field) => {
    const f = typeof field === "string" ? { sel: field } : field;
    const attrs = toArray(f.attr);
    if (f.self || !f.sel) return readValue(root, attrs);
    if (f.all) {
      const parts = [];
      for (const sel of toArray(f.sel)) {
        try { root.querySelectorAll(sel).forEach((el) => { const v = readValue(el, attrs); if (v) parts.push(v); }); } catch (e) {}
      }
      return parts.length ? parts.join(" \n") : null;
    }
    for (const sel of toArray(f.sel)) {
      let el = null;
      try { el = root.querySelector(sel); } catch (e) { el = null; }
      const v = readValue(el, attrs);
      if (v) return v;
    }
    return null;
  };

  const roots = () => {
    const item = spec.item;
    if (typeof item === "string") return Array.from(document.querySelectorAll(item));
    const out = [];
    for (const a of Array.from(document.querySelectorAll(item.anchor))) {
      let cur = a;
      for (let i = 0; i < item.up && cur; i++) cur = cur.parentElement;
      if (cur && !out.includes(cur)) out.push(cur);
    }
    return out;
  };

  const list = spec.single ? [document.querySelector(spec.item) || document.body] : roots();

  return list.map((root) => {
    const rec = {};
    for (const [key, field] of Object.entries(spec.fields)) rec[key] = readField(root, field);
    return rec;
  });
}
`;

export async function extractItems(
  page: Page,
  item: ItemSpec,
  fields: FieldMap
): Promise<RawCampaign[]> {
  return page.evaluate(
    `(${BROWSER_EXTRACT})(${JSON.stringify({ item, fields, single: false })})`
  ) as Promise<RawCampaign[]>;
}

/** Detay sayfası: tek bir root içinden alanları okur. */
export async function extractOne(
  page: Page,
  root: string | undefined,
  fields: FieldMap
): Promise<RawCampaign> {
  const [rec] = (await page.evaluate(
    `(${BROWSER_EXTRACT})(${JSON.stringify({ item: root ?? "body", fields, single: true })})`
  )) as RawCampaign[];
  return rec ?? {};
}

export interface LinkInfo {
  href: string;
  text: string;
  image: string | null;
}

/** Link + (varsa) içindeki görseli toplar. attr: "href" ya da "data-url" gibi. */
export async function extractLinks(page: Page, selector: string, attr = "href"): Promise<LinkInfo[]> {
  return page.evaluate(
    `Array.from(document.querySelectorAll(${JSON.stringify(selector)})).map((a) => {
      const img = a.querySelector("img");
      return {
        href: a.getAttribute(${JSON.stringify(attr)}) || "",
        text: (a.textContent || "").replace(/\\s+/g, " ").trim(),
        image: img ? (img.getAttribute("data-src") || img.getAttribute("src") || img.getAttribute("srcset")) : null
      };
    })`
  ) as Promise<LinkInfo[]>;
}
