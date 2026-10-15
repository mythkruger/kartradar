# KartRadar · Bakım ve anahtarlar

Bu dosyada gizli değer YOKTUR; sadece hangi anahtarın nerede durduğu ve nasıl yenileneceği yazar.
Gizli değerleri asla bu repoya, bir dosyaya ya da sohbete yapıştırma.

---

## 1. Anahtarlar nerede?

| Anahtar | Ne işe yarar | Nerede saklanıyor | Süresi |
|---|---|---|---|
| **Firebase yönetici anahtarı** (service account JSON) | Scraper ve bildirim işi Firestore'a yazar, bildirim gönderir | Bilgisayarda `C:\Users\Deep_\personalprojects\firebase_keys\kartradar.json` + GitHub secret `FIREBASE_SERVICE_ACCOUNT_JSON` | Süresiz (yılda bir yenilemek önerilir) |
| **GitHub token** (`kartradar_admin`) | Admin paneldeki "Şimdi tara" ve cron-job.org → GitHub işlerini başlatır | Vercel ortam değişkeni `GITHUB_TOKEN` | **1 yıl** (GitHub süre dolmadan e-posta atar) |
| **Cron anahtarı** | cron-job.org'un panelin `/api/cron` adresini çağırabilmesi | Vercel `CRON_SECRET` + cron-job.org'daki 6 işin adresinde (`&key=...`) | Süresiz |
| **Firebase web ayarı** | Admin panelinin Firebase'e bağlanması | Vercel `FIREBASE_WEB_CONFIG` + bilgisayarda `admin/.env.local` | Gizli değil, değişmez |
| **Uygulama ayar dosyaları** | Mobil uygulamanın Firebase'e bağlanması | `lib/firebase_options.dart`, `android/app/google-services.json` — **uygulama reposunda** (`kartradar-app`), git'e girmez | Gizli değil; kaybolursa `flutterfire configure` ile yeniden oluşur |

Vercel'deki diğer değişkenler (gizli değil): `ADMIN_EMAIL`, `GITHUB_REPO`.

---

## 2. GitHub token'ı yenileme (yılda bir)

1. GitHub → sağ üst profil → **Settings** → **Developer settings** → **Personal access tokens** → **Fine-grained tokens**
2. `kartradar_admin` → **Regenerate token** → süre: 1 yıl → **Regenerate**
   (Yetkiler aynı kalır: sadece `kartradar` reposu, **Actions: Read and write**)
3. Çıkan `github_pat_...` değerini kopyala
4. Vercel → proje → **Settings** → **Environment Variables** → `GITHUB_TOKEN` → **Edit** → yapıştır → **Save**
5. Vercel → **Deployments** → en üstteki → **⋯** → **Redeploy** (yeni değer ancak yeniden yayınla devreye girer)
6. Kontrol: admin panel → Taramalar → "GitHub'daki tarama işleri" listesi geliyorsa tamam.

> Token süresi dolarsa: "Şimdi tara" çalışmaz **ve** cron-job.org işleri başlatamaz (panel "GitHub 401" der).
> GitHub'ın yedek zamanlayıcısı (45 dk sonra) yine de taramayı yapar, ama mümkün olan en kısa sürede yenile.

---

## 3. Firebase yönetici anahtarını yenileme (yılda bir ya da sızdığından şüphelenirsen hemen)

1. Firebase Console → ⚙️ **Proje ayarları** → **Hizmet hesapları** → **Yeni özel anahtar oluştur** → JSON iner
2. İnen dosyayı `C:\Users\Deep_\personalprojects\firebase_keys\kartradar.json` olarak kaydet (eskisinin üzerine)
3. Panoya kopyala (PowerShell):
   ```
   Get-Content "C:\Users\Deep_\personalprojects\firebase_keys\kartradar.json" -Raw | Set-Clipboard
   ```
4. GitHub → repo → **Settings** → **Secrets and variables** → **Actions** → `FIREBASE_SERVICE_ACCOUNT_JSON` → **Update** → yapıştır → **Update secret**
5. Bir tarama dene (admin panel → Şimdi tara → tek kart, yayın kapalı); başarılı biterse:
6. **Eski anahtarı sil:** Google Cloud Console → **IAM ve Yönetici** → **Hizmet hesapları** → `firebase-adminsdk-...` → **Anahtarlar** sekmesi → eski tarihli anahtarı **Sil**

> İndirilen JSON'u e-postayla, mesajla gönderme; masaüstünde/İndirilenler'de bırakma.

---

## 4. Cron anahtarını yenileme (sadece sızdığından şüphelenirsen)

1. Yeni anahtar üret (PowerShell; panoya kopyalar):
   ```
   -join ((48..57)+(65..90)+(97..122) | Get-Random -Count 40 | ForEach-Object {[char]$_}) | Set-Clipboard
   ```
2. Vercel → `CRON_SECRET` → Edit → yapıştır → Save → **Redeploy**
3. cron-job.org → 6 işin her birinde **Edit** → URL'deki `&key=` sonrasını yeni anahtarla değiştir → Save
4. Kontrol: tarayıcıda `https://PANEL/api/cron?job=deneme&key=YENI_ANAHTAR` → "Bilinmeyen iş: deneme" görmelisin.

---

## 5. Zamanlama

| Saat (TR) | İş | Ne yapar |
|---|---|---|
| 08:43 | `scrape-0843` | Tarama + Firestore'a yayın |
| 12:30 | `notify-1230` | Öğle bildirimi |
| 19:30 | `notify-1930` | Akşam bildirimi |
| 20:43 | `scrape-2043` | Tarama + Firestore'a yayın |

- **Asıl tetikleyici:** cron-job.org → `https://PANEL/api/cron?job=<iş>&key=<CRON_SECRET>`
- **Yedek:** GitHub'ın kendi zamanlayıcısı, ~45 dk sonra. Asıl iş çalıştıysa 1 dakikada kapanır.
  Bildirim yedeği, saatinden 2,5 saatten fazla geç kalırsa göndermez (gece bildirimi olmaz).
- **Saat değiştirmek için 4 yer birlikte güncellenmeli:** cron-job.org, `admin/api/cron.js` (JOBS),
  `admin/app.js` (SCHEDULE), `.github/workflows/scrape.yml` / `notify.yml` (yedek saatler).

---

## 6. Rutin kontroller

**Her gün (2 dk):** Admin panel → Taramalar tablosu yeşil mi? Bildirimler zamanında mı? Kartların sayısında ani düşüş var mı?
Raporda `robots.txt` uyarısı, ❌ ya da "zaman aşımı" varsa incele.

**Haftada bir:**
- Firebase Console → Firestore → **Usage**: günlük okuma < 50.000, ayda indirilen veri < 10 GB
- GitHub → Settings → **Billing** → Usage: Actions dakikası ayda < 2.000

**Yılda bir:** GitHub token (§2) ve Firebase anahtarı (§3) yenile.

---

## 7. Bir şey ters giderse

| Belirti | Olası sebep | Ne yap |
|---|---|---|
| Panelde hücreler gri "çalışmadı" | cron-job.org çağrısı başarısız | cron-job.org → işin **History**'sine bak (401 = anahtar, 502 = GitHub token) |
| "GitHub 401/403" | Token süresi doldu / yetkisi yok | §2 |
| Tarama raporunda tüm kartlar "Firestore kapalı" | Firebase anahtarı geçersiz | §3 |
| Bir kart sürekli ❌ | Banka sitesini değiştirmiş | Raporu ve hata yazısını kaydet, scraper'ın o kartını güncelle |
| Uygulamada "Kampanyalar alınamadı" | İnternet / Firestore kuralları | Firebase Console → Firestore → Rules yüklü mü bak |

**Anahtar sızdıysa (hemen):** ilgili anahtarı §2/§3/§4'e göre yenile, eskisini sil/iptal et. Firebase anahtarı için
Google Cloud'da eski anahtarı silmek, onu anında geçersiz kılar.

---

## 8. Hesap güvenliği

GitHub, Google (Firebase), Vercel ve cron-job.org hesaplarında **iki adımlı doğrulama (2FA)** açık olmalı.
Sistemin en zayıf noktası kod değil, bu hesaplardır.

## 9. Gizlilik politikası sayfası

Metnin tek kaynağı `hosting/_kaynak/gizlilik.py` (iletişim e-postası en üstte). Değiştirdikten sonra
`python hosting/_kaynak/gizlilik.py` çalıştır: hem web sayfasını (`hosting/gizlilik.html`) hem uygulamadaki
sayfayı (`kartradar-app/lib/ui/pages/privacy_page.dart`, iki klasör yan yana olmalı) yeniden üretir.

Web sayfasını yayınlamak için:

```powershell
cd C:\Users\Deep_\personalprojects\kartRadar
firebase deploy --only hosting --project task-236e6
```

Play Console'daki "Gizlilik politikası" ve "Hesap silme" alanlarına da bu adres yazılır
(hesap silme için: `https://task-236e6.web.app/gizlilik#hesap-silme`).
