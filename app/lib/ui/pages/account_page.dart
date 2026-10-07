import 'package:flutter/material.dart';

import '../../auth/auth_service.dart';
import '../../state/app_state.dart';
import '../theme.dart';
import 'email_auth_page.dart';
import 'my_cards_page.dart';
import 'notifications_page.dart';

/// Hesabım: giriş / kayıt (isteğe bağlı) + ayarlar (bildirimler, kartlarım)
class AccountPage extends StatefulWidget {
  const AccountPage({super.key, required this.state});

  final AppState state;

  @override
  State<AccountPage> createState() => _AccountPageState();
}

class _AccountPageState extends State<AccountPage> {
  bool _busy = false;

  AppState get state => widget.state;
  AuthService get auth => state.auth!;

  void _snack(String text) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).hideCurrentSnackBar();
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(text)));
  }

  /// Bir işlemi çalıştır: beklerken dönen çark, hata olursa Türkçe mesaj
  Future<bool> _run(Future<void> Function() action, {String? success}) async {
    setState(() => _busy = true);
    try {
      await action();
      if (success != null) _snack(success);
      return true;
    } catch (e) {
      final msg = authErrorText(e);
      if (msg != null) _snack(msg);
      return false;
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  void _open(Widget page) => Navigator.of(context).push(MaterialPageRoute(builder: (_) => page));

  Future<void> _confirmDelete() async {
    final yes = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Hesabın silinsin mi?'),
        content: const Text(
          'Hesabın ve hesabına kayıtlı kartların silinir. Bu geri alınamaz. '
          'Telefondaki kart seçimin kalır.',
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Vazgeç')),
          TextButton(
            onPressed: () => Navigator.pop(context, true),
            style: TextButton.styleFrom(foregroundColor: KR.urgent),
            child: const Text('Sil'),
          ),
        ],
      ),
    );
    if (yes == true) await _run(state.deleteAccount, success: 'Hesabın silindi');
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: krAppBar(title: const Text('Hesabım')),
      body: ListenableBuilder(
        listenable: state,
        builder: (context, _) {
          return Stack(
            children: [
              ListView(
                padding: const EdgeInsets.fromLTRB(20, 4, 20, 32),
                children: [
                  if (state.auth == null)
                    const _Box(
                      child: Text(
                        'Giriş şu an kapalı (Firebase bağlı değil).',
                        style: TextStyle(color: KR.muted),
                      ),
                    )
                  else if (state.signedIn)
                    _profile()
                  else
                    _signInBox(),
                  const SizedBox(height: 24),
                  const _SectionLabel('Ayarlar'),
                  _Box(
                    padding: EdgeInsets.zero,
                    child: Column(
                      children: [
                        ListTile(
                          leading: Icon(state.notifyEnabled
                              ? Icons.notifications_active_outlined
                              : Icons.notifications_none),
                          title: const Text('Bildirimler'),
                          subtitle: Text(state.notifyEnabled ? 'Açık · ${state.notifySlot.label}' : 'Kapalı'),
                          trailing: const Icon(Icons.chevron_right),
                          onTap: () => _open(NotificationsPage(state: state)),
                        ),
                        const Divider(height: 1, indent: 16, endIndent: 16),
                        ListTile(
                          leading: const Icon(Icons.credit_card),
                          title: const Text('Kartlarım'),
                          subtitle: Text('${state.myPrograms.length} kart'),
                          trailing: const Icon(Icons.chevron_right),
                          onTap: () => _open(MyCardsPage(state: state)),
                        ),
                      ],
                    ),
                  ),
                  if (state.signedIn) ...[
                    const SizedBox(height: 24),
                    _Box(
                      padding: EdgeInsets.zero,
                      child: Column(
                        children: [
                          ListTile(
                            leading: const Icon(Icons.logout),
                            title: const Text('Çıkış yap'),
                            onTap: _busy ? null : () => _run(auth.signOut, success: 'Çıkış yapıldı'),
                          ),
                          const Divider(height: 1, indent: 16, endIndent: 16),
                          ListTile(
                            leading: const Icon(Icons.delete_outline, color: KR.urgent),
                            title: const Text('Hesabımı sil', style: TextStyle(color: KR.urgent)),
                            onTap: _busy ? null : _confirmDelete,
                          ),
                        ],
                      ),
                    ),
                  ],
                ],
              ),
              if (_busy)
                const Positioned(top: 0, left: 0, right: 0, child: LinearProgressIndicator(minHeight: 2)),
            ],
          );
        },
      ),
    );
  }

  Widget _signInBox() {
    return _Box(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Row(
            children: [
              Icon(Icons.cloud_done_outlined, color: KR.brand),
              SizedBox(width: 10),
              Expanded(
                child: Text('Kartların kaybolmasın',
                    style: TextStyle(fontSize: 17, fontWeight: FontWeight.w800)),
              ),
            ],
          ),
          const SizedBox(height: 8),
          const Text(
            'Giriş yapmak isteğe bağlı. Giriş yaparsan seçtiğin kartlar hesabına kaydedilir; '
            'telefon değiştirsen de geri gelir.',
            style: TextStyle(fontSize: 13.5, color: KR.muted, height: 1.45),
          ),
          const SizedBox(height: 18),
          if (kGoogleSignIn) ...[
            _ProviderButton(
              icon: const _GoogleMark(),
              label: 'Google ile devam et',
              onPressed: _busy ? null : () => _run(auth.signInWithGoogle, success: 'Giriş yapıldı'),
            ),
            const SizedBox(height: 10),
          ],
          if (kAppleSignIn) ...[
            _ProviderButton(
              icon: const Icon(Icons.apple, size: 22),
              label: 'Apple ile devam et',
              onPressed: _busy ? null : () => _run(auth.signInWithApple, success: 'Giriş yapıldı'),
            ),
            const SizedBox(height: 10),
          ],
          _ProviderButton(
            icon: const Icon(Icons.mail_outline, size: 21),
            label: 'E-posta ile giriş yap',
            onPressed: _busy ? null : () => _open(EmailAuthPage(auth: auth)),
          ),
          const SizedBox(height: 6),
          TextButton(
            onPressed: _busy ? null : () => _open(EmailAuthPage(auth: auth, register: true)),
            child: const Text('Hesabın yok mu? Kayıt ol'),
          ),
        ],
      ),
    );
  }

  Widget _profile() {
    final u = state.user!;
    final name = (u.displayName?.trim().isNotEmpty ?? false) ? u.displayName!.trim() : null;
    final email = u.email;
    final isEmailAccount = u.providerData.any((p) => p.providerId == 'password');
    final initial = (name ?? email ?? '?').characters.first.toUpperCase();

    return _Box(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              CircleAvatar(
                radius: 26,
                backgroundColor: KR.brand.withValues(alpha: 0.12),
                foregroundImage: u.photoURL != null ? NetworkImage(u.photoURL!) : null,
                child: Text(initial,
                    style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800, color: KR.brand)),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(name ?? 'Hoş geldin',
                        style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w800)),
                    if (email != null)
                      Text(email, style: const TextStyle(fontSize: 13, color: KR.muted)),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          const Row(
            children: [
              Icon(Icons.cloud_done_outlined, size: 18, color: KR.gain),
              SizedBox(width: 6),
              Text('Kartların hesabına kaydediliyor', style: TextStyle(fontSize: 13, color: KR.gain)),
            ],
          ),
          if (isEmailAccount && !u.emailVerified) ...[
            const SizedBox(height: 14),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(color: KR.urgentBg, borderRadius: BorderRadius.circular(12)),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'E-posta adresini doğrula. Gelen kutuna bir bağlantı gönderdik.',
                    style: TextStyle(fontSize: 13, color: KR.urgent),
                  ),
                  Wrap(
                    spacing: 4,
                    children: [
                      TextButton(
                        onPressed: _busy
                            ? null
                            : () => _run(auth.resendVerification, success: 'Doğrulama e-postası gönderildi'),
                        child: const Text('Tekrar gönder'),
                      ),
                      TextButton(
                        onPressed: _busy ? null : () => _run(auth.reload),
                        child: const Text('Doğruladım'),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _Box extends StatelessWidget {
  const _Box({required this.child, this.padding = const EdgeInsets.all(16)});

  final Widget child;
  final EdgeInsets padding;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: padding,
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(color: KR.surface, borderRadius: BorderRadius.circular(KR.radius)),
      child: child,
    );
  }
}

class _SectionLabel extends StatelessWidget {
  const _SectionLabel(this.text);

  final String text;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(left: 4, bottom: 8),
        child: Text(text, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: KR.muted)),
      );
}

class _ProviderButton extends StatelessWidget {
  const _ProviderButton({required this.icon, required this.label, required this.onPressed});

  final Widget icon;
  final String label;
  final VoidCallback? onPressed;

  @override
  Widget build(BuildContext context) {
    return OutlinedButton(
      onPressed: onPressed,
      style: OutlinedButton.styleFrom(
        minimumSize: const Size.fromHeight(50),
        foregroundColor: KR.ink,
        side: const BorderSide(color: KR.line),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
      ),
      child: Row(
        children: [
          SizedBox(width: 28, child: Center(child: icon)),
          Expanded(
            child: Text(label,
                textAlign: TextAlign.center, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600)),
          ),
          const SizedBox(width: 28),
        ],
      ),
    );
  }
}

/// Basit "G" işareti (Google logosunu kopyalamadan)
class _GoogleMark extends StatelessWidget {
  const _GoogleMark();

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 22,
      height: 22,
      alignment: Alignment.center,
      decoration: BoxDecoration(shape: BoxShape.circle, border: Border.all(color: KR.line)),
      child: const Text('G', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: Color(0xFF4285F4))),
    );
  }
}
