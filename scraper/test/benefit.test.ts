import assert from "node:assert/strict";
import { test } from "node:test";
import { parseBenefit, parseJoin } from "../src/core/benefit.js";

// Gerçek kampanya metinlerinden örnekler
const cases: [string, string, Partial<ReturnType<typeof parseBenefit>>][] = [
  ["Bonus / Migros Hemen",
   "Bonus'tan gençlere özel Migros Hemen'de 400 TL bonus! 1 - 30 Eylül tarihleri arasında, Migros Hemen'de her 1.000 TL ve üzeri alışverişe 100 TL, toplam 400 TL bonus verilecektir.",
   { types: ["puan"], amount: 400, minSpend: 1000 }],
  ["World / Gratis",
   "World’e özel 17 Eylül-16 Ekim 2026 tarihleri arasında gratis.com ve gratis mobil’de yapacağınız 1.000 TL ve üzeri alışverişinize 100 Worldpuan fırsatını kaçırmayın!",
   { types: ["puan"], minSpend: 1000 }],
  ["World / Shell",
   "Shell istasyonlarında 1.400 TL ve üzeri 4 harcamadan birini World Pay ile gerçekleştirenlere toplamda 450 TL’ye varan Worldpuan!",
   { types: ["puan"], amount: 450, minSpend: 1400 }],
  ["Maximum / Pazarama", "Pazarama'da Sepette %20 İndirim Fırsatı!", { types: ["indirim"], percent: 20 }],
  ["Maximum / ETS", "ETS’deki Seçili Oteller ve Turlarda 7.500 TL’ye Varan MaxiPuan Fırsatı!", { types: ["puan"], amount: 7500 }],
  ["Axess / Madame Coco",
   "Madame Coco’da 350 TL chip-para, üstelik peşin fiyatına 3 taksitle! 3.500 TL ve üzeri ilk alışverişinize 350 TL chip-para",
   { types: ["puan", "taksit"], amount: 350, installments: 3, minSpend: 3500 }],
  ["Axess / Dailydrive", "Dailydrive’da %30 indirim fırsatı", { types: ["indirim"], percent: 30 }],
  ["Bonus / Giyim", "Giyim, ayakkabı ve çanta alışverişlerinize toplam 1.500 TL bonus!", { types: ["puan"], amount: 1500 }],
  ["Taksit", "Beyaz eşya alışverişlerinize 12 aya varan taksit fırsatı", { types: ["taksit"], installments: 12 }],
  ["Ek taksit", "Seçili mağazalarda peşin fiyatına +3 taksit", { types: ["taksit"], installments: 3 }],
  ["Nakit iade", "Yurt dışı harcamalarınıza %5 nakit iade", { types: ["nakit"], percent: 5 }],
  ["Bankkart / A101", "A101 Marketler'de 1.500 TL Jest Lira", { types: ["puan"], amount: 1500 }],
  ["Bankkart / Okula dönüş", "Okula Dönüş Alışverişlerinize 15.000 TL'ye Varan Jest Lira", { types: ["puan"], amount: 15000 }],
  ["Multinet / Rafinera", "Rafinera Paketlerinde %25 İndirim Fırsatı!", { types: ["indirim"], percent: 25 }],
  ["Multinet / BinBin", "BinBin'de 250 TL Hediye Bakiye Fırsatı!", { types: ["nakit"], amount: 250 }],
  ["Setcard / Panço", "Flexlife bakiyenizle Panço'da %10 kartınıza iade fırsatı!", { types: ["nakit"], percent: 10 }],
  ["Advantage / Zara (virgüllü binlik)", "Zara, Massimo Dutti, Oysho mağazalarında 1,000 TL NakitPuan!", { types: ["puan"], amount: 1000 }],
  ["Advantage / Koton", "Koton mağazalarında 2,500 TL ve üzeri ilk alışverişe 250 TL değerinde NakitPuan!", { types: ["puan"], amount: 250, minSpend: 2500 }],
  ["Paraf / Market", "Market Harcamalarınıza 1.000 TL ParafPara", { types: ["puan"], amount: 1000 }],
  ["QNB / Şarj", "Elektrikli Araç Şarj İstasyonlarında 500 TL'ye varan ParaPuan kazanın!", { types: ["puan"], amount: 500 }],
  ["Enpara / Kahve", "750 TL’ye kadar olan harcamalarınızın %20’si bizden", { percent: null }],
  ["Bankkart / Monster", "Monster'da 10.000 TL Jest Lira ve 12 Taksit", { types: ["puan", "taksit"], amount: 10000, installments: 12 }],
];

for (const [name, text, expected] of cases) {
  test(`kazanç: ${name}`, () => {
    const got = parseBenefit(text);
    for (const [k, v] of Object.entries(expected)) {
      assert.deepEqual((got as Record<string, unknown>)[k], v, `${k} — bulunan: ${JSON.stringify(got)}`);
    }
  });
}

test("ipucu (World ödül tipi) türü ekler", () => {
  assert.deepEqual(parseBenefit("Kahve Dünyası'nda fırsat", "puan;taksit").types, ["puan", "taksit"]);
});

test("katılım şekli", () => {
  assert.equal(parseJoin(`ilk harcamadan önce Juzdan’dan “Hemen Katıl” butonunu tıklayın veya "MADAMECOCO" yazıp 4566’ya SMS gönderin`), "app");
  assert.equal(parseJoin(`BonusFlaş'tan "HEMEN KATIL"ın tıklanması gerekmektedir.`), "app");
  assert.equal(parseJoin(`MIGROS yazıp 3340'a SMS gönderin`), "sms");
  assert.equal(parseJoin(`Kampanyaya katılım gerektirmez.`), "auto");
  assert.equal(parseJoin(`Kampanya detayları için tıklayın`), null);
});

test("kazanç: '8.000 TL'yi aşan MaxiPuan'", () => {
  const b = parseBenefit("Maximum’dan Okula Dönüş Alışverişlerinizde 8.000 TL’yi aşan MaxiPuan Fırsatı!");
  assert.deepEqual(b.types, ["puan"]);
  assert.equal(b.amount, 8000);
});

test("kazanç: '%8'e varan ek indirim'", () => {
  const b = parseBenefit("ETS'deki seçili otellerde anında %8'e varan ek indirim kazanın!");
  assert.deepEqual(b.types, ["indirim"]);
  assert.equal(b.percent, 8);
});
