/** Türkçe karakterleri sadeleştir, küçült: "Çaydanlık" → "caydanlik" */
export function fold(text: string) {
  return text
    .toLocaleLowerCase("tr-TR")
    .replace(/ç/g, "c")
    .replace(/ğ/g, "g")
    .replace(/ı/g, "i")
    .replace(/ö/g, "o")
    .replace(/ş/g, "s")
    .replace(/ü/g, "u")
    .replace(/[âà]/g, "a")
    .replace(/[îì]/g, "i")
    .replace(/[ûù]/g, "u")
    .replace(/[’‘`´]/g, "'");
}

export function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** "1.500" → 1500, "1.500,50" → 1500.5, "450" → 450 */
export function parseTlNumber(value: string): number | null {
  const v = value.replace(/\s/g, "");
  // "1,500" / "12,500,000" → virgül binlik ayıracı
  if (/^\d{1,3}(,\d{3})+$/.test(v)) return Number(v.replace(/,/g, ""));
  if (!/^\d{1,3}(\.\d{3})*(,\d+)?$|^\d+(,\d+)?$/.test(v)) return null;
  const n = Number(v.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

/** Metni cümle sınırından kısalt */
export function shorten(text: string | null, max: number): string | null {
  if (!text) return null;
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const lastStop = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("! "));
  return (lastStop > max * 0.5 ? cut.slice(0, lastStop + 1) : cut.trimEnd() + "…").trim();
}
