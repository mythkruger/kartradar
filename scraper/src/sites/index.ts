import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { SiteConfig } from "../core/types.js";

/*
 * REGISTRY
 * Bu klasördeki her dosya bir site config'i (default export).
 * Yeni site eklemek = bu klasöre yeni bir dosya koymak. Başka yere dokunmaya gerek yok.
 */

const dir = path.dirname(fileURLToPath(import.meta.url));

let cache: SiteConfig[] | null = null;

export async function loadSites(): Promise<SiteConfig[]> {
  if (cache) return cache;

  const files = fs
    .readdirSync(dir)
    .filter((f) => /\.(ts|js)$/.test(f) && !f.endsWith(".d.ts") && !/^index\./.test(f) && !f.startsWith("_"))
    .sort();

  const sites: SiteConfig[] = [];
  const ids = new Set<string>();

  for (const file of files) {
    const mod = await import(pathToFileURL(path.join(dir, file)).href);
    const site = mod.default as SiteConfig | undefined;
    if (!site?.id) {
      console.warn(`[sites] ${file} geçerli bir config export etmiyor, atlandı.`);
      continue;
    }
    if (ids.has(site.id)) throw new Error(`[sites] Aynı id iki kez tanımlı: ${site.id}`);
    ids.add(site.id);
    sites.push(site);
  }

  cache = sites;
  return sites;
}

export async function getSite(id: string) {
  return (await loadSites()).find((s) => s.id === id);
}

export async function getEnabledSites() {
  return (await loadSites()).filter((s) => s.enabled !== false);
}
