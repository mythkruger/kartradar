import crypto from "node:crypto";
import { dispatch, env, HttpError, sendError } from "./_lib.js";

/*
 * ZAMANLAYICI GİRİŞİ (cron-job.org çağırır)
 *
 * GitHub'ın kendi zamanlayıcısı saatlerce gecikebildiği için asıl saatler cron-job.org'da.
 * cron-job.org tam saatinde bu adresi çağırır, biz de ilgili GitHub işini HEMEN başlatırız:
 *   https://<panel>.vercel.app/api/cron?job=scrape-0843&key=<CRON_SECRET>
 *
 * Güvenlik: CRON_SECRET (Vercel ortam değişkeni) bilinmeden hiçbir iş başlatılamaz.
 * Anahtar adreste (?key=) ya da "Authorization: Bearer <CRON_SECRET>" başlığında gelebilir.
 *
 * Saatler (Türkiye):              job
 *   00:17 tarama (ısınma)          scrape-0017
 *   08:43 tarama + yayın           scrape-0843
 *   12:30 bildirim (öğle)          notify-1230
 *   15:13 tarama (ısınma)          scrape-1513
 *   19:30 bildirim (akşam)         notify-1930
 *   20:43 tarama + yayın           scrape-2043
 * Değiştirirsen: .github/workflows/*.yml (yedek saatler) ve admin/app.js (SCHEDULE) ile uyumlu tut.
 */
const JOBS = {
  "scrape-0017": ["scrape.yml", { publish: "false", slot_id: "scrape-0017" }],
  "scrape-0843": ["scrape.yml", { publish: "true", slot_id: "scrape-0843" }],
  "scrape-1513": ["scrape.yml", { publish: "false", slot_id: "scrape-1513" }],
  "scrape-2043": ["scrape.yml", { publish: "true", slot_id: "scrape-2043" }],
  "notify-1230": ["notify.yml", { slot: "1230", dry: "false", slot_id: "notify-1230" }],
  "notify-1930": ["notify.yml", { slot: "1930", dry: "false", slot_id: "notify-1930" }]
};

function authorized(req, url) {
  const secret = env("CRON_SECRET");
  if (secret.length < 16) throw new HttpError(503, "CRON_SECRET ayarlı değil (en az 16 karakter)");
  const header = req.headers.authorization || "";
  const given = header.startsWith("Bearer ") ? header.slice(7) : url.searchParams.get("key") || "";
  const a = Buffer.from(given);
  const b = Buffer.from(secret);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  try {
    const url = new URL(req.url, "http://localhost");
    if (!authorized(req, url)) throw new HttpError(401, "Yetkisiz");
    const job = url.searchParams.get("job") || "";
    const target = JOBS[job];
    if (!target) throw new HttpError(400, `Bilinmeyen iş: ${job}. Geçerli: ${Object.keys(JOBS).join(", ")}`);
    await dispatch(target[0], target[1]);
    res.status(202).json({ ok: true, job, startedAt: new Date().toISOString() });
  } catch (error) {
    sendError(res, error);
  }
}
