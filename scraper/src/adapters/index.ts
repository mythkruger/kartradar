import type { Page } from "playwright";
import { getDetail, saveDetails, setDetail } from "../core/detailCache.js";
import { extractItems, extractOne } from "../core/extract.js";
import { absoluteUrl } from "../core/normalize.js";
import type { AdapterName, Log, RawCampaign, SiteConfig } from "../core/types.js";

export type Adapter = (page: Page, site: SiteConfig, log: Log) => Promise<RawCampaign[]>;

/* =========================
   ORTAK: SAYFAYI AÇ VE HAZIRLA
========================= */

export async function openPage(
  page: Page,
  url: string,
  site: SiteConfig,
  log: Log,
  waitFor = site.waitFor,
  quiet = false
) {
  const started = Date.now();
  if (!quiet) log.info(`Sayfa açılıyor: ${url}`);
  await page.goto(url, { waitUntil: "domcontentloaded" });

  if (waitFor) {
    try {
      await page.waitForSelector(waitFor, { state: "attached" });
    } catch {
      log.warn(`"${waitFor}" beklenirken zaman aşımı: ${url}`);
    }
  } else {
    await page.waitForTimeout(site.waitMs ?? 3000);
  }

  if (site.scroll) await autoScroll(page);
  if (site.hooks?.beforeExtract) await site.hooks.beforeExtract(page);
  if (!quiet) log.info(`Sayfa hazır (${((Date.now() - started) / 1000).toFixed(1)} sn)`);
}

export async function autoScroll(page: Page, maxSteps = 30) {
  let lastHeight = 0;
  for (let i = 0; i < maxSteps; i++) {
    const height = (await page.evaluate(
      "window.scrollBy(0, window.innerHeight); document.body.scrollHeight"
    )) as number;
    await page.waitForTimeout(400);
    if (height === lastHeight) break;
    lastHeight = height;
  }
  await page.evaluate("window.scrollTo(0, 0)");
}

/* =========================
   listPage: kartlar sayfada (DOM)
========================= */

const listPage: Adapter = async (page, site, log) => {
  if (!site.list) throw new Error(`${site.id}: listPage için "list" tanımı gerekli.`);
  const out: RawCampaign[] = [];
  for (const url of site.startUrls) {
    const pageUrl = new URL(url, site.baseUrl).href;
    await openPage(page, pageUrl, site, log);
    const items = await extractItems(page, site.list.item, site.list.fields);
    log.info(`${items.length} kampanya kartı okundu`);
    out.push(...items.map((item) => ({ ...item, pageUrl })));
  }
  return out;
};

/* =========================
   custom: site kendi toplama kodunu verir (JSON API, sayfalı AJAX…)
========================= */

const custom: Adapter = async (page, site, log) => {
  if (!site.run) throw new Error(`${site.id}: custom adapter için "run" fonksiyonu gerekli.`);
  const pageUrl = new URL(site.startUrls[0], site.baseUrl).href;
  await openPage(page, pageUrl, site, log);
  const items = await site.run(page, { site, log });
  log.info(`${items.length} kampanya okundu`);
  return items.map((item) => ({ pageUrl, ...item }));
};

export const adapters: Record<AdapterName, Adapter> = { listPage, custom };

/* =========================
   DETAY: sadece yeni kampanyaların sayfasına gir (önbellekli)
========================= */

export async function enrichWithDetails(page: Page, site: SiteConfig, raws: RawCampaign[], log: Log) {
  if (!site.detail) return raws;
  const { root, fields, delayMs = 800, refreshDays = 7 } = site.detail;
  // İlk kurulumda hepsini bir kerede doldurmak için: DETAIL_MAX_PER_RUN=500 npm run scrape -- bonus
  const maxPerRun = Number(process.env.DETAIL_MAX_PER_RUN) || site.detail.maxPerRun || 40;

  const urls = new Set<string>();
  let fromCache = 0;
  let fetched = 0;
  let skipped = 0;

  const out: RawCampaign[] = [];
  for (const raw of raws) {
    const url = absoluteUrl(raw.campaignUrl, site.baseUrl);
    if (!url || !url.startsWith(site.baseUrl)) {
      out.push(raw); // banka dışı link (ör. uygulama mağazası) → detay yok
      continue;
    }
    urls.add(url);

    const cached = getDetail(url, refreshDays);
    if (cached) {
      fromCache++;
      out.push(merge(raw, cached));
      continue;
    }

    if (fetched >= maxPerRun) {
      skipped++;
      out.push(raw);
      continue;
    }

    try {
      if (fetched > 0) await page.waitForTimeout(delayMs);
      await openPage(page, url, site, log, root ?? "body", true);
      const rec = await extractOne(page, root, fields);
      setDetail(url, rec);
      fetched++;
      out.push(merge(raw, rec));
    } catch (error) {
      log.warn(`Detay okunamadı: ${url} (${(error as Error).message.split("\n")[0]})`);
      out.push(raw);
    }
  }

  saveDetails(urls, site.baseUrl);
  log.info(
    `Detay: ${fetched} yeni sayfa açıldı, ${fromCache} önbellekten` +
      (skipped ? `, ${skipped} sonraki çalışmaya kaldı (limit ${maxPerRun})` : "")
  );
  return out;
}

/** Liste verisi öncelikli; detay sadece boş alanları doldurur (detailText her zaman detaydan) */
function merge(list: RawCampaign, detail: RawCampaign): RawCampaign {
  const out: RawCampaign = { ...list };
  for (const [k, v] of Object.entries(detail) as [keyof RawCampaign, string | null][]) {
    if (!v) continue;
    if (k === "detailText" || !out[k]) out[k] = v;
  }
  return out;
}
