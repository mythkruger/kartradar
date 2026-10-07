import { env, webConfig } from "./_lib.js";

/*
 * Panelin Firebase ayarları. Bu değerler gizli değildir (her web uygulamasında tarayıcıya gider),
 * ama repoda durmasın diye Vercel ortam değişkeninden geliyor.
 */
export default function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.status(200).json({
    firebase: webConfig(),
    adminEmail: env("ADMIN_EMAIL"),
    scanEnabled: Boolean(env("GITHUB_TOKEN") && env("GITHUB_REPO"))
  });
}
