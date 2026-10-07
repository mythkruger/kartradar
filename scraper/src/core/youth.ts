import { fold } from "./text.js";
import type { RawCampaign, SiteConfig } from "./types.js";

/*
 * GENÇ / ÖĞRENCİ KARTLARI
 * Bankalar gençlere özel kampanyaları ayrı bir sayfada değil, ana kampanya listesinde yayınlıyor.
 * Ayırt etmenin iki yolu var:
 *   1) Başlık: "Bonus Genç'le ...", "Bonus'tan gençlere özel ...", "Encard Genç ile ...", "Öğrencilere ..."
 *   2) Koşullar: "... Bankkart Jest, Prestij ve Bankkart Genç kartların ... dahildir"
 *                "Bankkart Genç, Başak ... ile yapılacak işlemler kampanyaya dahil değildir"
 * Genç kartı hiç geçmeyen kampanyayı göstermiyoruz: yanlış umut vermektense eksik kalsın.
 *
 * Kelime sınırına dikkat: "Gürgençler" (mağaza) genç kampanyası değil → \bgenc
 */
export type YouthStatus = "exclusive" | "included" | "excluded" | "unknown";

const EXCLUDE = /dahil degil|haric|kapsam(i)? disi|yararlanamaz|gecerli degil|katilamaz/;
const GENERIC_TITLE = /\bgenclere ozel|\bogrenci|\bkyk\b|\buniversiteli/;

/**
 * @param card  sadeleştirilmiş kart adı, ör. "bankkart genc", "bonus genc", "encard genc"
 */
export function youthStatus(card: string, title: string | null | undefined, detail: string | null | undefined): YouthStatus {
  const cardRe = new RegExp(`\\b${card.replace(/\s+/g, "\\s+")}`);
  const t = fold(title ?? "");
  if (cardRe.test(t) || GENERIC_TITLE.test(t)) return "exclusive";

  const sentences = fold(detail ?? "")
    .split(/(?<=[.!?;])\s+|\n+/)
    .filter((s) => cardRe.test(s) || GENERIC_TITLE.test(s));
  if (!sentences.length) return "unknown";

  // Aynı cümlede "dahil değildir" varsa genç kart hariç tutulmuş demektir
  if (sentences.some((s) => EXCLUDE.test(s))) return "excluded";
  const only = new RegExp(`(sadece|yalnizca|yalniz) ${card}|${card}('?(e|le|li|lilere))?( kart)?( sahip(ler)?i(ne|miz)?| musteri(ler)?i(ne|miz)?)? ozel|genclere ozel|ogrencilere ozel`);
  if (sentences.some((s) => only.test(s))) return "exclusive";
  return "included";
}

/**
 * Bir bankanın sitesinden genç kartı programı türet: aynı liste + aynı detay önbelleği
 * (detay sayfaları tekrar açılmaz), sadece genç kartın geçerli olduğu kampanyalar kalır.
 */
export function youthVariant(base: SiteConfig, opts: { id: string; name: string; card: string }): SiteConfig {
  return {
    ...base,
    id: opts.id,
    name: opts.name,
    hooks: {
      ...base.hooks,
      transform: (raw: RawCampaign) => {
        const r = base.hooks?.transform ? base.hooks.transform(raw) : raw;
        if (!r) return null;
        const s = youthStatus(opts.card, r.title, [r.description, r.detailText].filter(Boolean).join("\n"));
        return s === "exclusive" || s === "included" ? r : null;
      }
    }
  };
}
