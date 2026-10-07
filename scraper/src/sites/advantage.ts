import { fold } from "../core/text.js";
import { defineSite, type RawCampaign } from "../core/types.js";

/*
 * Advantage (HSBC) — advantage.com.tr artık hsbc.com.tr'ye yönleniyor.
 * Liste: /kartlar-ve-krediler/kampanyalar/guncel-kampanyalar?page=N (sayfa başına 10, ~3-4 sayfa)
 *        .campaign-list .row → h2 a (başlık + link), img, p (kısa açıklama).
 * Detay: .fullwidthcampaign ("Kampanya 01-24 Ekim 2026 tarihleri arasında ...").
 * Kart dışı bankacılık duyurularını (hesap, faiz, pay senedi, davet) eliyoruz.
 * Not: HSBC tutarları virgülle yazıyor ("1,000 TL") — ayrıştırıcı bunu tanıyor.
 */
const NOT_CARD = /pay senedi|hesap|hos geldin faizi|davet et|mevduat|yatirim/;
const LIST = "/kartlar-ve-krediler/kampanyalar/guncel-kampanyalar";

export default defineSite({
  id: "advantage",
  name: "Advantage",
  bank: "HSBC",
  baseUrl: "https://www.hsbc.com.tr",
  startUrls: [LIST],
  adapter: "custom",
  waitFor: ".campaign-list",
  run: async (page, { log }) => {
    const items = (await page.evaluate(`(async () => {
      const seen = new Map();
      for (let p = 1; p <= 30; p++) {
        const res = await fetch(${JSON.stringify(LIST)} + "?page=" + p);
        if (!res.ok) break;
        const doc = new DOMParser().parseFromString(await res.text(), "text/html");
        let added = 0;
        for (const row of doc.querySelectorAll(".campaign-list .row")) {
          const a = row.querySelector("h2 a");
          if (!a) continue;
          const href = a.getAttribute("href");
          if (seen.has(href)) continue;
          seen.set(href, {
            title: a.textContent.replace(/\\s+/g, " ").trim(),
            campaignUrl: href,
            imageUrl: row.querySelector("img") ? row.querySelector("img").getAttribute("src") : null,
            description: row.querySelector("p") ? row.querySelector("p").textContent.replace(/\\s+/g, " ").trim() : null
          });
          added++;
        }
        if (!added) break;
        await new Promise((r) => setTimeout(r, 400));
      }
      return [...seen.values()];
    })()`)) as RawCampaign[];

    log.info(`Liste sayfaları: ${items.length} kampanya`);
    return items;
  },
  detail: {
    root: ".fullwidthcampaign",
    fields: {
      detailText: ".fullwidthcampaign"
    }
  },
  datesFrom: ["detailText", "description"],
  hooks: {
    transform: (raw) => (raw.title && NOT_CARD.test(fold(raw.title)) ? null : raw)
  }
});
