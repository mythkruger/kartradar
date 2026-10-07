import assert from "node:assert/strict";
import { test } from "node:test";
import { publishCycle, resetLedgerForTesting, setFirestoreForTesting } from "../src/services/firestoreService.js";
import type { Campaign, SiteConfig } from "../src/core/types.js";

// Sahte Firestore: okuma/yazma/silme sayılarını tutar
const store = new Map<string, any>();
const count = { r: 0, w: 0, d: 0 };
const ref = (key: string) => ({ key, get: async () => { count.r++; const v = store.get(key); return { exists: !!v, get: (k: string) => v?.[k] }; } });
import os from "node:os";
import path from "node:path";
process.env.FIRESTORE_DRY_RUN = "";
process.env.KR_LEDGER_FILE = path.join(os.tmpdir(), `kr-ledger-test-${process.pid}.json`);
resetLedgerForTesting();
setFirestoreForTesting({
  programDoc: (id) => ref("p/" + id) as any,
  detailDoc: (id) => ref("d/" + id) as any,
  indexDoc: () => ref("meta") as any,
  metaDoc: (id) => ref("meta/" + id) as any,
  runDoc: (id) => ref("runs/" + id) as any,
  serverTimestamp: () => "TS" as any,
  batch: () => {
    const ops: (() => void)[] = [];
    return {
      set: (r: any, v: any) => ops.push(() => { count.w++; store.set(r.key, v); }),
      delete: (r: any) => ops.push(() => { count.d++; store.delete(r.key); }),
      commit: async () => ops.forEach((f) => f())
    } as any;
  }
});

const site = { id: "bonus", name: "Bonus", bank: "Garanti BBVA" } as SiteConfig;
const c = (id: string, endDate: string | null): Campaign => ({
  id, programId: "bonus", programName: "Bonus", bank: "Garanti BBVA", title: id, summary: null, imageUrl: null,
  url: "u/" + id, startDate: null, endDate, isActive: true, sectors: ["market"], merchant: null,
  benefit: { types: ["puan"], amount: 100, percent: null, installments: null, minSpend: null }, join: "app"
});

test("değişiklik yoksa yazma yok, eski kampanya yazılmaz, silinen program temizlenir", async () => {
  let r = await publishCycle([{ site, ok: true, campaigns: [c("a", "2099-01-01"), c("eski", "2020-01-01")] }]);
  assert.equal(r.writes, 2); // program + index
  assert.deepEqual(store.get("p/bonus").campaigns.map((x: any) => x.id), ["a"]);

  const before = { ...count };
  r = await publishCycle([{ site, ok: true, campaigns: [c("a", "2099-01-01")] }]);
  assert.equal(r.reads, 1);
  assert.equal(r.writes, 0);
  assert.equal(count.w, before.w);

  r = await publishCycle([{ site, ok: false, campaigns: [] }]);
  assert.equal(r.writes, 0); // hata veren programa dokunulmaz

  r = await publishCycle([], { allSiteIds: ["world"] });
  assert.equal(r.deletes, 1); // bonus artık config'te yok
  assert.equal(store.has("p/bonus"), false);
});

test("özetler ayrı belgede: listede özet yok, sadece değişen özet yazılır, kalkan silinir", async () => {
  resetLedgerForTesting();
  const withSummary = (id: string, summary: string | null) => ({ ...c(id, "2099-01-01"), summary });

  let r = await publishCycle([{ site, ok: true, campaigns: [withSummary("x", "Özet X"), withSummary("y", "Özet Y"), withSummary("z", null)] }]);
  assert.equal("summary" in store.get("p/bonus").campaigns[0], false); // liste özetsiz
  assert.equal(store.get("d/x").summary, "Özet X");
  assert.equal(store.get("d/y").programId, "bonus");
  assert.equal(store.has("d/z"), false); // özeti olmayana belge açılmaz

  // Sadece y'nin özeti değişti → 1 özet yazılır; liste aynı olduğu için program yazılmaz
  const w0 = count.w;
  r = await publishCycle([{ site, ok: true, campaigns: [withSummary("x", "Özet X"), withSummary("y", "Özet Y yeni"), withSummary("z", null)] }]);
  assert.equal(count.w - w0, 1);
  assert.equal(store.get("d/y").summary, "Özet Y yeni");

  // x kalktı → özeti silinir
  r = await publishCycle([{ site, ok: true, campaigns: [withSummary("y", "Özet Y yeni")] }]);
  assert.equal(store.has("d/x"), false);
  assert.ok(r.deletes >= 1);
});
