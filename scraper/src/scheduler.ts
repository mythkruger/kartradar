import { BusyError, runScrapers } from "./scraper/index.js";
import { addLog } from "./services/scraperLogService.js";

/*
 * ÇARK: sunucu açık olduğu sürece belirlenen saatlerde tüm siteler taranır.
 *
 *  SCRAPE_TIMES   "00:05,09:00,15:00,21:00" (varsayılan). Türkiye saati. Her taramada
 *                 sonuçlar yerel depoya (admin panel) yazılır.
 *  PUBLISH_TIMES  "09:00,21:00" (varsayılan). Bu saatlerdeki taramalar Firestore'a da yayınlanır.
 *                 Seyrek yayın = kullanıcılar gün içinde aynı programı daha az yeniden indirir.
 *                 Biten kampanyaları uygulama kendisi gizlediği için gece yayını gerekmez.
 *                 "all" → her tarama yayınlanır.
 *  SCHEDULER=off  zamanlayıcıyı kapatır (sadece elle çalıştırma).
 *
 * Sunucu kapalıyken çark durur. Sürekli açık bir makine yoksa aynı işi
 * "npm run cycle" komutunu Windows Görev Zamanlayıcı / cron / Cloud Scheduler ile
 * çalıştırarak yapabilirsin (README.md).
 */

const DEFAULT_TIMES = "00:05,09:00,15:00,21:00";
const DEFAULT_PUBLISH_TIMES = "09:00,21:00";

const key = (t: { h: number; m: number }) => t.h * 60 + t.m;
const label = (t: { h: number; m: number }) => `${String(t.h).padStart(2, "0")}:${String(t.m).padStart(2, "0")}`;

let timer: NodeJS.Timeout | null = null;
let nextRunAt: Date | null = null;

function parseTimes(value: string) {
  return value
    .split(",")
    .map((t) => t.trim().match(/^(\d{1,2}):(\d{2})$/))
    .filter((m): m is RegExpMatchArray => Boolean(m))
    .map((m) => ({ h: Number(m[1]), m: Number(m[2]) }))
    .filter((t) => t.h < 24 && t.m < 60)
    .sort((a, b) => a.h * 60 + a.m - (b.h * 60 + b.m));
}

function computeNext(times: { h: number; m: number }[], from = new Date()) {
  for (let dayOffset = 0; dayOffset < 2; dayOffset++) {
    for (const t of times) {
      const d = new Date(from);
      d.setDate(d.getDate() + dayOffset);
      d.setHours(t.h, t.m, 0, 0);
      if (d > from) return d;
    }
  }
  return null;
}

export function getNextRunAt() {
  return nextRunAt;
}

export function startScheduler() {
  if (process.env.SCHEDULER === "off") {
    addLog("info", "Zamanlayıcı kapalı (SCHEDULER=off). Taramalar sadece elle başlatılır.");
    return;
  }

  const scrapeTimes = parseTimes(process.env.SCRAPE_TIMES ?? DEFAULT_TIMES);
  if (!scrapeTimes.length) {
    addLog("error", `SCRAPE_TIMES geçersiz: "${process.env.SCRAPE_TIMES}". Zamanlayıcı başlatılmadı.`);
    return;
  }
  const publishSetting = (process.env.PUBLISH_TIMES ?? DEFAULT_PUBLISH_TIMES).trim();
  const publishAll = publishSetting === "all";
  const publishTimes = publishAll ? scrapeTimes : parseTimes(publishSetting);
  const publishKeys = new Set(publishTimes.map(key));

  // Yayın saati tarama saatlerinde yoksa o saatte de tarama yapılır
  const times = [...scrapeTimes, ...publishTimes.filter((t) => !scrapeTimes.some((s) => key(s) === key(t)))].sort(
    (a, b) => key(a) - key(b)
  );

  const scheduleNext = () => {
    nextRunAt = computeNext(times);
    if (!nextRunAt) return;

    const delay = nextRunAt.getTime() - Date.now();
    const runAt = nextRunAt;
    timer = setTimeout(async () => {
      const publish = publishAll || publishKeys.has(runAt.getHours() * 60 + runAt.getMinutes());
      addLog("info", `Zamanlanmış tarama başladı${publish ? " (Firestore'a yayınlanacak)" : " (sadece yerel, yayın saati değil)"}.`);
      try {
        await runScrapers(undefined, { publish });
      } catch (error) {
        if (error instanceof BusyError) addLog("warning", "Zamanlanmış tarama atlandı: zaten çalışan bir tarama var.");
        else addLog("error", `Zamanlanmış tarama hata verdi: ${(error as Error).message}`);
      } finally {
        scheduleNext();
      }
    }, delay);
  };

  scheduleNext();
  addLog(
    "info",
    `Zamanlayıcı açık. Tarama: ${times.map(label).join(", ")}. ` +
      `Firestore yayını: ${publishAll ? "her tarama" : publishTimes.map(label).join(", ") || "yok"}. ` +
      `Sonraki tarama: ${formatTime(nextRunAt)}`
  );
}

export function stopScheduler() {
  if (timer) clearTimeout(timer);
  timer = null;
  nextRunAt = null;
}

export function formatTime(date: Date | null) {
  if (!date) return "-";
  return date.toLocaleString("tr-TR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}
