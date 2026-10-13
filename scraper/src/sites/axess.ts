import { defineSite, type RawCampaign } from "../core/types.js";

/*
 * Axess (Akbank)
 * Liste: kampanyalar sayfası + sektör/kategori sayfaları (/axess/kampanyalar/<kategori>).
 *        Her sayfadaki kampanya kartlarını okuyup birleştiriyoruz (aynı kampanya bir kez).
 *
 *        NOT: Eskiden "Daha Fazlasını Göster"in kullandığı /ajax/kampanya-ajax.aspx adresinden
 *        tüm listeyi çekiyorduk. Axess'in robots.txt'si /ajax/ ve .aspx adreslerine otomatik
 *        erişimi yasaklıyor; bu yüzden artık sadece normal sayfaları okuyoruz. Bazı kategorilerin
 *        devamı ("Daha fazla") gelmeyebilir; liste eskisinden biraz kısa olabilir.
 *
 *        Kart metni kısaltılmışsa ("... peşin 7...") gerçek başlık detay sayfasından alınır;
 *        detayı henüz çekilmemiş kampanyada başlık URL'den üretilir.
 * Detay: başlık h2.pageTitle, koşullar ve tarih ".cmsContent" içinde
 *        ("2 – 30 Eylül 2026 tarihleri arasında ...").
 */
const READ_CARDS = `(() => [...document.querySelectorAll(".campaingBox")].map((box) => {
  const text = (box.querySelector(".textArea p")?.textContent || "").replace(/\\s+/g, " ").trim();
  const cut = /(\\.\\.\\.|…)$/.test(text);
  return {
    title: cut ? null : text,
    description: cut ? text.replace(/(\\.\\.\\.|…)$/, "").trim() : null,
    campaignUrl: box.querySelector("a.dLink, a[href]")?.getAttribute("href") || null,
    imageUrl: box.querySelector("img")?.getAttribute("src") || null
  };
}))()`;

/** Kategori sayfaları: /axess/kampanyalar/<tek-parça> (biten kampanyalar hariç) */
const READ_CATEGORIES = `(() => [...new Set([...document.querySelectorAll("a[href]")]
  .map((a) => a.getAttribute("href") || "")
  .filter((h) => /^\\/axess\\/kampanyalar\\/[a-z0-9-]+\\/?$/i.test(h) && !/biten-kampanyalar/i.test(h)))])()`;

export default defineSite({
  id: "axess",
  name: "Axess",
  bank: "Akbank",
  baseUrl: "https://www.axess.com.tr",
  startUrls: ["/kampanyalar"],
  adapter: "custom",
  waitFor: ".campaingBox",
  run: async (page, { site, log }) => {
    const all = new Map<string, RawCampaign>();
    const add = (list: RawCampaign[]) => {
      for (const c of list) if (c.campaignUrl && !all.has(c.campaignUrl)) all.set(c.campaignUrl, c);
    };

    add((await page.evaluate(READ_CARDS)) as RawCampaign[]);
    const categories = ((await page.evaluate(READ_CATEGORIES)) as string[]).slice(0, 30);

    for (const path of categories) {
      try {
        await page.goto(new URL(path, site.baseUrl).href, { waitUntil: "domcontentloaded" });
        await page.waitForSelector(".campaingBox", { timeout: 8_000 }).catch(() => {});
        add((await page.evaluate(READ_CARDS)) as RawCampaign[]);
      } catch (error) {
        log.warn(`Kategori okunamadı: ${path} (${(error as Error).message.split("\n")[0]})`);
      }
      await page.waitForTimeout(700); // siteyi yormamak için
    }

    log.info(`Ana sayfa + ${categories.length} kategori: ${all.size} kampanya`);
    return [...all.values()];
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
