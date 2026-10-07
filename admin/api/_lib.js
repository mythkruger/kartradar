import crypto from "node:crypto";

/*
 * Vercel fonksiyonlarının ortak parçası.
 * Dosya adı "_" ile başladığı için Vercel bunu adres (route) olarak yayınlamaz.
 *
 * Vercel → Project → Settings → Environment Variables:
 *   FIREBASE_WEB_CONFIG  Firebase Console → Proje ayarları → Web uygulaması → firebaseConfig (JSON olarak)
 *   ADMIN_EMAIL          panele girebilecek tek Google hesabı
 *   GITHUB_TOKEN         "Şimdi tara" için: sadece kartradar reposunda Actions: Read and write yetkili token
 *   GITHUB_REPO          ör. kullanici/kartradar
 *   GITHUB_REF           (isteğe bağlı) dal adı, varsayılan main
 */

export const env = (name, fallback = "") => process.env[name] ?? fallback;

/**
 * Firebase Console'dan kopyalanan ayar. Hem JSON ({"apiKey": "..."}) hem de Console'daki
 * JavaScript yazımı ({ apiKey: "...", } — tırnaksız anahtar, sonda virgül) kabul edilir.
 */
export function webConfig() {
  const raw = env("FIREBASE_WEB_CONFIG").trim().replace(/;$/, "");
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    try {
      const json = raw
        .replace(/^\s*\/\/.*$/gm, "") // yorum satırları (https:// adreslerine dokunmaz)
        .replace(/'/g, '"')
        .replace(/([{,]\s*)([A-Za-z_$][\w$]*)\s*:/g, '$1"$2":')
        .replace(/,\s*}/g, "}");
      return JSON.parse(json);
    } catch {
      return null;
    }
  }
}

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

/* ---------- Firebase giriş belirtecini (ID token) doğrula ----------
 * Panel her istekte "Authorization: Bearer <token>" gönderir. Google'ın açık anahtarlarıyla
 * imzayı kontrol edip e-postanın admin olduğuna bakıyoruz. Service account anahtarı GEREKMEZ.
 */
const CERTS_URL = "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com";
let certCache = { at: 0, certs: null };

async function googleCerts() {
  if (certCache.certs && Date.now() - certCache.at < 60 * 60 * 1000) return certCache.certs;
  const res = await fetch(CERTS_URL);
  if (!res.ok) throw new HttpError(502, "Google anahtarları alınamadı");
  certCache = { at: Date.now(), certs: await res.json() };
  return certCache.certs;
}

const b64json = (part) => JSON.parse(Buffer.from(part, "base64url").toString("utf8"));

export async function requireAdmin(req) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  const parts = token.split(".");
  if (parts.length !== 3) throw new HttpError(401, "Giriş gerekli");

  const [h64, p64, s64] = parts;
  let head, payload;
  try {
    head = b64json(h64);
    payload = b64json(p64);
  } catch {
    throw new HttpError(401, "Geçersiz giriş");
  }

  const certs = await googleCerts();
  const cert = head.alg === "RS256" ? certs[head.kid] : null;
  if (!cert) throw new HttpError(401, "Geçersiz giriş");
  const valid = crypto.createVerify("RSA-SHA256").update(`${h64}.${p64}`).verify(cert, Buffer.from(s64, "base64url"));
  if (!valid) throw new HttpError(401, "Geçersiz giriş");

  const projectId = webConfig()?.projectId;
  const now = Date.now() / 1000;
  if (!projectId || payload.aud !== projectId || payload.iss !== `https://securetoken.google.com/${projectId}`) {
    throw new HttpError(401, "Geçersiz giriş");
  }
  if (payload.exp < now || payload.iat > now + 60) throw new HttpError(401, "Oturum süresi doldu, tekrar giriş yap");

  const admin = env("ADMIN_EMAIL").toLowerCase();
  if (!admin || payload.email?.toLowerCase() !== admin || payload.email_verified !== true) {
    throw new HttpError(403, "Bu panel sana kapalı");
  }
  return payload;
}

export function sendError(res, error) {
  const status = error instanceof HttpError ? error.status : 500;
  res.status(status).json({ error: error.message || "Hata" });
}
