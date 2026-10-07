import { fold } from "../core/text.js";
import { defineSite } from "../core/types.js";

/*
 * Enpara (QNB) — Enpara Kredi Kartı, Encard, Encard Genç
 * Liste: /kampanyalar — tek sayfa. Üstte bir öne çıkan kampanya (görselinin alt metni başlık),
 *        altında a.enpara-campaigns__campaign-item kartları (title niteliği başlık).
 * Detay: .enpara-campaign-detail__summary (tarih + özet), .enpara-campaign-detail__content (koşullar).
 * Kart dışı bankacılık kampanyalarını (mevduat, faiz, tavsiye, Findeks, ATM) eliyoruz.
 */
const NOT_CARD = /mevduat|\bfaiz(i|in)?\b|birikim hesab|tavsiye|findeks|para cekme|enparalisi/;

export default defineSite({
  id: "enpara",
  name: "Enpara",
  bank: "Enpara (QNB)",
  baseUrl: "https://www.enpara.com",
  startUrls: ["/kampanyalar"],
  adapter: "listPage",
  waitFor: "section.enpara-campaigns",
  list: {
    item: "section.enpara-campaigns a[href*='kampanyalar/']",
    fields: {
      title: { self: true, attr: "title" },
      description: { sel: "img", attr: "alt" },
      campaignUrl: { self: true, attr: "href" },
      imageUrl: { sel: ["img.show-only-desktop", "img"], attr: "src" }
    }
  },
  detail: {
    root: ".enpara-campaign-detail",
    fields: {
      title: "h1",
      dateText: ".enpara-campaign-detail__summary",
      detailText: ".enpara-campaign-detail__content"
    }
  },
  datesFrom: ["dateText", "detailText"],
  // Öne çıkan kampanyanın title niteliği yok → başlık görselin alt metninden
  hooks: {
    transform: (raw) => {
      const title = raw.title || raw.description;
      if (!title) return raw;
      if (NOT_CARD.test(fold(title)) || NOT_CARD.test(fold(raw.campaignUrl ?? ""))) return null;
      return { ...raw, title };
    }
  }
});
