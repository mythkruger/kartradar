# KartRadar — mobil uygulama (Flutter)

## İlk kurulum (bir kez)

```powershell
cd C:\Users\Deep_\personalprojects\kartRadar\app
flutter create --org com.kartradar --project-name kartradar --platforms android,ios .
flutter pub get
```

`flutter create` sadece eksik dosyaları (android/, ios/ …) ekler; `lib/` ve `pubspec.yaml`'a dokunmaz.

## Çalıştırma (geliştirme)

Uygulama şimdilik Firestore yerine **bilgisayardaki admin sunucusundan** okur:

1. Bir terminalde: `cd ..\scraper` → `npm run dev` (açık kalsın)
2. Android Studio'dan emülatörü aç
3. Diğer terminalde: `cd app` → `flutter run`

Emülatör bilgisayarın `localhost`'una `10.0.2.2` adresiyle ulaşır. Gerçek telefonda denemek için
(telefon ve bilgisayar aynı Wi-Fi'da):

```powershell
flutter run --dart-define=API_BASE=http://<bilgisayarın-ip-adresi>:3000
```

`android/app/src/debug/AndroidManifest.xml` sadece debug derlemede http'ye izin verir.

## Klasörler

```
lib/
  main.dart                 giriş; kart seçilmediyse Onboarding, yoksa Ana sayfa
  models/                   Campaign, Benefit, programlar ve sektörler
  data/
    campaign_repository.dart  veri kaynağı (şimdi admin API, sonra Firestore)
    card_store.dart           seçili kartlar (sadece telefonda)
  state/app_state.dart      kampanyalar + filtreler (filtreleme telefonda)
  ui/
    theme.dart              renkler ve tema
    format.dart             "400 TL puan", "3 gün kaldı" gibi metinler
    widgets/                kart satırı, rozetler, kart seçici
    pages/                  onboarding, ana sayfa, detay, kartlarım
```

Veri yapısı: [`../docs/veri-yapisi.md`](../docs/veri-yapisi.md)
