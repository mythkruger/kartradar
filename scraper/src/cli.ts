/*
 * Komut satırından tek/çoklu site denemek için:
 *   npm run scrape                 → tüm siteler
 *   npm run scrape -- beko ikea    → sadece seçilenler
 *   npm run scrape -- beko --show  → tarayıcıyı görerek
 *   npm run scrape -- --save       → sonuçları kaydet (admin panel + Firestore, ayarlıysa)
 *   npm run scrape -- --save --force  → Firestore'a değişiklik olmasa da yaz
 *   npm run scrape -- --dry        → Firestore'a bağlanmadan ne yazılacağını göster
 *   npm run scrape -- --save --no-publish → sadece yerel kayıt (detay önbelleği ısınır), Firestore'a yazma yok
 *
 * Varsayılan olarak sonuçları sadece ekrana basar. --save ile depoya da yazar.
 */
import { runSites } from "./core/engine.js";
import { syncSiteCampaigns } from "./services/campaignService.js";
import { publishResults } from "./scraper/index.js";
import { saveRunReport } from "./services/runReportService.js";
import { getEnabledSites, loadSites } from "./sites/index.js";

const startedAt = new Date();

const args = process.argv.slice(2);
if (args.includes("--show")) process.env.HEADLESS = "false";
const save = args.includes("--save") || args.includes("--dry");
const force = args.includes("--force");
// GitHub Actions'ta yayın saati olmayan taramalar: yerel kayıt + detay önbelleği, Firestore'a dokunma
const publish = !args.includes("--no-publish");
if (args.includes("--dry")) process.env.FIRESTORE_DRY_RUN = "1";
const ids = args.filter((a) => !a.startsWith("--"));
const all = await loadSites();
const sites = ids.length ? all.filter((s) => ids.includes(s.id)) : await getEnabledSites();

const unknown = ids.filter((id) => !all.some((s) => s.id === id));
if (unknown.length) {
  console.error(`Bilinmeyen site: ${unknown.join(", ")}\nMevcut: ${all.map((s) => s.id).join(", ")}`);
  process.exit(1);
}

const results = await runSites(sites, {
  onResult: (r) => {
    console.log(`\n=== ${r.name} (${r.siteId}) — ${r.ok ? "OK" : "HATA"} — ${r.campaigns.length} kampanya, ${(r.durationMs / 1000).toFixed(1)} sn`);
    if (r.error) console.log(`  hata: ${r.error}`);
    for (const w of r.warnings) console.log(`  uyarı: ${w}`);
    if (r.debugScreenshot) console.log(`  ekran görüntüsü: ${r.debugScreenshot}`);
    for (const c of r.campaigns.slice(0, 5)) {
      const b = c.benefit;
      const kazanc = [
        b.amount ? `${b.amount} TL` : null,
        b.percent ? `%${b.percent}` : null,
        b.installments ? `${b.installments} taksit` : null
      ].filter(Boolean).join(", ");
      console.log(`  - ${c.title}\n    ${c.url}`);
      console.log(`    tarih: ${c.startDate ?? "?"} → ${c.endDate ?? "?"} | sektör: ${c.sectors.join(",")} | kazanç: ${b.types.join("+") || "?"} ${kazanc} | min: ${b.minSpend ?? "-"} | katılım: ${c.join ?? "?"}`);
    }
    if (r.campaigns.length > 5) console.log(`  ... ve ${r.campaigns.length - 5} tane daha`);
  }
});

let firestoreReport: Parameters<typeof saveRunReport>[0]["firestore"];
if (save) {
  for (const r of results) if (r.ok && r.campaigns.length > 0) syncSiteCampaigns(r.siteId, r.campaigns);
  const res = publish
    ? await publishResults(results, sites, { force, fullRun: ids.length === 0 })
    : { enabled: false, message: "--no-publish: bu tarama yayınlanmadı (sadece yerel kayıt)", reads: 0, writes: 0, deletes: 0, outcomes: [] };
  console.log("\n=== Firestore");
  if (!res.enabled) console.log(`  YAYIN YAPILMADI → ${res.message}`);
  else {
    for (const o of res.outcomes) console.log(`  ${o.name}: ${o.message}`);
    if (res.message) console.log(`  ${res.message}`);
    console.log(`  ${res.reads} okuma, ${res.writes} yazma, ${res.deletes} silme.`);
  }
  firestoreReport = {
    published: res.enabled,
    message: res.message,
    reads: res.reads,
    writes: res.writes,
    deletes: res.deletes,
    outcomes: res.outcomes.map((o) => ({ name: o.name, action: o.action, message: o.message }))
  };
}

const failed = results.filter((r) => !r.ok);
const total = results.reduce((sum, r) => sum + r.campaigns.length, 0);
const port = process.env.PORT ?? 3000;

// Admin panel için rapor (sadece --save: GitHub Actions ve gerçek taramalar)
if (save) {
  await saveRunReport({
    kind: "scrape",
    ok: failed.length === 0,
    summary:
      `${total} kampanya, ${results.length - failed.length}/${results.length} site başarılı` +
      (failed.length ? ` — hata: ${failed.map((r) => r.name).join(", ")}` : ""),
    startedAt,
    sites: results.map((r) => ({
      id: r.siteId,
      name: r.name,
      ok: r.ok,
      count: r.campaigns.length,
      durationMs: r.durationMs,
      warnings: r.warnings,
      ...(r.error ? { error: r.error.slice(0, 500) } : {})
    })),
    firestore: firestoreReport
  });
}

console.log("\n----------------------------------------");
console.log(`Toplam ${total} kampanya, ${results.length - failed.length}/${results.length} site başarılı.`);
if (save) {
  console.log(`Sonuçlar kaydedildi. Panelde görmek için: npm run dev → http://localhost:${port}`);
} else {
  console.log("Sonuçlar kaydedilmedi. Panelde görmek için --save ile çalıştır:");
  console.log("  npm run scrape -- --save");
  console.log(`  npm run dev  → http://localhost:${port}`);
}
process.exit(failed.length ? 1 : 0);
