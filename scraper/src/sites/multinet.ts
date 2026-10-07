import { fold } from "../core/text.js";
import { defineSite } from "../core/types.js";

/*
 * Multinet (yemek / yan hak kartı)
 * Liste: /bireysel-kampanyalar — tüm kampanyalar tek sayfada (.kampanya-item).
 * Detay: <main> içinde düz metin. Bitiş tarihi YAZMIYOR → kampanyalar süresiz görünür;
 *        Multinet kampanyayı sayfasından kaldırınca bizim listeden de düşer.
 * Çoğu kampanya MultiPay uygulamasından indirim koduyla kullanılıyor.
 *
 * Sadece duyuru olanları eliyoruz ("... ile online ödeme kolaylığı", "Temassız ödeme"):
 * bunlar kazanç sunmuyor, kartın nerede geçtiğini söylüyor.
 */
const ANNOUNCEMENT = /odeme (kolayligi|secenegi)|odeme yapmak artik|temassiz odeme/;

export default defineSite({
  id: "multinet",
  name: "Multinet",
  bank: "Multinet Up",
  baseUrl: "https://multinet.com.tr",
  startUrls: ["/bireysel-kampanyalar"],
  adapter: "listPage",
  waitFor: ".kampanya-item",
  list: {
    item: ".kampanya-item",
    fields: {
      title: "h5",
      campaignUrl: { sel: "h5 a", attr: "href" },
      imageUrl: { sel: ".hp-img img", attr: ["data-src", "src"] }
    }
  },
  detail: {
    root: "main",
    fields: {
      detailText: "main"
    }
  },
  datesFrom: ["detailText"],
  hooks: {
    transform: (raw) => {
      if (raw.title && ANNOUNCEMENT.test(fold(raw.title))) return null;
      return raw;
    }
  }
});
