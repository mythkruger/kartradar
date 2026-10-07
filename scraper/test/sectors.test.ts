import assert from "node:assert/strict";
import { test } from "node:test";
import { sectorsFor } from "../src/core/sectors.js";

test("bankaların kendi etiketleri", () => {
  assert.deepEqual(sectorsFor("market", ""), ["market"]);                         // Bonus
  assert.deepEqual(sectorsFor("giyim,mobilya,e-ticaret,ev-tekstili", ""), ["giyim", "mobilya", "e-ticaret"]);
  assert.deepEqual(sectorsFor("GİYİM-AKSESUAR", ""), ["giyim"]);                  // Maximum
  assert.deepEqual(sectorsFor("Gıda / Market Harcamaları", ""), ["market"]);      // World
  assert.deepEqual(sectorsFor("Akaryakıt & Otogaz", ""), ["akaryakit"]);
  assert.deepEqual(sectorsFor("tum-sektorler", ""), ["genel"]);
  assert.deepEqual(sectorsFor("isitmasogutma", ""), ["beyaz-esya"]);
});

test("etiket yoksa başlıktan", () => {
  assert.deepEqual(sectorsFor(null, "Shell istasyonlarında 450 TL Worldpuan"), ["akaryakit"]);
  assert.deepEqual(sectorsFor("diger", "Dailydrive'da %30 indirim"), ["diger"]);
  assert.deepEqual(sectorsFor(null, "Kampanyalar 22.09.2026 saat 16:15 ile"), ["diger"]); // "saat" giyim değil
  assert.deepEqual(sectorsFor(null, "İşCep aracılığıyla başvurun"), ["diger"]);             // "aracılığıyla" otomotiv değil
});
