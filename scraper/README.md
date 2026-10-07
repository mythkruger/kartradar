# KartRadar scraper

Kart programlarının kampanya sayfalarını tarar; tarih, sektör, kazanç ve katılım şeklini
metinden çıkarır; sonucu Firestore'a yazar. Admin panelden izlenir.

## Klasör yapısı

```
src/
  core/
    types.ts         veri modeli (Campaign, Benefit, SiteConfig)
    engine.ts        tek tarayıcı, paralel çalışma, tekrar deneme, ekran görüntüsü
    extract.ts       tarayıcı içinde selector'lardan veri okuma
    detailCache.ts   detay sayfası önbelleği (sadece yeni kampanyanın detayına girilir)
    build.ts         ham kayıt → Campaign (doğrulama, tekrarları atma, sağlık uyarıları)
    dates.ts         Türkçe tarih ayrıştırıcı
    benefit.ts       kazanç (puan/indirim/taksit/nakit) ve katılım şekli ayrıştırıcı
    sectors.ts       bankaların sektör etiketlerini standart anahtarlara çevirme
    normalize.ts     URL, görsel, ID yardımcıları
    text.ts          Türkçe metin yardımcıları
  adapters/          listPage (DOM) ve custom (API / AJAX) toplama + detay zenginleştirme
  sites/             her program bir dosya: bonus, world, maximum, axess, bankkart, bankkart-genc, bonus-genc, encard-genc, paraf,
                     qnb, advantage, enpara, multinet, setcard
  services/          Firestore yayını, yerel depo (admin panel), loglar
  scraper/           çalıştırma + Firestore'a yayınlama akışı
  scheduler.ts       otomatik tarama saatleri
  server.ts          admin panel sunucusu
  cli.ts             komut satırı
public/              admin panel arayüzü
test/                ayrıştırıcı testleri (gerçek kampanya metinleriyle)
```

## Komutlar

```bash
npm test                               # ayrıştırıcı testleri
npm run typecheck                      # TypeScript kontrolü

npm run scrape                         # tüm programlar, sadece ekrana basar
npm run scrape -- bonus world          # seçilenler
npm run scrape -- axess --show         # tarayıcıyı görerek
npm run scrape -- --dry                # Firestore'a bağlanmadan ne yazılacağını göster
npm run scrape -- --save               # yerel + Firestore
npm run cycle                          # tam çalışma (zamanlayıcıyla aynı iş)

npm run dev                            # admin panel + otomatik zamanlayıcı
```

### İlk çalıştırma

Bonus, Maximum ve Axess'te yüzlerce kampanya var. Siteyi yormamak için her çalışmada en fazla
40 **yeni** detay sayfası açılır, gerisi sonraki çalışmalara kalır. İlk kurulumda hepsini bir
kerede doldurmak için (PowerShell):

```powershell
$env:DETAIL_MAX_PER_RUN="400"; npm run scrape -- bonus maximum axess
```

Detaylar `data/detail-cache.json` dosyasında tutulur; sonraki çalışmalarda sadece yeni
kampanyaların detayına girilir.

## Ortam değişkenleri

| Değişken | Anlamı |
|---|---|
| `FIREBASE_SERVICE_ACCOUNT` | Service account JSON dosyasının yolu (**proje klasörünün dışında** tut) |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Ya da dosyanın içeriği (sunucuda / GitHub secret olarak). İkisi birden verilirse bu kullanılır |
| `FIRESTORE_DRY_RUN=1` | Firestore'a bağlanmadan ne yazılacağını logla |
| `SCRAPE_TIMES` | Otomatik tarama saatleri, varsayılan `00:05,09:00,15:00,21:00` |
| `PUBLISH_TIMES` | Bu saatlerdeki taramalar Firestore'a da yayınlanır, varsayılan `09:00,21:00` (`all` = her tarama). Elle başlatılan taramalar her zaman yayınlanır |
| `SCHEDULER=off` | Otomatik taramayı kapat |
| `SCRAPER_CONCURRENCY` | Aynı anda taranan program sayısı, varsayılan 3 |
| `DETAIL_MAX_PER_RUN` | Bir çalışmada açılacak en fazla yeni detay sayfası |
| `HEADLESS=false` | Tarayıcıyı görünür aç |
| `PORT` | Admin panel portu, varsayılan 3000 |

## Yeni program eklemek

1. Bankanın kampanya sayfasını incele: kartlar sayfada mı (DOM), yoksa bir API / AJAX'tan mı geliyor?
2. `src/sites/<id>.ts` oluştur:
   - DOM ise `adapter: "listPage"` + `list.item` / `list.fields`
   - API / AJAX ise `adapter: "custom"` + `run(page)` fonksiyonu (örnek: `world.ts`, `axess.ts`)
   - Tarih ve koşullar detay sayfasındaysa `detail.fields` (örnek: `bonus.ts`)
3. `npm run scrape -- <id>` ile dene. Uyarılar ("bitiş tarihi bulunamadı %60" gibi) neyin eksik olduğunu söyler.
4. Yeni metin kalıpları çıktıysa `test/` altına örnek ekle, sonra `benefit.ts` / `sectors.ts`'i düzelt.

## Firestore

Veri yapısı ve kurallar: [`../docs/veri-yapisi.md`](../docs/veri-yapisi.md)

Kurulum:

1. Firebase Console'da yeni proje oluştur, Firestore'u aç.
2. Proje ayarları → Hizmet hesapları → **Yeni özel anahtar oluştur**.
   JSON'u proje klasörünün **dışına** koy, örn. `C:\Users\<kullanıcı>\firebase-keys\kartradar.json`.
3. PowerShell: `$env:FIREBASE_SERVICE_ACCOUNT="C:\Users\<kullanıcı>\firebase-keys\kartradar.json"`
4. `../firebase/firestore.rules` kurallarını yayınla.
5. Firestore → Indexes → Single field → Exemption: koleksiyon `programCampaigns`, alan `campaigns`, tüm indeksler kapalı.
6. Authentication → Sign-in method → **Anonymous** aç (uygulama okumak için anonim giriş yapar).
