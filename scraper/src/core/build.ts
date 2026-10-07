import { parseBenefit, parseJoin } from "./benefit.js";
import { parseDateRange, parseSingleDate, today } from "./dates.js";
import { absoluteUrl, clean, imageUrl, makeId, stripQuotes, titleFromUrl } from "./normalize.js";
import { sectorsFor } from "./sectors.js";
import { shorten } from "./text.js";
import type { Campaign, RawCampaign, RawField, SiteConfig } from "./types.js";

/**
 * Ham kayıtları (selector / API çıktısı) Campaign'e çevirir:
 * tarih, sektör, kazanç ve katılım şeklini çıkarır, doğrular, tekrarları atar,
 * sağlık uyarıları üretir.
 */
export function buildCampaigns(
  raws: RawCampaign[],
  site: SiteConfig
): { campaigns: Campaign[]; warnings: string[] } {
  const warnings: string[] = [];
  const byId = new Map<string, Campaign>();
  const required: RawField[] = ["title", "campaignUrl", ...(site.required ?? [])];
  const now = new Date().toISOString();
  const todayStr = today();
  const excludeRe = site.excludeTitle ? new RegExp(site.excludeTitle.toLocaleLowerCase("tr-TR")) : null;
  let dropped = 0;
  let ended = 0;

  for (const original of raws) {
    const raw = site.hooks?.transform ? site.hooks.transform({ ...original }) : original;
    if (!raw) {
      dropped++;
      continue;
    }

    let url = absoluteUrl(raw.campaignUrl, site.baseUrl);
    if (!url && site.urlFallback === "page") url = absoluteUrl(raw.pageUrl, site.baseUrl);

    let title = stripQuotes(clean(raw.title));
    if (!title && site.titleFallback === "url") title = titleFromUrl(url);

    if (title && excludeRe?.test(title.toLocaleLowerCase("tr-TR"))) continue;

    const candidate: RawCampaign = { ...raw, title, campaignUrl: url };
    if (required.some((field) => !clean(candidate[field]))) {
      dropped++;
      continue;
    }

    /* ---- tarih ---- */
    let startDate = parseSingleDate(raw.startDate);
    let endDate = parseSingleDate(raw.endDate);
    if (!startDate && !endDate) {
      for (const field of site.datesFrom ?? ["dateText", "detailText", "description", "title"]) {
        const range = parseDateRange(raw[field]);
        if (range.startDate || range.endDate) {
          ({ startDate, endDate } = range);
          break;
        }
      }
    }
    if (endDate && endDate < todayStr) {
      ended++;
      continue; // bitmiş kampanya hiç yayınlanmaz
    }

    /* ---- metinden çıkarımlar ---- */
    const fullText = [title, raw.description, raw.detailText].filter(Boolean).join(" \n");
    const benefit = parseBenefit(fullText, raw.benefitHint);
    const summarySource = clean(raw.description) ?? clean(raw.detailText);

    const campaign: Campaign = {
      id: site.idFrom === "title" ? makeId(site.id, "", title!) : makeId(site.id, url!, title!),
      programId: site.id,
      programName: site.name,
      bank: site.bank,
      title: title!,
      summary: summarySource && summarySource !== title ? shorten(summarySource, 300) : null,
      imageUrl: imageUrl(raw.imageUrl, site.baseUrl),
      url: url!,
      startDate,
      endDate,
      isActive: true,
      sectors: sectorsFor(clean(raw.category), `${title} ${raw.merchant ?? ""}`),
      merchant: clean(raw.merchant),
      benefit,
      join: parseJoin(fullText),
      lastSeenAt: now
    };

    if (!byId.has(campaign.id)) byId.set(campaign.id, campaign);
  }

  const campaigns = [...byId.values()];

  /* ---- sağlık kontrolü ---- */
  if (raws.length === 0) {
    warnings.push("Hiç kampanya bulunamadı — selector ya da API değişmiş olabilir.");
  } else if (campaigns.length === 0 && ended < raws.length) {
    warnings.push(`${raws.length} kayıt bulundu ama hiçbiri geçerli değil (başlık/URL boş).`);
  } else if (campaigns.length) {
    if (dropped > 0) warnings.push(`${dropped} kayıt eksik alan nedeniyle atıldı.`);
    const pct = (n: number) => Math.round((n / campaigns.length) * 100);
    const noDate = campaigns.filter((c) => !c.endDate).length;
    const noBenefit = campaigns.filter((c) => c.benefit.types.length === 0).length;
    if (pct(noDate) > 40) warnings.push(`Kampanyaların %${pct(noDate)}'inde bitiş tarihi bulunamadı.`);
    if (pct(noBenefit) > 40) warnings.push(`Kampanyaların %${pct(noBenefit)}'inde kazanç türü bulunamadı.`);
  }

  return { campaigns, warnings };
}
