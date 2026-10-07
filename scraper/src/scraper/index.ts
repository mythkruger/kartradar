import { runSites } from "../core/engine.js";
import type { SiteConfig, SiteResult } from "../core/types.js";
import { syncSiteCampaigns } from "../services/campaignService.js";
import { publishCycle } from "../services/firestoreService.js";
import { addLog } from "../services/scraperLogService.js";
import { getEnabledSites, getSite, loadSites } from "../sites/index.js";

/* Bir site sonucu geldiğinde: kaydet + logla */
function handleResult(result: SiteResult) {
  const name = result.name;
  const id = result.siteId;

  if (!result.ok) {
    addLog("error", `${name} scraper hata verdi: ${result.error}`, id);
  } else {
    // 0 sonuç genelde selector bozulması demek; mevcut listeye dokunmuyoruz.
    if (result.campaigns.length > 0) syncSiteCampaigns(result.siteId, result.campaigns);

    addLog(
      "success",
      `${name} tamamlandı: ${result.campaigns.length} kampanya (${(result.durationMs / 1000).toFixed(1)} sn).`,
      id
    );
  }

  for (const warning of result.warnings) addLog("warning", `${name}: ${warning}`, id);
  if (result.debugScreenshot) addLog("warning", `${name}: ekran görüntüsü → ${result.debugScreenshot}`, id);
}

/* Firestore'a yayınla: tek index okuması, sadece değişen programlar yazılır */
export async function publishResults(
  results: SiteResult[],
  sites: SiteConfig[],
  options: { force?: boolean; fullRun?: boolean } = {}
) {
  const runs = results.map((r) => ({
    site: sites.find((s) => s.id === r.siteId)!,
    ok: r.ok,
    campaigns: r.campaigns
  }));

  const allSiteIds = options.fullRun ? (await loadSites()).map((s) => s.id) : undefined;
  const res = await publishCycle(runs, { force: options.force, allSiteIds });

  if (!res.enabled) {
    addLog("info", res.message ?? "Firestore kapalı");
    return res;
  }

  for (const o of res.outcomes) {
    const level = o.action === "error" ? "error" : o.action === "skipped" ? "warning" : "info";
    addLog(level, `${o.name}: Firestore → ${o.message}`, o.siteId);
  }
  if (res.message) addLog(res.message.startsWith("Firestore hatası") ? "error" : "info", res.message);

  addLog(
    "info",
    `Firestore işlem özeti: ${res.reads} okuma, ${res.writes} yazma, ${res.deletes} silme.`
  );
  return res;
}

/* Aynı anda tek çalışma (panel butonu + zamanlayıcı çakışmasın) */
let running = false;

export function isRunning() {
  return running;
}

async function exclusive<T>(fn: () => Promise<T>): Promise<T> {
  if (running) throw new BusyError();
  running = true;
  try {
    return await fn();
  } finally {
    running = false;
  }
}

export class BusyError extends Error {
  constructor() {
    super("Zaten çalışan bir scraper var.");
  }
}

const hooks = {
  onStart: (site: SiteConfig) => addLog("info", `${site.name} taraması başladı.`, site.id),
  onLog: (site: SiteConfig, level: "info" | "warning", message: string) =>
    addLog(level, `${site.name}: ${message}`, site.id),
  onResult: handleResult
};

export async function runScraper(siteId: string) {
  const site = await getSite(siteId);
  if (!site) throw new Error(`Bilinmeyen site: ${siteId}`);

  return exclusive(async () => {
    const [result] = await runSites([site], hooks);
    await publishResults([result], [site]);

    if (!result.ok) throw new Error(result.error);
    return result.campaigns.length;
  });
}

/**
 * @param options.publish false → sonuçlar sadece yerel depoya yazılır (zamanlayıcıda yayın saati değilse).
 *                        Elle başlatılan taramalar (panel, CLI) her zaman yayınlanır.
 */
export async function runScrapers(sites?: SiteConfig[], options: { publish?: boolean } = {}) {
  const publish = options.publish ?? true;
  return exclusive(async () => {
    const list = sites ?? (await getEnabledSites());
    addLog("info", `${list.length} site için scraper başladı.`);

    const results = await runSites(list, hooks);
    // Tüm siteler tarandıysa config'ten kaldırılan programlar da Firestore'dan silinir
    if (publish) await publishResults(results, list, { fullRun: !sites });
    else addLog("info", "Firestore'a yayın yapılmadı: bu saat yayın saati değil (PUBLISH_TIMES).");

    const total = results.reduce((sum, r) => sum + r.campaigns.length, 0);
    const failed = results.filter((r) => !r.ok).map((r) => r.name);

    addLog(
      failed.length ? "warning" : "success",
      `Tüm scraperlar bitti. Toplam ${total} kampanya.` +
        (failed.length ? ` Hata veren: ${failed.join(", ")}` : "")
    );

    return total;
  });
}
