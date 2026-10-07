import { defineSite, type RawCampaign } from "../core/types.js";

/*
 * QNB Kredi Kartı (eski adıyla CardFinans) — cardfinans.com.tr artık qnbcard.com.tr'ye yönleniyor.
 * Liste: JSON API /api/Campaigns?isArchived=false..., sayfa numarası "Page" header'ında
 *        (World ile aynı altyapı). Kayıtta tam metin (Content, HTML) da geldiği için
 *        detay sayfasına girmeye gerek yok; tarih ve koşullar oradan okunur.
 */
const API = "/api/Campaigns?isArchived=false&sectorId=&brandId=&categoryId=&keyword=&year=&month=";

export default defineSite({
  id: "qnb",
  name: "QNB",
  bank: "QNB",
  baseUrl: "https://www.qnbcard.com.tr",
  startUrls: ["/kampanyalar"],
  adapter: "custom",
  waitMs: 2000,
  run: async (page, { log }) => {
    const result = (await page.evaluate(`(async () => {
      const items = [];
      let total = 0;
      for (let p = 1; p <= 40; p++) {
        const res = await fetch(${JSON.stringify(API)}, { headers: { Page: String(p) } });
        if (!res.ok) break;
        const json = await res.json();
        total = json.TotalItems || 0;
        if (!json.Items || !json.Items.length) break;
        for (const it of json.Items) {
          const text = new DOMParser().parseFromString(it.Content || "", "text/html").body.textContent || "";
          items.push({
            id: it.Id,
            title: it.Title,
            slug: it.SeoProperty && it.SeoProperty.Name,
            text: text.replace(/\\s+/g, " ").trim(),
            hasImage: it.HasImage
          });
        }
        if (items.length >= total) break;
        await new Promise((r) => setTimeout(r, 300));
      }
      return { items, total };
    })()`)) as {
      items: Array<{ id: number; title: string; slug: string | null; text: string; hasImage: boolean }>;
      total: number;
    };

    log.info(`API: ${result.items.length}/${result.total} kampanya`);

    return result.items
      .filter((it) => it.slug)
      .map(
        (it): RawCampaign => ({
          title: it.title,
          campaignUrl: `/kampanyalar/${it.slug}`,
          imageUrl: it.hasImage ? `/medium/Campaign-ListImage-${it.id}-2x-webp.vsf` : null,
          detailText: it.text
        })
      );
  },
  datesFrom: ["detailText", "title"]
});
