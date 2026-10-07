import { defineSite, type RawCampaign } from "../core/types.js";

/*
 * Paraf (Halkbank)
 * Liste: sayfa "Daha Fazla" ile açılıyor ama arkasında tek bir JSON var:
 *        /content/parafcard/tr/kampanyalar/_jcr_content/root/responsivegrid/filter.filtercampaigns.all.json
 *        Her kayıtta başlık, URL, görsel. Sektör URL'nin ilk parçasında (/kampanyalar/market/...).
 * Detay: tarih ve koşullar .cmp-text bloklarında ("Kampanya 1-31 Ekim 2026 tarihleri arasında...").
 */
const API = "/content/parafcard/tr/kampanyalar/_jcr_content/root/responsivegrid/filter.filtercampaigns.all.json";

export default defineSite({
  id: "paraf",
  name: "Paraf",
  bank: "Halkbank",
  baseUrl: "https://www.paraf.com.tr",
  startUrls: ["/tr/kampanyalar.html"],
  adapter: "custom",
  waitMs: 2000,
  run: async (page, { log }) => {
    const items = (await page.evaluate(`(async () => {
      const res = await fetch(${JSON.stringify(API)});
      if (!res.ok) return [];
      const json = await res.json();
      return Object.values(json);
    })()`)) as Array<Record<string, string | null>>;

    log.info(`API: ${items.length} kampanya`);

    return items.map(
      (it): RawCampaign => ({
        title: it.title,
        description: it.teaserDescription || it.description,
        campaignUrl: it.url,
        imageUrl: it.teaserImage,
        // /tr/kampanyalar/beyaz-esya-ve-elektronik/... → "beyaz esya ve elektronik"
        category: (it.url ?? "").split("/kampanyalar/")[1]?.split("/")[0]?.replace(/-/g, " ") ?? null
      })
    );
  },
  detail: {
    root: "body",
    fields: {
      detailText: { sel: ".cmp-text", all: true }
    }
  },
  datesFrom: ["detailText", "description"]
});
