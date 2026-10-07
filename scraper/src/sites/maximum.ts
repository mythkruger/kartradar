import { defineSite } from "../core/types.js";

/*
 * Maximum (İş Bankası)
 * Liste: /kampanyalar — aktif kampanyalar div[campid], sektörler "cat297" gibi class'larda.
 *        Sayfada bitmiş kampanyalar da var ("SÜRESİ BİTTİ"); onlar campid taşımıyor.
 * Detay: tarih ".date" içinde ("1.9.2026 - 30.9.2026").
 */
export default defineSite({
  id: "maximum",
  name: "Maximum",
  bank: "İş Bankası",
  baseUrl: "https://www.maximum.com.tr",
  startUrls: ["/kampanyalar"],
  adapter: "listPage",
  waitFor: "div[campid]",
  list: {
    item: "div.col[campid]",
    fields: {
      title: { sel: ["h3.card-text", "h3"] },
      campaignUrl: { sel: "a[href*='/kampanyalar/']", attr: "href" },
      imageUrl: { sel: "img", attr: ["src", "data-src"] },
      category: { self: true, attr: "data-kr-category" }
    }
  },
  detail: {
    fields: {
      dateText: ".campaign-detail-title .date",
      detailText: { sel: [".campaign-detail-content", ".campaign-detail", "main"] }
    }
  },
  datesFrom: ["dateText", "detailText"],
  hooks: {
    // Sektör class'larını (cat297) okunabilir ada çevirip her karta data-kr-category olarak yaz
    beforeExtract: async (page) => {
      await page.evaluate(`(() => {
        const names = {};
        document.querySelectorAll("li[catfid]").forEach((li) => {
          names["cat" + li.getAttribute("catfid")] = li.innerText.trim().split("\\n")[0];
        });
        document.querySelectorAll("div.col[campid]").forEach((el) => {
          const cats = [...el.classList].filter((c) => names[c]).map((c) => names[c]);
          el.setAttribute("data-kr-category", cats.join(", "));
        });
      })()`);
    }
  }
});
