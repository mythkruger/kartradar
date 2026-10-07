import { today } from "../core/dates.js";
import { defineSite } from "../core/types.js";

/*
 * Bankkart (Ziraat Bankası) — Bankkart Genç dahil
 * Liste: /kampanyalar — bireysel kampanyalar tek sayfada (a.campaign-box).
 *        Kartın arka yüzünde sektör etiketleri (.back .tags span), önünde
 *        "Son Gün 19.10.2026" veya "Son 10 Saat" yazıyor.
 * Detay: kampanya dönemi (.campdate: "01 - 30 Eylül 2026") ve koşullar (.detail-content).
 *        Koşullarda genelde "Bankkart Jest, Prestij, Prestij Plus ve Bankkart Genç
 *        kartların kredi kartı özelliği dahildir" yazıyor → Genç kart sahipleri de görür.
 */
export default defineSite({
  id: "bankkart",
  name: "Bankkart",
  bank: "Ziraat Bankası",
  baseUrl: "https://www.bankkart.com.tr",
  startUrls: ["/kampanyalar"],
  adapter: "listPage",
  waitFor: "a.campaign-box",
  list: {
    item: "a.campaign-box",
    fields: {
      title: { sel: [".front .h4", ".front h4", ".back h4"] },
      campaignUrl: { self: true, attr: "href" },
      imageUrl: { sel: ".front img", attr: ["data-src", "src"] },
      category: { sel: ".back .tags span", all: true },
      // Liste tarihi: detay gelmeden önce yedek bitiş tarihi
      endDate: ".front .date"
    }
  },
  detail: {
    root: ".subpage-detail",
    fields: {
      dateText: ".campdate",
      detailText: ".detail-content"
    }
  },
  datesFrom: ["dateText", "detailText"],
  hooks: {
    transform: (raw) => {
      const out = { ...raw };
      // Detaydaki kampanya dönemi varsa o kullanılır (başlangıç tarihi de içinde)
      if (out.dateText) out.endDate = null;
      // "Son 10 Saat" → bugün bitiyor
      else if (out.endDate && /son\s+\d+\s+saat/i.test(out.endDate)) out.endDate = today();
      return out;
    }
  }
});
