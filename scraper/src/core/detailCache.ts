import fs from "node:fs";
import path from "node:path";
import type { RawCampaign } from "./types.js";

/*
 * DETAY ÖNBELLEĞİ (sadece bu bilgisayarda, Firestore'a gitmez)
 *
 * Bankaların listelerinde 100-200 kampanya var. Her çalışmada hepsinin detay sayfasına
 * girmek hem yavaş hem de bankanın sitesini gereksiz yorar. Bu yüzden detay sayfası
 * sadece YENİ kampanyada (ya da önbellek eskidiyse) açılır.
 *
 * Dosya: data/detail-cache.json → { "<url>": { fetchedAt, fields } }
 * Silinirse sorun olmaz: bir sonraki çalışmalarda yavaş yavaş yeniden dolar.
 */

const FILE = path.resolve("data", "detail-cache.json");

interface Entry {
  fetchedAt: number;
  fields: RawCampaign;
}

let cache: Record<string, Entry> | null = null;

function load(): Record<string, Entry> {
  if (cache) return cache;
  try {
    cache = JSON.parse(fs.readFileSync(FILE, "utf8"));
  } catch {
    cache = {};
  }
  return cache!;
}

export function getDetail(url: string, maxAgeDays: number): RawCampaign | null {
  const entry = load()[url];
  if (!entry) return null;
  if (Date.now() - entry.fetchedAt > maxAgeDays * 86_400_000) return null;
  return entry.fields;
}

export function setDetail(url: string, fields: RawCampaign) {
  load()[url] = { fetchedAt: Date.now(), fields };
}

/** Artık listede olmayan URL'leri at ve diske yaz */
export function saveDetails(keepUrls?: Set<string>, prefix?: string) {
  const c = load();
  if (keepUrls && prefix) {
    for (const url of Object.keys(c)) {
      if (url.startsWith(prefix) && !keepUrls.has(url)) delete c[url];
    }
  }
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(c));
}
