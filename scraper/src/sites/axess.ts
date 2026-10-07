import { defineSite, type RawCampaign } from "../core/types.js";

/*
 * Axess (Akbank)
 * Liste: ilk 9 kampanya sayfada, devamı "Daha Fazlasını Göster" ile
 *        /ajax/kampanya-ajax.aspx?page=N adresinden HTML parçası olarak geliyor.
 *        Parçaları sayfanın içinden çekip aynı kart yapısından okuyoruz.
 *        AJAX kartlarındaki metin kısaltılmış ("... peşin 7..."), bu yüzden gerçek başlık
 *        detay sayfasından alınır; detayı henüz çekilmemiş kampanyada başlık URL'den üretilir.
 * Detay: başlık h2.pageTitle, koşullar ve tarih ".cmsContent" içinde
 *        ("2 – 30 Eylül 2026 tarihleri arasında ...").
 */
export default defineSite({
  id: "axess",
  name: "Axess",
  bank: "Akbank",
  baseUrl: "https://www.axess.com.tr",
  startUrls: ["/kampanyalar"],
  adapter: "custom",
  waitFor: ".campaingBox",
  run: async (page, { log }) => {
    const items = (await page.evaluate(`(async () => {
      const read = (root) => [...root.querySelectorAll(".campaingBox")].map((box) => {
        const text = (box.querySelector(".textArea p")?.textContent || "").replace(/\s+/g, " ").trim();
        const cut = /(\.\.\.|…)$/.test(text);
        return {
        title: cut ? null : text,
        description: cut ? text.replace(/(\.\.\.|…)$/, "").trim() : null,
        campaignUrl: box.querySelector("a.dLink, a[href]")?.getAttribute("href") || null,
        imageUrl: box.querySelector("img")?.getAttribute("src") || null
        };
      });
      const out = read(document);
      for (let p = 2; p <= 40; p++) {
        const res = await fetch("/ajax/kampanya-ajax.aspx?checkBox=%5B0%5D&searchWord=%22%22&page=" + p);
        if (!res.ok) break;
        const html = await res.text();
        const doc = new DOMParser().parseFromString(html, "text/html");
        const got = read(doc);
        if (!got.length) break;
        out.push(...got);
        await new Promise((r) => setTimeout(r, 300));
      }
      return out;
    })()`)) as RawCampaign[];

    log.info(`Liste + AJAX sayfaları: ${items.length} kampanya`);
    return items;
  },
  detail: {
    root: ".campaingDetailText",
    fields: {
      title: "h2.pageTitle",
      detailText: ".cmsContent"
    }
  },
  datesFrom: ["detailText", "description", "title"],
  titleFallback: "url"
});
