import assert from "node:assert/strict";
import { test } from "node:test";
import type { ProgramIndex } from "../src/services/firestoreService.js";
import { messageFor, planNotifications, programsToCheck, topicFor } from "../src/services/notifyService.js";

const index = (hashes: Record<string, string>): ProgramIndex => ({
  programs: Object.fromEntries(
    Object.entries(hashes).map(([id, hash]) => [id, { name: id === "axess" ? "Axess" : id, bank: "", hash, count: 0, updatedAt: 0, nextExpiry: null }])
  )
});
const doc = (hash: string, ids: string[], endDate: string | null = "2099-01-01") => ({
  hash,
  campaigns: ids.map((id) => ({ id, title: `Kampanya ${id}`, endDate }))
});

test("yeni kampanya bildirimi: ilk çalışma sessiz, sonra sadece yeniler, değişmeyen kart okunmaz", () => {
  // İlk çalışma: her kartın belgesi okunur, kaydedilir, bildirim gitmez
  let idx = index({ axess: "h1", world: "w1" });
  assert.deepEqual(programsToCheck(idx, {}, "1930"), ["axess", "world"]);
  let p = planNotifications(idx, {}, "1930", { axess: doc("h1", ["a", "b"]), world: doc("w1", ["x"]) }, "2026-10-07");
  assert.equal(p.sends.length, 0);
  let state = p.nextState;

  // Axess değişti ("c" geldi, "a" bitti), World aynı → sadece Axess okunur
  idx = index({ axess: "h2", world: "w1" });
  assert.deepEqual(programsToCheck(idx, state, "1930"), ["axess"]);
  p = planNotifications(idx, state, "1930", { axess: doc("h2", ["b", "c"]) }, "2026-10-08");
  assert.deepEqual(p.sends.map((s) => [s.programId, s.campaigns.map((c) => c.id)]), [["axess", ["c"]]]);
  assert.deepEqual(p.nextState["1930"]!.world, { hash: "w1", ids: ["x"] }); // dokunulmadı
  state = p.nextState;

  // Aynı veriyle tekrar: okuma yok, bildirim yok, yazma yok
  assert.deepEqual(programsToCheck(idx, state, "1930"), []);
  p = planNotifications(idx, state, "1930", {}, "2026-10-08");
  assert.equal(p.sends.length, 0);
  assert.equal(p.changed, false);

  // Öğle saati kendi kaydını tutar: ilk çalışmada sessiz, akşam kaydı korunur
  p = planNotifications(idx, state, "1230", { axess: doc("h2", ["b", "c"]), world: doc("w1", ["x"]) }, "2026-10-08");
  assert.equal(p.sends.length, 0);
  assert.ok(p.nextState["1930"]);
});

test("bitmiş kampanya yeni sayılmaz", () => {
  const idx = index({ axess: "h2" });
  const state = { "1930": { axess: { hash: "h1", ids: ["a"] } } };
  const p = planNotifications(idx, state, "1930", { axess: doc("h2", ["a", "eski"], "2020-01-01") }, "2026-10-08");
  assert.equal(p.sends.length, 0);
});

test("tek bildirim: kart başına sayı, çoktan aza", () => {
  assert.equal(topicFor("1930"), "yeni_1930");
  assert.deepEqual(messageFor([{ name: "World", count: 1 }, { name: "Axess", count: 3 }]), {
    title: "KartRadar",
    body: "Yeni kampanyalar radarımıza takıldı! Axess: 3 · World: 1"
  });
});
