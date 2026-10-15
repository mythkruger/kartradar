# KartRadar — backend (gizli repo)

Banka ve kredi kartı kampanyalarını toplayan **arka plan sistemi**: tarama, admin paneli,
zamanlanmış işler, Firestore kuralları. Mobil uygulama **ayrı repodadır** (`kartradar-app`) ve
bu repodaki hiçbir kodu içermez.

```
[Banka siteleri] → scraper (GitHub Actions) → Firestore ──→ mobil uygulama (kartradar-app)
                                             └→ FCM ────→
```

İki proje arasındaki tek sözleşme: [`docs/veri-yapisi.md`](docs/veri-yapisi.md)
(aynı dosyanın bir kopyası uygulama reposunda da var; değişirse ikisini birlikte güncelle).

## Klasörler

| Klasör | İçerik |
|---|---|
| [`scraper/`](scraper/) | Kampanyaları tarayan, ayrıştıran ve Firestore'a yazan Node.js sistemi |
| [`admin/`](admin/) | Admin paneli (Vercel) |
| [`.github/workflows/`](.github/workflows/) | Zamanlanmış tarama ve bildirim işleri |
| [`firebase/`](firebase/) | Firestore kuralları ve indeks ayarları |
| [`docs/`](docs/) | Veri sözleşmesi (uygulama ile ortak) |

## Kapsam (1. aşama)

| Program | Banka | Toplama yöntemi |
|---|---|---|
| Bonus | Garanti BBVA | Liste sayfası + yeni kampanyaların detayı |
| World | Yapı Kredi | Sitenin JSON API'si |
| Maximum | İş Bankası | Liste sayfası + yeni kampanyaların detayı |
| Axess | Akbank | Ana liste + kategori sayfaları + yeni kampanyaların detayı |
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

## Bakım

Anahtarların nerede durduğu, nasıl yenileneceği, zamanlama ve rutin kontroller: [BAKIM.md](BAKIM.md)
