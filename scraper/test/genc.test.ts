import assert from "node:assert/strict";
import { test } from "node:test";
import { gencStatus } from "../src/sites/bankkart-genc.js";

// Bankkart kampanya koşullarından gerçek cümleler
test("Genç dahil (kredi kartı özelliği listesi)", () => {
  assert.equal(
    gencStatus("A101 Marketler'de 1.500 TL Jest Lira",
      "Kampanyaya yalnızca Bireysel Bankkart'ınızın kredi kartı özelliği ile yapılacak işlemler dahildir (Bankkart Jest, Bankkart Prestij, Prestij Plus ve Bankkart Genç kartların kredi kartı özelliği). Bankkart Başak, Bankkart Business ve Bankkart Jest Ücretsiz kartlar ile yapılacak işlemler dahil değildir."),
    "included");
});

test("Genç dahil (sahibi müşterilerimiz için geçerlidir)", () => {
  assert.equal(
    gencStatus("ŞOK Marketler'de 1.500 TL Jest Lira",
      "Kampanya Bankkart Jest, Bankkart Prestij, Prestij Plus ve Bankkart Genç sahibi müşterilerimiz için geçerlidir."),
    "included");
});

test("Genç hariç", () => {
  assert.equal(
    gencStatus("İlk Bankkart Kredi Kartınıza 5.000 TL Jest Lira",
      "Bankkart Genç, Bankkart Ticari, Bankkart Başak, Bankkart Business ve Bankkart Jest Ücretsiz ürünleri ile yapılacak işlemler kampanyaya dahil değildir."),
    "excluded");
});

test("Genç'e özel", () => {
  assert.equal(gencStatus("Bankkart Genç'e Özel Yemeksepeti'nde 200 TL Jest Lira", null), "exclusive");
  assert.equal(gencStatus("Sinema bileti fırsatı", "Kampanya yalnızca Bankkart Genç sahiplerine özeldir."), "exclusive");
});

test("Koşullarda Genç geçmiyor → bilinmiyor (gösterilmez)", () => {
  assert.equal(gencStatus("Carrefoursa'da peşin fiyatına 5 taksit", "Bireysel Bankkart kredi kartınızla ..."), "unknown");
});

import { youthStatus } from "../src/core/youth.js";

test("Bonus Genç başlıkları (gerçek)", () => {
  assert.equal(youthStatus("bonus genc", "Bonus Genç'le market alışverişlerine 400 TL bonus!", null), "exclusive");
  assert.equal(youthStatus("bonus genc", "Bonus'tan gençlere özel Migros Hemen'de 400 TL bonus!", null), "exclusive");
  assert.equal(youthStatus("bonus genc", "Teknosa'da 1.000 TL bonus!", "Bireysel Bonus kartlarla..."), "unknown");
});

test("Mağaza adı genç değildir: Gürgençler", () => {
  assert.equal(youthStatus("bonus genc", "Gürgençler'de peşin fiyatına 6 aya varan taksit", null), "unknown");
});

test("Encard Genç", () => {
  assert.equal(youthStatus("encard genc", "Encard Genç ile yapılan harcamalarda 500 TL’ye kadar iade bizden!", null), "exclusive");
  assert.equal(youthStatus("encard genc", "Öğrencilere özel 100 TL", null), "exclusive");
});
