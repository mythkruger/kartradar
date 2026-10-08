import 'package:flutter/material.dart';

import '../../auth/auth_service.dart';
import '../../models/programs.dart';
import '../theme.dart';

/// Giriş / kayıt ekranı.
///  standalone: true  → uygulamanın açılış ekranı (giriş zorunlu): üstte tanıtım, geri tuşu yok.
///                      Giriş olunca ekranı main.dart değiştirir (kart seçimi ya da ana sayfa).
///  standalone: false → başka sayfadan açılır, girişten sonra kapanır.
class EmailAuthPage extends StatefulWidget {
  const EmailAuthPage({super.key, required this.auth, this.register = false, this.standalone = false});

  final AuthService auth;
  final bool register;
  final bool standalone;

  @override
  State<EmailAuthPage> createState() => _EmailAuthPageState();
}

class _EmailAuthPageState extends State<EmailAuthPage> {
  final _form = GlobalKey<FormState>();
  final _name = TextEditingController();
  final _email = TextEditingController();
  final _password = TextEditingController();
  final _password2 = TextEditingController();

  late bool _register = widget.register;
  bool _obscure = true;
  bool _busy = false;
  String? _error;
  String? _info;

  @override
  void dispose() {
    _name.dispose();
    _email.dispose();
    _password.dispose();
    _password2.dispose();
    super.dispose();
  }

  String get _emailText => _email.text.trim();

  void _switch(bool register) {
    if (_busy) return;
    setState(() {
      _register = register;
      _error = null;
      _info = null;
    });
  }

  Future<void> _submit() async {
    FocusScope.of(context).unfocus();
    setState(() {
      _error = null;
      _info = null;
    });
    if (!_form.currentState!.validate()) return;
    setState(() => _busy = true);
    try {
      if (_register) {
        await widget.auth.register(name: _name.text.trim(), email: _emailText, password: _password.text);
      } else {
        await widget.auth.signIn(email: _emailText, password: _password.text);
      }
      if (!mounted) return;
      if (_register) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Hesabın oluşturuldu. E-postana gelen bağlantıyla adresini doğrula.')),
        );
      }
      if (!widget.standalone) Navigator.of(context).pop();
    } catch (e) {
      if (mounted) setState(() => _error = authErrorText(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _forgot() async {
    if (!_validEmail(_emailText)) {
      setState(() {
        _info = null;
        _error = 'Şifre sıfırlama bağlantısı için önce e-posta adresini yaz.';
      });
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await widget.auth.resetPassword(_emailText);
      if (mounted) setState(() => _info = '$_emailText adresine şifre sıfırlama bağlantısı gönderdik (hesap varsa).');
    } catch (e) {
      if (mounted) setState(() => _error = authErrorText(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  static bool _validEmail(String s) => RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$').hasMatch(s);

  @override
  Widget build(BuildContext context) {
    final form = _formCard();
    if (!widget.standalone) {
      return Scaffold(
        appBar: krAppBar(title: Text(_register ? 'Kayıt ol' : 'Giriş yap')),
        body: SafeArea(child: ListView(padding: const EdgeInsets.fromLTRB(16, 8, 16, 24), children: [form])),
      );
    }

    return Scaffold(
      backgroundColor: KR.bg,
      body: SingleChildScrollView(
        keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
        child: Column(
          children: [
            const _Hero(),
            Transform.translate(
              offset: const Offset(0, -28),
              child: Padding(padding: const EdgeInsets.symmetric(horizontal: 16), child: form),
            ),
            const Padding(
              padding: EdgeInsets.fromLTRB(32, 0, 32, 28),
              child: Text(
                'Hesabında sadece seçtiğin kartların listesi tutulur. Kart numarası, harcama '
                'ya da banka bilgisi istemeyiz.',
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 12, color: KR.muted, height: 1.45),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _formCard() {
    return Container(
      padding: const EdgeInsets.fromLTRB(18, 18, 18, 20),
      decoration: BoxDecoration(
        color: KR.surface,
        borderRadius: BorderRadius.circular(22),
        boxShadow: const [BoxShadow(color: Color(0x14000000), blurRadius: 24, offset: Offset(0, 8))],
      ),
      child: Form(
        key: _form,
        child: AutofillGroup(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              _ModeSwitch(register: _register, onChanged: _switch),
              const SizedBox(height: 20),
              Text(
                _register ? 'Hesap oluştur' : 'Tekrar hoş geldin',
                style: const TextStyle(fontSize: 21, fontWeight: FontWeight.w800),
              ),
              const SizedBox(height: 4),
              Text(
                _register
                    ? 'Kartlarını seç, sana uyan kampanyaları getirelim.'
                    : 'Kartlarına gelen yeni kampanyalar seni bekliyor.',
                style: const TextStyle(fontSize: 13.5, color: KR.muted, height: 1.4),
              ),
              const SizedBox(height: 18),
              if (_register) ...[
                TextFormField(
                  controller: _name,
                  textCapitalization: TextCapitalization.words,
                  textInputAction: TextInputAction.next,
                  autofillHints: const [AutofillHints.name],
                  decoration: krInput(hint: 'Adın (isteğe bağlı)', prefixIcon: const Icon(Icons.person_outline)),
                ),
                const SizedBox(height: 12),
              ],
              TextFormField(
                controller: _email,
                keyboardType: TextInputType.emailAddress,
                autofillHints: const [AutofillHints.email],
                autocorrect: false,
                textInputAction: TextInputAction.next,
                decoration: krInput(hint: 'E-posta adresin', prefixIcon: const Icon(Icons.mail_outline)),
                validator: (v) => _validEmail(v?.trim() ?? '') ? null : 'Geçerli bir e-posta yaz',
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _password,
                obscureText: _obscure,
                autofillHints: [_register ? AutofillHints.newPassword : AutofillHints.password],
                textInputAction: _register ? TextInputAction.next : TextInputAction.done,
                onFieldSubmitted: _register ? null : (_) => _submit(),
                decoration: krInput(
                  hint: _register ? 'Şifre (en az 6 karakter)' : 'Şifren',
                  prefixIcon: const Icon(Icons.lock_outline),
                  suffixIcon: IconButton(
                    tooltip: _obscure ? 'Göster' : 'Gizle',
                    icon: Icon(_obscure ? Icons.visibility_outlined : Icons.visibility_off_outlined),
                    onPressed: () => setState(() => _obscure = !_obscure),
                  ),
                ),
                validator: (v) {
                  if (v == null || v.isEmpty) return 'Şifreni yaz';
                  if (_register && v.length < 6) return 'En az 6 karakter olmalı';
                  return null;
                },
              ),
              if (_register) ...[
                const SizedBox(height: 12),
                TextFormField(
                  controller: _password2,
                  obscureText: _obscure,
                  textInputAction: TextInputAction.done,
                  onFieldSubmitted: (_) => _submit(),
                  decoration: krInput(hint: 'Şifre (tekrar)', prefixIcon: const Icon(Icons.lock_outline)),
                  validator: (v) => v == _password.text ? null : 'Şifreler aynı değil',
                ),
              ],
              if (!_register)
                Align(
                  alignment: Alignment.centerRight,
                  child: TextButton(onPressed: _busy ? null : _forgot, child: const Text('Şifremi unuttum')),
                )
              else
                const SizedBox(height: 16),
              if (_error != null) _Notice(text: _error!, color: KR.urgent, bg: KR.urgentBg, icon: Icons.error_outline),
              if (_info != null) _Notice(text: _info!, color: KR.gain, bg: KR.gainBg, icon: Icons.mark_email_read_outlined),
              const SizedBox(height: 4),
              FilledButton(
                onPressed: _busy ? null : _submit,
                child: _busy
                    ? const SizedBox(
                        width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2.5, color: Colors.white))
                    : Text(_register ? 'Hesap oluştur' : 'Giriş yap'),
              ),
              const SizedBox(height: 10),
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Text(_register ? 'Zaten hesabın var mı?' : 'Hesabın yok mu?',
                      style: const TextStyle(fontSize: 13.5, color: KR.muted)),
                  TextButton(
                    onPressed: () => _switch(!_register),
                    child: Text(_register ? 'Giriş yap' : 'Kayıt ol'),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Üst tanıtım alanı (sadece açılış ekranında)
class _Hero extends StatelessWidget {
  const _Hero();

  @override
  Widget build(BuildContext context) {
    final top = MediaQuery.paddingOf(context).top;
    return Container(
      width: double.infinity,
      padding: EdgeInsets.fromLTRB(24, top + 28, 24, 56),
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Color(0xFF0F766E), Color(0xFF115E59), Color(0xFF134E4A)],
        ),
        borderRadius: BorderRadius.vertical(bottom: Radius.circular(32)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(13)),
                child: const Icon(Icons.radar, color: KR.brand, size: 27),
              ),
              const SizedBox(width: 12),
              const Text('KartRadar',
                  style: TextStyle(color: Colors.white, fontSize: 24, fontWeight: FontWeight.w800, letterSpacing: -0.3)),
            ],
          ),
          const SizedBox(height: 22),
          const Text(
            'Kartlarına özel kampanyalar,\ntek yerde.',
            style: TextStyle(color: Colors.white, fontSize: 25, fontWeight: FontWeight.w800, height: 1.25),
          ),
          const SizedBox(height: 10),
          Text(
            'Bankaların sitelerini tek tek gezme. Sahip olduğun kartları seç, gerisini radar halleder.',
            style: TextStyle(color: Colors.white.withValues(alpha: 0.82), fontSize: 14, height: 1.45),
          ),
          const SizedBox(height: 18),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              _HeroPill(icon: Icons.credit_card, text: '${programs.length} kart programı'),
              const _HeroPill(icon: Icons.local_offer_outlined, text: 'Güncel fırsatlar'),
              const _HeroPill(icon: Icons.notifications_none, text: 'Yeni kampanya bildirimi'),
            ],
          ),
        ],
      ),
    );
  }
}

class _HeroPill extends StatelessWidget {
  const _HeroPill({required this.icon, required this.text});

  final IconData icon;
  final String text;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.14),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 15, color: Colors.white),
          const SizedBox(width: 6),
          Text(text, style: const TextStyle(color: Colors.white, fontSize: 12.5, fontWeight: FontWeight.w600)),
        ],
      ),
    );
  }
}

/// Giriş yap | Kayıt ol seçici
class _ModeSwitch extends StatelessWidget {
  const _ModeSwitch({required this.register, required this.onChanged});

  final bool register;
  final ValueChanged<bool> onChanged;

  @override
  Widget build(BuildContext context) {
    Widget tab(String label, bool value) {
      final active = register == value;
      return Expanded(
        child: GestureDetector(
          onTap: () => onChanged(value),
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 180),
            padding: const EdgeInsets.symmetric(vertical: 10),
            decoration: BoxDecoration(
              color: active ? KR.surface : Colors.transparent,
              borderRadius: BorderRadius.circular(10),
              boxShadow: active ? const [BoxShadow(color: Color(0x14000000), blurRadius: 6, offset: Offset(0, 2))] : null,
            ),
            alignment: Alignment.center,
            child: Text(
              label,
              style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14, color: active ? KR.ink : KR.muted),
            ),
          ),
        ),
      );
    }

    return Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(color: KR.bg, borderRadius: BorderRadius.circular(13)),
      child: Row(children: [tab('Giriş yap', false), tab('Kayıt ol', true)]),
    );
  }
}

class _Notice extends StatelessWidget {
  const _Notice({required this.text, required this.color, required this.bg, required this.icon});

  final String text;
  final Color color;
  final Color bg;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(12)),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 18, color: color),
          const SizedBox(width: 8),
          Expanded(child: Text(text, style: TextStyle(color: color, fontSize: 13.5, height: 1.35))),
        ],
      ),
    );
  }
}
