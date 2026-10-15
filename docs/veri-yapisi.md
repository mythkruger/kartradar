# KartRadar — Firestore veri yapısı

Backend (scraper + admin, repo `kartradar`) **yazar**, mobil uygulama (repo `kartradar-app`) **okur**.
İki proje birbirinin kodunu görmez; aralarındaki **tek sözleşme bu dosya**. Aynı dosya iki repoda da
durur (`docs/veri-yapisi.md`). Bir alanın adını ya da anlamını değiştirirsen önce burayı güncelle,
sonra iki repoya da aynı kopyayı koy.

## Belgeler

| Belge | İçerik |
|---|---|
| `meta/programIndex` | Her kart programının özeti. Uygulama önce bunu okur (1 okuma). |
| `programCampaigns/{programId}` | O programın **güncel** kampanyaları (tek belge, dizi). **Özet yok.** |
| `campaignDetails/{campaignId}` | Tek kampanyanın özeti. Sadece kullanıcı kampanyaya dokununca okunur. |

Program ID'leri: `bonus`, `world`, `maximum`, `axess`, `bankkart`, `bankkart-genc`, `bonus-genc`, `encard-genc`, `paraf`, `qnb`, `advantage`, `enpara`, `multinet`, `setcard`

### `meta/programIndex`

```json
{
  "updatedAt": "<serverTimestamp>",
  "programs": {
    "bonus": {
      "name": "Bonus",
      "bank": "Garanti BBVA",
      "hash": "a1b2c3d4e5f60718",
      "count": 184,
      "updatedAt": 1790000000000,
      "nextExpiry": "2026-09-30"
    }
  }
}
```

- `hash` değişmediyse uygulama o programı **tekrar indirmez**, önbellekten okur.
- `nextExpiry`: dizideki en yakın bitiş tarihi (scraper temizlik için kullanır).

### `programCampaigns/{programId}`

```json
{
  "programId": "bonus",
  "programName": "Bonus",
  "bank": "Garanti BBVA",
  "count": 184,
  "hash": "a1b2c3d4e5f60718",
  "updatedAt": "<serverTimestamp>",
  "campaigns": [
    {
      "id": "bonus-kampanyalar-migros-hemen-bonus-kampanyalari",
      "title": "Bonus'tan gençlere özel Migros Hemen'de 400 TL bonus!",
      "imageUrl": "https://www.bonus.com.tr/assets/images/imported/migros_hemen.jpg",
      "url": "https://www.bonus.com.tr/kampanyalar/migros-hemen-bonus-kampanyalari",
      "startDate": "2026-09-01",
      "endDate": "2026-09-30",
      "sectors": ["market"],
      "merchant": "Migros Hemen",
      "benefit": {
        "types": ["puan"],
        "amount": 400,
        "percent": null,
        "installments": null,
        "minSpend": 1000
      },
      "join": "app"
    }
  ]
}
```

### `campaignDetails/{campaignId}`

```json
{
  "programId": "bonus",
  "summary": "1 - 30 Eylül tarihleri arasında … toplam 400 TL bonus verilecektir.",
  "expireAt": "<Timestamp: bitiş + 2 gün>"
}
```

- Belge ID'si = kampanyanın `id`'si. Özeti olmayan kampanyanın belgesi yoktur.
- Scraper sadece yeni / değişen özeti yazar, kalkan kampanyanın özetini siler
  (hangi özetin yazıldığı `scraper/data/published-details.json` dosyasında tutulur).
- `expireAt`: bitişten 2 gün sonrası (TTL faturalı planda açılabilir; şimdilik scraper temizler).

## Alanlar

| Alan | Tür | Açıklama |
|---|---|---|
| `id` | string | `<program>-<url yolu>`. Değişmez; favoriler bunu saklar. |
| `title` | string | Bankanın başlığı. |
| `summary` | string | **Sadece `campaignDetails` belgesinde.** En fazla ~300 karakter. Tam metin bankanın sayfasında (`url`). |
| `imageUrl` | string \| null | Bankanın görseli. |
| `url` | string | Kampanyanın bankadaki sayfası. |
| `startDate`, `endDate` | `YYYY-MM-DD` \| null | Türkiye saatine göre. Bitmiş kampanya **hiç yazılmaz**. |
| `sectors` | string[] | Standart anahtarlar (aşağıda). En az bir tane; bilinmiyorsa `["diger"]`. |
| `merchant` | string \| null | Üye işyeri / marka. |
| `benefit.types` | (`puan` \| `indirim` \| `nakit` \| `taksit`)[] | Boş olabilir (metinden çıkarılamadıysa). |
| `benefit.amount` | number \| null | TL: toplam / "…'ye varan" tutar. |
| `benefit.percent` | number \| null | İndirim / iade yüzdesi. |
| `benefit.installments` | number \| null | Taksit sayısı. |
| `benefit.minSpend` | number \| null | "… TL ve üzeri" alt limit. |
| `join` | `app` \| `sms` \| `auto` \| null | Katılım şekli. `null` = metinde bulunamadı. |

### Sektör anahtarları

| Anahtar | Etiket |
|---|---|
| `market` | Market |
| `akaryakit` | Akaryakıt |
| `giyim` | Giyim & Aksesuar |
| `elektronik` | Elektronik |
| `beyaz-esya` | Beyaz Eşya |
| `mobilya` | Mobilya & Ev |
| `e-ticaret` | Online Alışveriş |
| `seyahat` | Seyahat & Otel |
| `yeme-icme` | Yeme & İçme |
| `egitim` | Eğitim & Kırtasiye |
| `saglik` | Sağlık & Kozmetik |
| `eglence` | Eğlence & Kültür |
| `otomotiv` | Otomotiv & Ulaşım |
| `fatura` | Fatura & Vergi |
| `telekom` | Telekom & Dijital |
| `spor` | Spor |
| `genel` | Tüm Harcamalar |
| `diger` | Diğer |

Backend tarafındaki kaynak: `scraper/src/core/sectors.ts`. Uygulamadaki karşılığı: `lib/models/programs.dart`.
Anahtar eklenirse iki tarafa da eklenmeli; uygulama bilmediği anahtarı `diger` gibi gösterir.

## Kurallar

- **Eski veri yok.** Program belgesi her yazımda tamamen değişir; biten / bankadan kalkan kampanya diziden düşer.
- **Aynı veri tekrar yazılmaz.** Scraper çalışma başında sadece `meta/programIndex`'i okur; hash'i değişmeyen programa dokunmaz.
- **Günde 2 yayın.** Firestore'a 08:43 ve 20:43'te (TR) yayınlanır. Gece biten kampanyaları uygulama kendisi gizler.
- **Kişisel veri en az.** Kart listesi `users/{uid}` belgesinde (`programs`, `updatedAt`); başka hiçbir kişisel bilgi yazılmaz.
- **Okuma için giriş** gerekir (e-posta/şifre). Anonim giriş kapalı. Kurallar: `firebase/firestore.rules` (backend reposunda).

## Kullanıcı belgesi — `users/{uid}`

```json
{ "programs": ["bonus", "maximum"], "updatedAt": "<serverTimestamp>" }
```

- Sadece sahibi okur/yazar; bu iki alan dışında alan yazılamaz (kurallar reddeder).
- Hesap silinince uygulama bu belgeyi de siler.

## Uygulamanın erişemediği belgeler (sadece admin)

`meta/notifyState`, `adminRuns/*` — uygulama bunları **okumaz**; kurallar da izin vermez.

## Bildirimler (FCM)

| Konu (topic) | Gönderim (TR) |
|---|---|
| `yeni_1230` | 12:30 |
| `yeni_1930` | 19:30 |

- Uygulama kullanıcının seçtiği saate göre **tek bir** konuya abone olur (bildirim kapalıysa hiçbirine).
- Backend tek bir **data-only** mesaj gönderir (Android önceliği `high`, ttl 6 saat):

```json
{ "type": "yeni", "slot": "1230", "day": "2026-10-15", "counts": "{\"bonus\":3,\"maximum\":1}" }
```

- `counts`: JSON metni, program ID → yeni kampanya sayısı. Uygulama bunu kullanıcının kartlarına
  göre süzer; kullanıcının kartlarında yeni kampanya yoksa bildirim göstermez. Aynı gün+saat için
  bir kez gösterir (kanal `yeni_kampanya`).

## Maliyet

| Durum | Okuma | Yazma |
|---|---|---|
| Scraper: hiçbir program değişmedi | 1 | 0 |
| Scraper: N program değişti | 1 | N + 1 |
| Uygulama açılışı | 1 + değişen program sayısı | 0 |
| Kampanya detayı açma | 1 (özet belgesi, küçük) | 0 |
