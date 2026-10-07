import { defineSite } from "../core/types.js";

/*
 * Bonus (Garanti BBVA)
 * Liste: /kampanyalar — tüm kampanyalar tek sayfada (~200+), her kartta sektör ve marka
 *        data-attribute olarak var.
 * Detay: tarih ("1 - 30 Eylül 2026") ve koşullar detay sayfasında. Sadece yeni kampanyaların
 *        detayına girilir (core/detailCache.ts).
 */
export default defineSite({
  id: "bonus",
  name: "Bonus",
  bank: "Garanti BBVA",
  baseUrl: "https://www.bonus.com.tr",
  startUrls: ["/kampanyalar"],
  adapter: "listPage",
  waitFor: "ul.campaign-list li.campaign-box",
  list: {
    item: "ul.campaign-list li.campaign-box",
    fields: {
      title: "h2.campaign-box__title",
      campaignUrl: { sel: "a.direct", attr: "href" },
      imageUrl: { sel: ["img", "source"], attr: ["data-src", "src", "data-srcset"] },
      category: { self: true, attr: "data-sector" },
      merchant: { self: true, attr: "data-brand" }
    }
  },
  detail: {
    root: ".campaign-detail__content",
    fields: {
      dateText: "p.campaign-date",
      detailText: ".campaign-detail__info--left"
    }
  },
  datesFrom: ["dateText", "detailText"],
  excludeTitle: "garantipay",
  hooks: {
    transform: (raw) => ({
      ...raw,
      // data-brand slug: "migros-hemen" → "Migros Hemen"; "bonus" genel kampanya → marka yok
      merchant:
        raw.merchant && raw.merchant !== "bonus"
          ? raw.merchant
              .split("-")
              .map((w) => w.charAt(0).toLocaleUpperCase("tr-TR") + w.slice(1))
              .join(" ")
          : null
    })
  }
});
