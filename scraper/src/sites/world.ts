import { defineSite, type RawCampaign } from "../core/types.js";

/*
 * World (Yapı Kredi)
 * Sitenin kendi JSON API'si var: GET /api/campaigns, sayfa numarası "Page" header'ında.
 * Her kayıtta başlık, uzun açıklama (koşullar), başlangıç/bitiş tarihi, görsel,
 * ödül tipi (107 Worldpuan, 108 Taksit, 109 İndirim) ve sektör ID'si geliyor.
 * İstekler sayfanın içinden atılır (tarayıcının çerezleri/başlıklarıyla).
 */

const REWARD_TYPES: Record<string, string> = { "107": "puan", "108": "taksit", "109": "indirim" };

export default defineSite({
  id: "world",
  name: "World",
  bank: "Yapı Kredi",
  baseUrl: "https://www.worldcard.com.tr",
  startUrls: ["/kampanyalar"],
  adapter: "custom",
  waitMs: 2000,
  run: async (page, { log }) => {
    const result = (await page.evaluate(`(async () => {
      // Sektör ID → ad (sayfadaki filtre sekmelerinden)
      const sectors = {};
      document.querySelectorAll("[data-id]").forEach((el) => {
        if (/^[0-9a-f]{8}-/.test(el.dataset.id)) sectors[el.dataset.id] = el.textContent.trim();
      });
      const items = [];
      let total = 0;
      for (let p = 1; p <= 40; p++) {
        const res = await fetch("/api/campaigns", { headers: { Page: String(p) } });
        if (!res.ok) break;
        const json = await res.json();
        total = json.TotalItems || 0;
        if (!json.Items || !json.Items.length) break;
        items.push(...json.Items);
        if (items.length >= total) break;
        await new Promise((r) => setTimeout(r, 300));
      }
      return { items, total, sectors };
    })()`)) as {
      items: Array<Record<string, string | null>>;
      total: number;
      sectors: Record<string, string>;
    };

    log.info(`API: ${result.items.length}/${result.total} kampanya`);

    return result.items.map(
      (it): RawCampaign => ({
        title: it.SpotTitle || it.PageTitle,
        description: it.Title,
        campaignUrl: it.Url,
        imageUrl: it.ImageUrl,
        startDate: it.StartDate,
        endDate: it.EndDate,
        category: it.Category ? result.sectors[it.Category] ?? null : null,
        benefitHint: (it.Type ?? "")
          .split(";")
          .map((t) => REWARD_TYPES[t.trim()])
          .filter(Boolean)
          .join(";")
      })
    );
  }
});
