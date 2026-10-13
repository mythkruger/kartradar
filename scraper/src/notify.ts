/*
 * Yeni kampanya bildirimlerini gönder (GitHub Actions 12:30 ve 19:30'da çalıştırır).
 *   npm run notify -- --slot 1930          → gönder
 *   npm run notify -- --slot 1230 --dry    → ne gideceğini göster, gönderme / kaydetme
 *   npm run notify -- --slot 1930 --test   → telefonda denemek için sahte bildirim (kayda dokunmaz)
 * Saat verilmezse o anki saate en yakın dilim seçilir.
 */
import { saveRunReport } from "./services/runReportService.js";
import { runNotifications, sendTestNotification, SLOTS, type Slot } from "./services/notifyService.js";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry");
const i = args.indexOf("--slot");
let slot = (i >= 0 ? args[i + 1] : undefined) as Slot | undefined;
if (!slot) slot = new Date().getHours() < 16 ? "1230" : "1930";
if (!SLOTS.includes(slot)) {
  console.error(`Geçersiz saat: ${slot}. Seçenekler: ${SLOTS.join(", ")}`);
  process.exit(1);
}

const startedAt = new Date();

/** En fazla 2,5 saat gecikmeye izin ver (12:30 → 15:00'e kadar, 19:30 → 22:00'ye kadar) */
const LATE_LIMIT_MIN = 150;

// Zamanlanmış çalışma saatinden çok geç kaldıysa (ör. GitHub yedeği gece başladı) bildirim GÖNDERME:
// gece yarısı bildirimi istemiyoruz. Yeni kampanyalar bir sonraki bildirim saatinde gider.
const minutesLate = minutesAfterSlotTR(slot);
if (process.env.KR_TRIGGER === "zamanlanmış" && !dryRun && minutesLate > LATE_LIMIT_MIN) {
  const message = `${slot.slice(0, 2)}:${slot.slice(2)} bildirimi ${minutesLate} dk geç başladı, gönderilmedi (sonraki saate kaldı)`;
  console.log(message);
  await saveRunReport({ kind: "notify", ok: true, summary: message, startedAt, notify: { slot, message, sent: [] } });
  process.exit(0);
}

const r = args.includes("--test") ? await sendTestNotification(slot) : await runNotifications(slot, { dryRun });
console.log(`=== Yeni kampanya bildirimleri (${slot.slice(0, 2)}:${slot.slice(2)})`);
for (const s of r.sent) console.log(`  ${s.topic}: ${s.title} — ${s.body}`);
console.log(`  ${r.message}`);
console.log(`  ${r.reads} okuma, ${r.writes} yazma`);
if (!dryRun && !args.includes("--test")) {
  await saveRunReport({
    kind: "notify",
    ok: r.ok,
    summary: r.message,
    startedAt,
    notify: { slot, message: r.message, sent: r.sent.map(({ topic, count, body }) => ({ topic, count, body })) }
  });
}
process.exit(r.ok ? 0 : 1);

/** Türkiye saatine göre bu saatin (bugünkü ya da dünkü) üzerinden kaç dakika geçti. Birkaç dk erkense 0. */
function minutesAfterSlotTR(s: string) {
  const tr = new Date(Date.now() + 3 * 60 * 60 * 1000);
  const now = tr.getUTCHours() * 60 + tr.getUTCMinutes();
  const at = Number(s.slice(0, 2)) * 60 + Number(s.slice(2));
  const diff = (now - at + 1440) % 1440;
  return diff > 1440 - 20 ? 0 : diff;
}
