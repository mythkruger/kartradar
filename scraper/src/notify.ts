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
