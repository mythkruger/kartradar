/*
 * robots.txt kontrolü — site sahibinin "otomatik programlar şu sayfalara girmesin" listesi.
 * Uymak yasal bir zorunluluk olmasa da iyi niyetin göstergesi. Her taramada kampanya listesi
 * sayfalarımızın yasaklı olup olmadığına bakıyoruz; yasaklıysa rapora uyarı düşer (admin panel).
 * Tarama yine yapılır; o kartı çıkarıp çıkarmamaya biz karar veririz.
 */
const cache = new Map<string, Promise<string | null>>();

async function fetchRobots(origin: string): Promise<string | null> {
  try {
    const res = await fetch(`${origin}/robots.txt`, { signal: AbortSignal.timeout(10_000) });
    return res.ok ? await res.text() : null;
  } catch {
    return null;
  }
}

/** "User-agent: *" grubunun kurallarına göre bu yol yasak mı? (en uzun eşleşen kural kazanır) */
export function isDisallowed(robots: string, pathname: string): boolean {
  const rules: Array<{ allow: boolean; path: string }> = [];
  let inStar = false;
  let sawRule = false;
  for (const raw of robots.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, "").trim();
    const m = line.match(/^([a-z-]+)\s*:\s*(.*)$/i);
    if (!m) continue;
    const key = m[1].toLowerCase();
    const value = m[2].trim();
    if (key === "user-agent") {
      if (sawRule) {
        inStar = false;
        sawRule = false;
      }
      if (value === "*") inStar = true;
    } else if (key === "allow" || key === "disallow") {
      sawRule = true;
      if (inStar && value) rules.push({ allow: key === "allow", path: value });
    }
  }
  const matches = (rule: string) => {
    const pattern = "^" + rule.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\\\$$/, "$");
    return new RegExp(pattern.endsWith("$") ? pattern : pattern).test(pathname);
  };
  const best = rules.filter((r) => matches(r.path)).sort((a, b) => b.path.length - a.path.length)[0];
  return best ? !best.allow : false;
}

/** Siteye ait sayfalardan robots.txt'nin yasakladıkları (boş = sorun yok) */
export async function robotsWarnings(baseUrl: string, paths: string[]): Promise<string[]> {
  const origin = new URL(baseUrl).origin;
  if (!cache.has(origin)) cache.set(origin, fetchRobots(origin));
  const robots = await cache.get(origin)!;
  if (!robots) return [];
  return paths
    .map((p) => new URL(p, baseUrl))
    .filter((u) => u.origin === origin && isDisallowed(robots, u.pathname))
    .map((u) => `robots.txt bu sayfaya otomatik erişimi yasaklıyor: ${u.pathname}`);
}
