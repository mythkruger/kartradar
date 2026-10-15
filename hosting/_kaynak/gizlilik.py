# Gizlilik metninin TEK kaynağı. Çalıştır: python hosting/_kaynak/gizlilik.py
# Üretir: hosting/gizlilik.html (web) ve ../kartradar-app/lib/ui/pages/privacy_page.dart (uygulama)
import html, os, re
EMAIL = "smh.dgsn@gmail.com"  # uygulamaya özel adresle değiştir
UPDATED = "Son güncelleme: 15 Ekim 2026"
S = [
 ("Kim olduğumuz", f"KartRadar, banka kampanyalarını tek yerde gösteren bağımsız bir uygulamadır. Bu metin, 6698 sayılı KVKK kapsamında verilerinin nasıl işlendiğini açıklar. İletişim: {EMAIL}"),
 ("Hangi verileri işliyoruz?", "• E-posta adresin (ve istersen adın)\n• Şifren — Google Firebase tarafından şifreli saklanır, biz göremeyiz\n• Seçtiğin kart programlarının adları (ör. Bonus, Axess)\n• Bildirim gönderebilmek için telefonunun bildirim kaydı\n\nKart numarası, banka ya da harcama bilgisi, konum veya rehber istemiyoruz. Reklam ve kullanıcı takibi yoktur."),
 ("Neden işliyoruz?", "Hesabını oluşturmak, sana kartlarına uygun kampanyaları göstermek, kart listeni hesabında saklamak ve istersen bildirim göndermek için. Hukuki sebep: hizmetin sunulması için gerekli olması (KVKK m. 5/2-c)."),
 ("Nerede saklanıyor?", "Google Firebase altyapısında. Sunucular yurt dışında olabilir. Verilerin başka kimseyle paylaşılmaz, satılmaz."),
 ("Hesabını silmek", f"Hesabım → Hesabımı sil ile hesabın ve kart listen kalıcı olarak silinir. Uygulamaya erişemiyorsan kayıtlı e-postandan {EMAIL} adresine yazman yeterli."),
 ("Hakların", f"KVKK m. 11'deki haklarını (bilgi isteme, düzeltme, silme, itiraz) {EMAIL} adresine yazarak kullanabilirsin."),
]
DISCLAIMER = [
 ("Bağımsız uygulama", "KartRadar hiçbir banka ya da kart programıyla bağlantılı değildir. Banka ve kart adları sahiplerinin markasıdır."),
 ("Bilgilerin doğruluğu", "Kampanya bilgileri bankaların herkese açık sayfalarından derlenir; gecikme ya da hata olabilir. Kesin koşullar bankanın kendi sayfasındadır."),
]
root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
def card(title, secs, extra=""):
    h = "".join(f'<h2{(" id=hesap-silme" if t=="Hesabını silmek" else "")}>{html.escape(t)}</h2><p>{html.escape(b).replace(chr(10), "<br>")}</p>' for t, b in secs)
    return f'<div class="card"{extra}><h1>{title}</h1>{"<p class=muted>"+UPDATED+"</p>" if not extra else ""}{h}</div>'
p = os.path.join(root, "hosting", "gizlilik.html")
s = open(p, encoding="utf-8").read()
head = s[:s.index('<div class="logo">')]
head = re.sub(r"<!--.*?-->\n?", "", head, flags=re.S)
s = head + '<!-- ÜRETİLDİ: hosting/_kaynak/gizlilik.py — elle değiştirme -->\n<div class="logo"><span class="mark"></span>KartRadar</div>\n' + card("Gizlilik Politikası", S) + "\n" + card("Yasal uyarı", DISCLAIMER, ' id="yasal-uyari"') + "\n</main></body></html>\n"
open(p, "w", encoding="utf-8").write(s)
def q(t): return "'" + t.replace("\\", "\\\\").replace("'", "\\'").replace("$", "\\$").replace("\n", "\\n") + "'"
dart = os.path.join(root, "..", "kartradar-app", "lib", "ui", "pages", "privacy_page.dart")
if os.path.isdir(os.path.dirname(dart)):
    d = open(dart, encoding="utf-8").read()
    body = "const _updated = " + q(UPDATED) + ";\n\nconst _sections = <(String, String)>[\n" + "".join(f"  ({q(t)},\n   {q(b)}),\n" for t, b in S) + "];"
    d = re.sub(r"const _updated = .*?\n\];", lambda m: body, d, flags=re.S)
    d = d.replace(" * Aynı metin web'de de var: backend reposunda hosting/gizlilik.html (Play Console bu linki ister).\n * Metni değiştirirsen ikisini birlikte güncelle.", " * ÜRETİLDİ: backend reposunda hosting/_kaynak/gizlilik.py (web sayfasıyla birlikte). Elle değiştirme.")
    open(dart, "w", encoding="utf-8").write(d)
print("tamam")
