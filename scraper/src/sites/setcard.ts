import { defineSite } from "../core/types.js";

/*
 * Setcard (yemek kartı)
 * Liste: /kampanyalar — sayfa tarayıcıda oluşuyor (Next.js). Sadece "Güncel Kampanyalar"
 *        bölümünü (#guncel_kampanyalar) okuyoruz; "Geçmiş Kampanyalar" bitmiş olanlar.
 * Detay: tarih <article> içindeki <time> ("01.11.2023 - 31.12.2026"),
 *        metin .campaign-content.
 */
export default defineSite({
  id: "setcard",
  name: "Setcard",
  bank: "Setcard",
  baseUrl: "https://www.setcard.com.tr",
  startUrls: ["/kampanyalar"],
  adapter: "listPage",
  waitFor: "#guncel_kampanyalar a",
  list: {
    item: "#guncel_kampanyalar a",
    fields: {
      title: "h3",
      campaignUrl: { self: true, attr: "href" },
      imageUrl: { sel: "img", attr: ["src"] }
    }
  },
  detail: {
    root: "article",
    fields: {
      dateText: "time",
      detailText: ".campaign-content"
    }
  },
  datesFrom: ["dateText", "detailText"]
});
