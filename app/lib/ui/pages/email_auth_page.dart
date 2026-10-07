import 'package:flutter/material.dart';

import '../../auth/auth_service.dart';
import '../theme.dart';

/// E-posta ile giriş / kayıt. Üstteki seçiciyle ikisi arasında geçilir.
class EmailAuthPage extends StatefulWidget {
  const EmailAuthPage({super.key, required this.auth, this.register = false});

  final AuthService auth;
  final bool register;

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

  @override
  void dispose() {
    _name.dispose();
    _email.dispose();
    _password.dispose();
    _password2.dispose();
    super.dispose();
  }

  String get _emailText => _email.text.trim();

  Future<void> _submit() async {
    setState(() => _error = null);
    if (!_form.currentState!.validate()) return;
    setState(() => _busy = true);
    try {
      if (_register) {
        await widget.auth.register(name: _name.text.trim(), email: _emailText, password: _password.text);
      } else {
        await widget.auth.signIn(email: _emailText, password: _password.text);
      }
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(_register ? 'Hesabın oluşturuldu. E-postanı doğrulamayı unutma.' : 'Giriş yapıldı')),
      );
      Navigator.of(context).pop();
    } catch (e) {
      setState(() => _error = authErrorText(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _forgot() async {
    if (!_validEmail(_emailText)) {
      setState(() => _error = 'Şifre sıfırlama bağlantısı için önce e-posta adresini yaz.');
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await widget.auth.resetPassword(_emailText);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('$_emailText adresine şifre sıfırlama bağlantısı gönderildi (hesap varsa).')),
      );
    } catch (e) {
      setState(() => _error = authErrorText(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  static bool _validEmail(String s) => RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$').hasMatch(s);

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: krAppBar(title: Text(_register ? 'Kayıt ol' : 'Giriş yap')),
      body: SafeArea(
        child: Form(
          key: _form,
          child: ListView(
            padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
            children: [
              SegmentedButton<bool>(
                segments: const [
                  ButtonSegment(value: false, label: Text('Giriş yap')),
                  ButtonSegment(value: true, label: Text('Kayıt ol')),
                ],
                selected: {_register},
                showSelectedIcon: false,
                onSelectionChanged: _busy
                    ? null
                    : (s) => setState(() {
                          _register = s.first;
                          _error = null;
                        }),
              ),
              const SizedBox(height: 24),
              if (_register) ...[
                const _Label('Adın (isteğe bağlı)'),
                TextFormField(
                  controller: _name,
                  textCapitalization: TextCapitalization.words,
                  textInputAction: TextInputAction.next,
                  decoration: krInput(hint: 'Adın', prefixIcon: const Icon(Icons.person_outline)),
                ),
                const SizedBox(height: 16),
              ],
              const _Label('E-posta'),
              TextFormField(
                controller: _email,
                keyboardType: TextInputType.emailAddress,
                autofillHints: const [AutofillHints.email],
                autocorrect: false,
                textInputAction: TextInputAction.next,
                decoration: krInput(hint: 'ornek@mail.com', prefixIcon: const Icon(Icons.mail_outline)),
                validator: (v) => _validEmail(v?.trim() ?? '') ? null : 'Geçerli bir e-posta yaz',
              ),
              const SizedBox(height: 16),
              const _Label('Şifre'),
              TextFormField(
                controller: _password,
                obscureText: _obscure,
                autofillHints: [_register ? AutofillHints.newPassword : AutofillHints.password],
                textInputAction: _register ? TextInputAction.next : TextInputAction.done,
                onFieldSubmitted: _register ? null : (_) => _submit(),
                decoration: krInput(
                  hint: _register ? 'En az 6 karakter' : 'Şifren',
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
                const SizedBox(height: 16),
                const _Label('Şifre (tekrar)'),
                TextFormField(
                  controller: _password2,
                  obscureText: _obscure,
                  textInputAction: TextInputAction.done,
                  onFieldSubmitted: (_) => _submit(),
                  decoration: krInput(hint: 'Şifreni tekrar yaz', prefixIcon: const Icon(Icons.lock_outline)),
                  validator: (v) => v == _password.text ? null : 'Şifreler aynı değil',
                ),
              ],
              if (!_register)
                Align(
                  alignment: Alignment.centerRight,
                  child: TextButton(onPressed: _busy ? null : _forgot, child: const Text('Şifremi unuttum')),
                ),
              if (_error != null) ...[
                const SizedBox(height: 8),
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(color: KR.urgentBg, borderRadius: BorderRadius.circular(12)),
                  child: Text(_error!, style: const TextStyle(color: KR.urgent, fontSize: 13.5)),
                ),
              ],
              const SizedBox(height: 20),
              FilledButton(
                onPressed: _busy ? null : _submit,
                child: _busy
                    ? const SizedBox(
                        width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2.5, color: Colors.white))
                    : Text(_register ? 'Hesap oluştur' : 'Giriş yap'),
              ),
              if (_register) ...[
                const SizedBox(height: 14),
                const Text(
                  'Hesabında sadece seçtiğin kartların listesi tutulur. Harcama, kart numarası '
                  'gibi bilgiler istemiyoruz.',
                  textAlign: TextAlign.center,
                  style: TextStyle(fontSize: 12.5, color: KR.muted, height: 1.4),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class _Label extends StatelessWidget {
  const _Label(this.text);

  final String text;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(left: 2, bottom: 6),
        child: Text(text, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
      );
}
