import assert from "node:assert/strict";
import { test } from "node:test";
import { parseDateRange } from "../src/core/dates.js";
import advantage from "../src/sites/advantage.js";
import enpara from "../src/sites/enpara.js";

// Yeni sitelerin gerçek metinlerinden tarih örnekleri
test("tarih biçimleri (Enpara, HSBC, QNB, Paraf)", () => {
  assert.deepEqual(parseDateRange("1 Şubat 2026 - 31 Ekim 2026 tarihleri arasında"), { startDate: "2026-02-01", endDate: "2026-10-31" });
  assert.deepEqual(parseDateRange("Kampanya 01-24 Ekim 2026 tarihleri arasında"), { startDate: "2026-10-01", endDate: "2026-10-24" });
  assert.deepEqual(parseDateRange("Kampanya 15 Eylül 2026 – 15 Ekim 2026 tarihleri arasında geçerlidir."), { startDate: "2026-09-15", endDate: "2026-10-15" });
  assert.deepEqual(parseDateRange("Kampanya 1-31 Ekim 2026 tarihleri arasında geçerlidir."), { startDate: "2026-10-01", endDate: "2026-10-31" });
});

const keep = (site: typeof enpara, raw: Record<string, string | null>) => site.hooks!.transform!(raw as never) !== null;

test("Enpara: kart dışı bankacılık kampanyaları elenir", () => {
  assert.equal(keep(enpara, { title: "Kahve keyfinizin 150 TL’si bizden!", campaignUrl: "kampanyalar/kahve-kampanyasi" }), true);
  assert.equal(keep(enpara, { title: "Eğitim, sağlık harcamalarınızı faizsiz sonradan taksitlendirin", campaignUrl: "kampanyalar/egitim" }), true);
  assert.equal(keep(enpara, { title: "Mevduatlarınıza İyi ki Bizimlesiniz Faizi", campaignUrl: "kampanyalar/mevduatlariniza-iyi-ki-bizimlesiniz-faizi" }), false);
  assert.equal(keep(enpara, { title: "Tavsiye et kazan", campaignUrl: "kampanyalar/tavsiye-kampanyasi" }), false);
  // Öne çıkan kampanyada başlık görselin alt metninden gelir
  const r = enpara.hooks!.transform!({ title: null, description: "ChatGPT ve Gemini üyelik ücretlerinizin 250 TL’si bizden!", campaignUrl: "kampanyalar/chatgpt" } as never);
  assert.equal(r?.title, "ChatGPT ve Gemini üyelik ücretlerinizin 250 TL’si bizden!");
});

test("Advantage: hesap / yatırım duyuruları elenir", () => {
  assert.equal(keep(advantage, { title: "3 ay boyunca komisyonsuz pay senedi işlemi imkânı!" }), false);
  assert.equal(keep(advantage, { title: "HSBC Premier’e Davet Et Kazan!" }), false);
  assert.equal(keep(advantage, { title: "IKEA'da Peşin Fiyatına 6 Taksit!" }), true);
});
