/*
 * Yedek zamanlanmış iş için: bu saatin (slot) taraması son 12 saatte zaten yapıldı mı?
 *   npx tsx src/check-slot.ts scrape-0843
 * GitHub Actions çıktısına skip=true|false yazar. Yapıldıysa iş tarayıcı kurmadan biter.
 * Firestore: 1 sorgu (son 12 saatin raporları, birkaç belge).
 */
import fs from "node:fs";
import { connectFirebase } from "./services/firestoreService.js";

const slot = process.argv[2] ?? "";
let skip = false;

if (slot) {
  try {
    const { db } = await connectFirebase();
    if (db) {
      const since = new Date(Date.now() - 12 * 60 * 60 * 1000);
      const snap = await db.runsCollection().where("startedAt", ">=", since).get();
      skip = snap.docs.some((d) => d.get("schedule") === slot);
    }
  } catch (error) {
    console.warn(`Kontrol yapılamadı, tarama yine de yapılacak: ${(error as Error).message.split("\n")[0]}`);
  }
}

console.log(skip ? `${slot} bugün zaten tarandı → yedek iş atlanıyor.` : `${slot || "(saat yok)"} için tarama yapılacak.`);
if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `skip=${skip}\n`);
process.exit(0);
