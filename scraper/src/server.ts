import express from "express";
import path from "path";
import { fileURLToPath } from "url";

import { getCampaigns, pruneEnded } from "./services/campaignService.js";
import { BusyError, isRunning, runScraper, runScrapers } from "./scraper/index.js";
import { formatTime, getNextRunAt, startScheduler } from "./scheduler.js";
import { getLogs } from "./services/scraperLogService.js";
import { getSite, loadSites } from "./sites/index.js";
import { SECTORS } from "./core/sectors.js";
import { MAX_DOC_BYTES, docBytes, toPublished } from "./services/firestoreService.js";

pruneEnded();

const app = express();

const PORT = Number(process.env.PORT ?? 3000);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.json());
app.use(express.static(path.join(__dirname, "../public")));

/* -------------------------
   SİTELER (frontend butonları buradan oluşur)
------------------------- */

app.get("/api/sites", async (req, res) => {
  const sites = await loadSites();
  res.json(
    sites.map((s) => ({
      id: s.id,
      name: s.name,
      bank: s.bank,
      enabled: s.enabled !== false
    }))
  );
});

/* -------------------------
   KAMPANYALAR
   ?all=1 → pasif kampanyaları da getir
------------------------- */

app.get("/api/campaigns", (req, res) => {
  res.json(getCampaigns({ includeInactive: req.query.all === "1" }));
});

/* -------------------------
   ÖZET: sektör adları + her programın Firestore belge boyutu tahmini
------------------------- */

app.get("/api/overview", async (req, res) => {
  const campaigns = getCampaigns();
  const sites = await loadSites();
  const programs = sites.map((s) => {
    const items = campaigns.filter((c) => c.programId === s.id).map(toPublished);
    const bytes = docBytes({ programId: s.id, programName: s.name, bank: s.bank, count: items.length, hash: "0000000000000000", campaigns: items });
    return { id: s.id, name: s.name, count: items.length, bytes, limit: MAX_DOC_BYTES };
  });
  res.json({ sectors: SECTORS, programs });
});

/* -------------------------
   TÜM SCRAPERLAR
------------------------- */

app.post("/api/scrape", async (req, res) => {
  try {
    const total = await runScrapers();
    res.json({ success: true, message: "Tüm scraperlar tamamlandı.", total });
  } catch (error) {
    if (error instanceof BusyError) {
      res.status(409).json({ success: false, message: error.message });
      return;
    }
    console.error(error);
    res.status(500).json({ success: false, message: "Scraper sırasında hata oluştu." });
  }
});

/* -------------------------
   TEK SİTE
------------------------- */

app.post("/api/scrape/:site", async (req, res) => {
  const siteId = req.params.site;

  if (!(await getSite(siteId))) {
    res.status(400).json({ success: false, message: "Geçersiz program." });
    return;
  }

  try {
    const total = await runScraper(siteId);
    res.json({ success: true, message: `${siteId} scraper tamamlandı.`, total });
  } catch (error) {
    if (error instanceof BusyError) {
      res.status(409).json({ success: false, message: error.message });
      return;
    }
    console.error(error);
    res.status(500).json({ success: false, message: `${siteId} scraper sırasında hata oluştu.` });
  }
});

/* -------------------------
   LOGLAR / DURUM
------------------------- */

app.get("/api/logs", (req, res) => {
  res.json(getLogs());
});

app.get("/api/status", (req, res) => {
  const campaigns = getCampaigns();
  const lastSeen = campaigns.map((c) => c.lastSeenAt).filter(Boolean).sort().pop() ?? null;

  res.json({
    status: isRunning() ? "running" : "ready",
    totalCampaigns: campaigns.length,
    lastRun: lastSeen,
    nextRun: getNextRunAt()?.toISOString() ?? null,
    nextRunText: formatTime(getNextRunAt())
  });
});

app.listen(PORT, async () => {
  const sites = await loadSites();
  const url = `http://localhost:${PORT}`;
  console.log("");
  console.log("  KartRadar scraper çalışıyor");
  console.log(`  Admin panel : ${url}`);
  console.log(`  API         : ${url}/api/campaigns`);
  console.log(`  Programlar  : ${sites.length} (${sites.map((s) => s.id).join(", ")})`);
  startScheduler();
  console.log(`  Sonraki otomatik tarama: ${formatTime(getNextRunAt())}`);
  console.log("");
});
