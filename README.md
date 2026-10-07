# KartRadar

Banka ve kredi kartı kampanyalarını tek yerde toplayan uygulama.
Kullanıcı sahip olduğu kartları seçer, sadece kendisine uyan kampanyaları görür.

```
[Banka siteleri] → scraper/ → Firestore → app/ (Flutter)
```

## Klasörler

| Klasör | İçerik |
|---|---|
| [`scraper/`](scraper/) | Kampanyaları tarayan, ayrıştıran ve Firestore'a yazan Node.js sistemi + admin panel |
| [`app/`](app/) | Flutter mobil uygulama (2. aşama) |
| [`firebase/`](firebase/) | Firestore kuralları ve indeks ayarları |
| [`docs/`](docs/) | Veri yapısı ve karar notları |

## Kapsam (1. aşama)

| Program | Banka | Toplama yöntemi |
|---|---|---|
| Bonus | Garanti BBVA | Liste sayfası + yeni kampanyaların detayı |
| World | Yapı Kredi | Sitenin JSON API'si |
| Maximum | İş Bankası | Liste sayfası + yeni kampanyaların detayı |
| Axess | Akbank | Liste + AJAX sayfaları + yeni kampanyaların detayı |
| Bankkart | Ziraat Bankası | Liste sayfası + yeni kampanyaların detayı |
| Paraf | Halkbank | Sitenin JSON'u + yeni kampanyaların detayı |
| QNB (eski CardFinans) | QNB | Sitenin JSON API'si (metin dahil, detaya girmeden) |
| Advantage | HSBC | Sayfalı liste + yeni kampanyaların detayı |
| Enpara | Enpara (QNB) | Liste sayfası + yeni kampanyaların detayı |
| Bankkart Genç | Ziraat Bankası | Bankkart listesi; koşullarında Genç'in açıkça dahil olduğu kampanyalar |
| Bonus Genç | Garanti BBVA | Bonus listesi; "Bonus Genç'le…", "gençlere özel" kampanyalar |
| Encard Genç | Enpara (QNB) | Enpara listesi; Encard Genç ve öğrenci kampanyaları |
| Multinet | Multinet Up (yemek kartı) | Liste sayfası + detay; ödeme duyuruları elenir, bitiş tarihi yok |
| Setcard | Setcard (yemek kartı) | Sadece "Güncel Kampanyalar" + detay |

## Yol haritası

| Aşama | İçerik | Durum |
|---|---|---|
| 0. Kurulum | Repo, Firebase projesi, motorun taşınması | ✅ |
| 1. Scraper | 4 program, kazanç / sektör / katılım ayrıştırma | ✅ ilk sürüm — gerçek sitelerde deneniyor |
| 2. Uygulama MVP | Kart seçimi, liste, filtreler, detay | ⏳ tasarım bekleniyor |
| 3. Bildirimler | Yeni kampanya (FCM), bitmek üzere (yerel) | — |
| 4. Büyüme | Diğer bankalar, favoriler, mağaza + kart eşleşmesi | — |

## Başlangıç

```bash
cd scraper
npm install
npm test                       # ayrıştırıcı testleri
npm run scrape -- world        # tek program, sonuçları ekrana basar
npm run dev                    # admin panel: http://localhost:3000
```

Ayrıntılar: [`scraper/README.md`](scraper/README.md)

## Tarama ilkeleri

- Günde birkaç kez tarama; istekler arasında bekleme.
- Detay sayfasına sadece **yeni** kampanyada girilir (yerel önbellek).
- Firestore'a özet bilgi ve bankanın kendi sayfasının linki yazılır; kampanya metninin tamamı kopyalanmaz.
