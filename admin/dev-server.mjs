/*
 * Paneli bilgisayarda denemek için (Vercel'e yüklemeden):
 *   1) admin/.env.local dosyasını oluştur (git'e girmez), içine:
 *        FIREBASE_WEB_CONFIG={"apiKey":"...","authDomain":"...","projectId":"...", ...}
 *        ADMIN_EMAIL=senin@gmail.com
 *        (isteğe bağlı) GITHUB_TOKEN=...   GITHUB_REPO=kullanici/kartradar
 *   2) cd admin && npm run dev   →  http://localhost:5173
 * Vercel'de aynı dosyalar aynı şekilde çalışır (api/ klasörü = sunucu fonksiyonları).
 */
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT || 5173);

// .env.local → process.env
// Çok satıra bölünmüş JSON da kabul edilir: "{" ile başlayan değer, parantezler kapanana kadar devam eder.
try {
  const lines = fs.readFileSync(path.join(root, ".env.local"), "utf8").replace(/^\uFEFF/, "").split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (!m || lines[i].trim().startsWith("#")) continue;
    let value = m[2].trim();
    const depth = (s) => (s.match(/{/g) || []).length - (s.match(/}/g) || []).length;
    while (value.startsWith("{") && depth(value) > 0 && i + 1 < lines.length) value += "\n" + lines[++i];
    value = value.trim().replace(/;$/, "").replace(/^(['"])([\s\S]*)\1$/, "$2");
    process.env[m[1]] ??= value;
  }
} catch {
  console.warn("admin/.env.local bulunamadı: Firebase ayarları olmadan panel giriş ekranında kalır.");
}

const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml", ".json": "application/json" };

http
  .createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);

    // Vercel'in res.status().json() kısayolları
    res.status = (code) => ((res.statusCode = code), res);
    res.json = (obj) => {
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.end(JSON.stringify(obj));
    };

    if (url.pathname.startsWith("/api/")) {
      const name = url.pathname.slice(5).replace(/[^a-z0-9-]/gi, "");
      const file = path.join(root, "api", `${name}.js`);
      if (!name || name.startsWith("_") || !fs.existsSync(file)) return res.status(404).json({ error: "Yok" });
      let raw = "";
      for await (const chunk of req) raw += chunk;
      try {
        req.body = raw ? JSON.parse(raw) : undefined;
      } catch {
        req.body = raw;
      }
      const mod = await import(`${pathToFileURL(file).href}?t=${Date.now()}`);
      return mod.default(req, res);
    }

    const rel = url.pathname === "/" ? "index.html" : url.pathname.slice(1);
    const file = path.join(root, rel);
    if (!file.startsWith(root) || rel.startsWith("api") || rel.startsWith(".") || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.statusCode = 404;
      return res.end("Bulunamadı");
    }
    res.setHeader("Content-Type", types[path.extname(file)] || "application/octet-stream");
    fs.createReadStream(file).pipe(res);
  })
  .listen(port, () => console.log(`KartRadar admin → http://localhost:${port}`));
