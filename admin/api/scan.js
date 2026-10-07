import { env, HttpError, requireAdmin, sendError } from "./_lib.js";

/*
 * "Şimdi tara" (GitHub Actions'taki tarama işi)
 *   GET  /api/scan → son çalışmalar (durum)
 *   POST /api/scan { sites: ["bonus"], publish: true, detailMax: 40 } → yeni tarama başlat
 * İkisi de admin girişi ister. GitHub token'ı sadece burada (sunucuda), tarayıcıya hiç gitmez.
 */
const WORKFLOW = "scrape.yml";

async function github(path, init = {}) {
  const token = env("GITHUB_TOKEN");
  const repo = env("GITHUB_REPO");
  if (!token || !repo) throw new HttpError(503, "GitHub bağlantısı ayarlı değil (GITHUB_TOKEN / GITHUB_REPO)");
  const res = await fetch(`https://api.github.com/repos/${repo}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "kartradar-admin",
      ...(init.body ? { "Content-Type": "application/json" } : {})
    }
  });
  if (!res.ok) {
    const text = await res.text();
    throw new HttpError(502, `GitHub ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.status === 204 ? null : res.json();
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  try {
    await requireAdmin(req);

    if (req.method === "GET") {
      const data = await github(`/actions/workflows/${WORKFLOW}/runs?per_page=8`);
      res.status(200).json({
        runs: (data.workflow_runs || []).map((r) => ({
          id: r.id,
          status: r.status, // queued | in_progress | completed
          conclusion: r.conclusion, // success | failure | cancelled | null
          event: r.event, // schedule | workflow_dispatch
          createdAt: r.created_at,
          updatedAt: r.updated_at,
          url: r.html_url
        }))
      });
      return;
    }

    if (req.method === "POST") {
      const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
      const sites = Array.isArray(body.sites) ? body.sites.filter((s) => /^[a-z0-9-]+$/.test(s)) : [];
      const detailMax = Math.min(Math.max(parseInt(body.detailMax ?? 40, 10) || 40, 1), 500);
      await github(`/actions/workflows/${WORKFLOW}/dispatches`, {
        method: "POST",
        body: JSON.stringify({
          ref: env("GITHUB_REF", "main"),
          inputs: {
            sites: sites.join(" "),
            publish: body.publish === false ? "false" : "true",
            detail_max: String(detailMax)
          }
        })
      });
      res.status(202).json({ ok: true });
      return;
    }

    res.setHeader("Allow", "GET, POST");
    res.status(405).json({ error: "Yöntem desteklenmiyor" });
  } catch (error) {
    sendError(res, error);
  }
}
