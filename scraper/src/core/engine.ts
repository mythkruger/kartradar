import fs from "node:fs";
import path from "node:path";
import { chromium, type Browser } from "playwright";
import { adapters, enrichWithDetails } from "../adapters/index.js";
import { buildCampaigns } from "./build.js";
import type { SiteConfig, SiteResult } from "./types.js";

export type LogLevel = "info" | "warning";
export type OnLog = (site: SiteConfig, level: LogLevel, message: string) => void;

const DEFAULT_CONCURRENCY = Number(process.env.SCRAPER_CONCURRENCY ?? 3);
const DEBUG_DIR = path.resolve("data", "debug");

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36";

/* =========================
   TEK SİTE
========================= */

export async function scrapeSite(browser: Browser, site: SiteConfig, onLog?: OnLog): Promise<SiteResult> {
  const started = Date.now();
  const warnings: string[] = [];
  const log = {
    info: (msg: string) => onLog?.(site, "info", msg),
    warn: (msg: string) => warnings.push(msg)
  };
  const attempts = (site.retries ?? 1) + 1;
  let lastError: Error | undefined;
  let debugScreenshot: string | undefined;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    const context = await browser.newContext({
      userAgent: USER_AGENT,
      locale: "tr-TR",
      viewport: { width: 1440, height: 900 }
    });
    const page = await context.newPage();
    page.setDefaultTimeout(site.timeoutMs ?? 30_000);

    try {
      const listed = await adapters[site.adapter](page, site, log);
      const raws = await enrichWithDetails(page, site, listed, log);
      const { campaigns, warnings: health } = buildCampaigns(raws, site);
      warnings.push(...health);

      if (campaigns.length === 0) {
        debugScreenshot = await screenshot(page, site.id);
      }

      await context.close();
      return {
        siteId: site.id,
        name: site.name,
        ok: true,
        campaigns,
        warnings,
        durationMs: Date.now() - started,
        debugScreenshot
      };
    } catch (error) {
      lastError = error as Error;
      debugScreenshot = await screenshot(page, site.id);
      if (attempt < attempts) {
        onLog?.(site, "warning", `Deneme ${attempt} başarısız, tekrar deneniyor: ${lastError.message.split("\n")[0]}`);
      }
      await context.close().catch(() => {});
    }
  }

  return {
    siteId: site.id,
    name: site.name,
    ok: false,
    campaigns: [],
    warnings,
    error: lastError?.message.split("\n")[0] ?? "Bilinmeyen hata",
    durationMs: Date.now() - started,
    debugScreenshot
  };
}

async function screenshot(page: import("playwright").Page, siteId: string) {
  try {
    fs.mkdirSync(DEBUG_DIR, { recursive: true });
    const file = path.join(DEBUG_DIR, `${siteId}-${Date.now()}.png`);
    await page.screenshot({ path: file, fullPage: true });
    return file;
  } catch {
    return undefined;
  }
}

/* =========================
   ÇOKLU SİTE (tek browser, paralel)
========================= */

export async function runSites(
  sites: SiteConfig[],
  options: {
    concurrency?: number;
    onStart?: (site: SiteConfig) => void;
    onLog?: OnLog;
    onResult?: (result: SiteResult) => void;
    /** Hata veren siteleri en sonda bir kez daha dene (varsayılan: evet) */
    retryFailed?: boolean;
  } = {}
): Promise<SiteResult[]> {
  const concurrency = Math.max(1, options.concurrency ?? DEFAULT_CONCURRENCY);
  const browser = await chromium.launch({
    headless: process.env.HEADLESS !== "false",
    executablePath: process.env.CHROMIUM_PATH || undefined
  });
  const results: SiteResult[] = [];
  const queue = [...sites];

  try {
    const worker = async () => {
      for (let site = queue.shift(); site; site = queue.shift()) {
        options.onStart?.(site);
        const result = await scrapeSite(browser, site, options.onLog);
        results.push(result);
        options.onResult?.(result);
      }
    };
    await Promise.all(Array.from({ length: Math.min(concurrency, sites.length) }, worker));

    // İkinci tur: hata veren siteleri en sonda, tek tek ve daha uzun süre tanıyarak bir kez daha dene.
    // Gece ve yurt dışından (GitHub) bazı banka siteleri ilk istekte geç cevap veriyor.
    const failed = results.filter((r) => !r.ok);
    if (failed.length && options.retryFailed !== false) {
      await new Promise((resolve) => setTimeout(resolve, 20_000));
      for (const first of failed) {
        const site = sites.find((s) => s.id === first.siteId)!;
        options.onLog?.(site, "warning", `İkinci tur deneniyor (ilk hata: ${first.error})`);
        const slow = { ...site, timeoutMs: (site.timeoutMs ?? 30_000) * 2, retries: 0 };
        const second = await scrapeSite(browser, slow, options.onLog);
        if (second.ok) {
          second.warnings.unshift(`İlk denemede hata verdi, ikinci turda başarılı (${first.error})`);
          second.durationMs += first.durationMs;
          results[results.indexOf(first)] = second;
          options.onResult?.(second);
        }
      }
    }
  } finally {
    await browser.close();
  }

  return results;
}
