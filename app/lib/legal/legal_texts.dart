/*
 * Yasal metinler (uygulama içinde gösterilir; aynısı admin/gizlilik.html'de web sayfası olarak var).
 *
 * YAYINDAN ÖNCE: [Ad Soyad] yerine kendi adını yaz ve metinleri bir avukata kontrol ettir.
 * Metinleri değiştirirsen admin/gizlilik.html'i de aynı şekilde güncelle.
 */

/// Veri sorumlusu (uygulamanın sahibi) — kendi adınla değiştir
const kDeveloperName = '[Ad Soyad]';

/// Kullanıcıların ulaşacağı e-posta (KVKK başvuruları, kaldırma talepleri)
const kContactEmail = 'smh.dgsn@gmail.com';

const kLegalUpdated = '13 Ekim 2026';

class LegalSection {
  const LegalSection(this.title, this.body);

  final String title;
  final String body;
}

/// Kısa uyarı (kampanya detayı, giriş ekranı vb.)
const kShortDisclaimer =
    'KartRadar bağımsız bir uygulamadır; bankalar ve kart programlarıyla bir bağlantısı yoktur. '
    'Kampanyaların kesin ve güncel koşulları bankanın kendi sayfasındadır.';

const kPrivacySections = <LegalSection>[
  LegalSection(
    'Veri sorumlusu',
    'Bu metin, KartRadar mobil uygulamasında kişisel verilerinin nasıl işlendiğini 6698 sayılı Kişisel '
        'Verilerin Korunması Kanunu (KVKK) kapsamında açıklar. Veri sorumlusu: $kDeveloperName. '
        'İletişim: $kContactEmail',
  ),
  LegalSection(
    'Hangi verileri işliyoruz?',
    '• Hesap bilgileri: e-posta adresin ve istersen adın.\n'
        '• Şifren: Google Firebase tarafından şifrelenmiş olarak saklanır; biz göremeyiz.\n'
        '• Seçtiğin kart programları (ör. "Bonus", "Axess") — sadece programın adı.\n'
        '• Bildirim tercihin (açık/kapalı ve saat) — sadece telefonunda tutulur.\n'
        '• Bildirim gönderebilmek için telefonunun bildirim kaydı (Firebase Cloud Messaging). '
        'Bu kayıt adınla ya da e-postanla eşleştirilmez.\n\n'
        'Kart numarası, banka hesabı, harcama bilgisi, konum ya da rehber bilgisi İSTEMİYOR ve İŞLEMİYORUZ. '
        'Uygulamada reklam ya da kullanıcı takibi (analitik) yoktur.',
  ),
  LegalSection(
    'Neden işliyoruz?',
    '• Hesabını oluşturmak ve giriş yapmanı sağlamak,\n'
        '• Sana sadece kartlarına uygun kampanyaları göstermek,\n'
        '• Kart listeni hesabında saklayıp telefon değiştirdiğinde geri getirmek,\n'
        '• İstersen kartlarına yeni kampanya geldiğinde bildirim göndermek,\n'
        '• Hizmetin güvenliğini sağlamak.\n\n'
        'Hukuki sebep: hizmetin sunulması için zorunlu olması (KVKK m. 5/2-c) ve hizmetin güvenliği için '
        'meşru menfaat (KVKK m. 5/2-f). Bildirimler sadece sen açarsan gönderilir.',
  ),
  LegalSection(
    'Verilerin nerede saklanıyor, kimlerle paylaşılıyor?',
    'Veriler Google LLC\'nin Firebase altyapısında (kimlik doğrulama, veritabanı, bildirim) saklanır. '
        'Bu sunucular yurt dışında bulunabilir; bu nedenle verilerin KVKK m. 9\'a uygun şekilde yurt dışına '
        'aktarılır. Verilerin bunun dışında hiçbir kişi ya da kurumla paylaşılmaz, satılmaz.',
  ),
  LegalSection(
    'Ne kadar süre saklıyoruz?',
    'Hesabın açık olduğu sürece. Uygulamada Hesabım → Hesabımı sil ile hesabını ve kart listeni '
        'istediğin zaman kalıcı olarak silebilirsin.',
  ),
  LegalSection(
    'Hakların',
    'KVKK m. 11 uyarınca; verilerinin işlenip işlenmediğini öğrenme, bilgi isteme, düzeltilmesini ya da '
        'silinmesini isteme, aktarıldığı tarafları öğrenme, itiraz etme ve zararın giderilmesini isteme '
        'haklarına sahipsin. Başvurularını $kContactEmail adresine yazabilirsin; en geç 30 gün içinde yanıtlarız.',
  ),
  LegalSection(
    'Değişiklikler',
    'Bu metin güncellenirse uygulamada yeni hali yayımlanır. Son güncelleme: $kLegalUpdated.',
  ),
];

const kTermsSections = <LegalSection>[
  LegalSection(
    'Bağımsız uygulama',
    'KartRadar bağımsız bir uygulamadır. Hiçbir banka, kart programı ya da şirketle bağlantısı, ortaklığı '
        'veya onların onayı yoktur. Uygulamada geçen banka ve kart adları sahiplerinin markasıdır; '
        'sadece kampanyanın hangi kartta geçerli olduğunu belirtmek için kullanılır. Kart görselleri '
        'temsilîdir, gerçek kart tasarımları değildir.',
  ),
  LegalSection(
    'Bilgilerin doğruluğu',
    'Kampanya bilgileri bankaların herkese açık internet sayfalarından otomatik olarak derlenir ve özetlenir. '
        'Bilgilerde gecikme, eksiklik ya da hata olabilir; kampanyalar banka tarafından önceden haber '
        'verilmeden değiştirilebilir veya sonlandırılabilir. Kampanyanın kesin ve güncel koşulları her zaman '
        'bankanın kendi sayfasındadır — katılmadan önce lütfen oradan kontrol et.',
  ),
  LegalSection(
    'Sorumluluk',
    'Kampanyalara katılım ve kampanyadan doğan haklar sen ile bankan arasındadır. KartRadar kampanya '
        'koşullarından, banka uygulamalarından ya da uygulamadaki bilgilere dayanarak yapılan '
        'işlemlerden sorumlu değildir.',
  ),
  LegalSection(
    'İçerik sahipleri için',
    'Bir içeriğin uygulamada gösterilmesini istemiyorsan $kContactEmail adresine yazman yeterli; '
        'en kısa sürede kaldırırız.',
  ),
];
