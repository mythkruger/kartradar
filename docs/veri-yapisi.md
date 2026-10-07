# KartRadar — Firestore veri yapısı

Scraper **yazar**, uygulama **okur**. İki taraf arasındaki tek sözleşme bu dosya.
Bir alanın adını ya da anlamını değiştirirsen önce burayı güncelle.

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
- `expireAt`: isteğe bağlı güvenlik ağı. Firestore → TTL policies → koleksiyon `campaignDetails`,
  alan `expireAt` açılırsa bitmiş kampanyaların özetleri kendiliğinden silinir.

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

Kaynak: `scraper/src/core/sectors.ts`

## Kurallar

- **Eski veri yok.** Program belgesi her yazımda tamamen değişir; biten / bankadan kalkan kampanya diziden düşer.
- **Aynı veri tekrar yazılmaz.** Scraper çalışma başında sadece `meta/programIndex`'i okur; hash'i değişmeyen programa dokunmaz.
- **Günde 2 yayın.** Scraper günde 4 kez tarar ama Firestore'a varsayılan olarak 09:00 ve 21:00'de yayınlar (`PUBLISH_TIMES`). Gece biten kampanyaları uygulama kendisi gizler.
- **Kişisel veri en az.** Giriş yapmayan kullanıcının kartları sadece telefonda tutulur. Giriş yapanın kart listesi `users/{uid}` belgesinde (`programs`, `updatedAt`); başka hiçbir kişisel bilgi yazılmaz. Kurallar herkesin sadece kendi belgesine erişmesine izin verir.
- **Okuma için anonim giriş** gerekir (`firebase/firestore.rules`).

## Maliyet

| Durum | Okuma | Yazma |
|---|---|---|
| Scraper: hiçbir program değişmedi | 1 | 0 |
| Scraper: N program değişti | 1 | N + 1 |
| Uygulama açılışı | 1 + değişen program sayısı | 0 |
| Kampanya detayı açma | 1 (özet belgesi, küçük) | 0 |
