import 'package:firebase_auth/firebase_auth.dart';

/*
 * Giriş / kayıt (Firebase Authentication).
 *
 * Uygulama açılınca kullanıcı sessizce ANONİM girer: Firestore'dan kampanya okumak için
 * giriş şart (kurallar), ama kullanıcıdan bir şey istemiyoruz.
 * Kullanıcı isterse Google ya da e-posta ile hesap açar: anonim hesap o hesaba BAĞLANIR
 * (uid değişmez). O e-posta / Google hesabı zaten kayıtlıysa doğrudan o hesaba geçilir.
 *
 * Firebase Console → Authentication → Sign-in method: Anonymous, Email/Password, Google açık olmalı.
 * Apple ile giriş: Apple Developer hesabı gerekiyor → kAppleSignIn açılınca görünür.
 */
const kAppleSignIn = false;

/// Google ile giriş: Android'de Firebase'e uygulamanın imza parmak izi (SHA-1) eklenmeden çalışmaz.
/// Şimdilik kapalı. Play Store'a çıkarken Play Console'un verdiği SHA-1 eklenip açılacak.
const kGoogleSignIn = false;

class AuthService {
  AuthService({FirebaseAuth? auth}) : _auth = auth ?? FirebaseAuth.instance;

  final FirebaseAuth _auth;

  /// Ad, e-posta doğrulama gibi değişiklikler dahil her değişimde tetiklenir
  Stream<User?> get changes => _auth.userChanges();

  User? get user => _auth.currentUser;

  /// Gerçek hesapla girmiş mi (anonim değil)
  bool get isSignedIn => user != null && !user!.isAnonymous;

  Future<void>? _ensuring;

  /// Açılışta (ve her okumadan önce): kayıtlı oturum yoksa anonim giriş.
  /// Aynı anda birden çok çağrılırsa tek giriş yapılır. İnternet yoksa sessizce geçer.
  Future<void> ensureSignedIn() {
    if (_auth.currentUser != null) return Future.value();
    return _ensuring ??= _ensure().whenComplete(() => _ensuring = null);
  }

  Future<void> _ensure() async {
    try {
      final current = await _auth.authStateChanges().first;
      if (current == null) await _auth.signInAnonymously();
    } catch (_) {
      // Sonraki açılışta tekrar denenir
    }
  }

  // ---------- Google / Apple ----------

  Future<void> signInWithGoogle() =>
      _withProvider(GoogleAuthProvider()..setCustomParameters({'prompt': 'select_account'}));

  Future<void> signInWithApple() => _withProvider(AppleAuthProvider()
    ..addScope('email')
    ..addScope('name'));

  Future<void> _withProvider(AuthProvider provider) async {
    final u = _auth.currentUser;
    if (u != null && u.isAnonymous) {
      try {
        await u.linkWithProvider(provider);
        return;
      } on FirebaseAuthException catch (e) {
        if (!_alreadyExists(e.code)) rethrow;
        // Bu Google hesabı zaten kayıtlı → o hesaba geç
        if (e.credential != null) {
          await _auth.signInWithCredential(e.credential!);
          return;
        }
      }
    }
    await _auth.signInWithProvider(provider);
  }

  // ---------- E-posta ----------

  Future<void> register({required String name, required String email, required String password}) async {
    final credential = EmailAuthProvider.credential(email: email, password: password);
    final u = _auth.currentUser;
    final result = (u != null && u.isAnonymous)
        ? await u.linkWithCredential(credential)
        : await _auth.createUserWithEmailAndPassword(email: email, password: password);
    final created = result.user;
    if (created == null) return;
    if (name.isNotEmpty) await created.updateDisplayName(name);
    try {
      await created.sendEmailVerification();
    } catch (_) {
      // Doğrulama e-postası sonra hesap sayfasından tekrar gönderilebilir
    }
    await created.reload();
  }

  Future<void> signIn({required String email, required String password}) =>
      _auth.signInWithEmailAndPassword(email: email, password: password);

  Future<void> resetPassword(String email) => _auth.sendPasswordResetEmail(email: email);

  Future<void> resendVerification() async => user?.sendEmailVerification();

  /// E-posta doğrulandı mı diye tekrar bak
  Future<void> reload() async => user?.reload();

  // ---------- Çıkış / silme ----------

  /// Çıkınca tekrar anonim olunur (uygulama okumaya devam eder)
  Future<void> signOut() async {
    await _auth.signOut();
    await ensureSignedIn();
  }

  Future<void> deleteAccount() async {
    await user?.delete();
    await ensureSignedIn();
  }

  static bool _alreadyExists(String code) =>
      code == 'credential-already-in-use' || code == 'email-already-in-use' || code == 'account-exists-with-different-credential';
}

/// Kullanıcıya gösterilecek Türkçe hata. Kullanıcı vazgeçtiyse null (mesaj gösterme).
String? authErrorText(Object error) {
  if (error is! FirebaseAuthException) return 'Bir sorun oldu. Tekrar dene.';
  switch (error.code) {
    case 'web-context-canceled':
    case 'web-context-cancelled':
    case 'canceled':
    case 'cancelled':
      return null;
    case 'invalid-email':
      return 'E-posta adresi geçerli değil.';
    case 'user-not-found':
    case 'wrong-password':
    case 'invalid-credential':
    case 'INVALID_LOGIN_CREDENTIALS':
      return 'E-posta ya da şifre hatalı.';
    case 'email-already-in-use':
    case 'credential-already-in-use':
      return 'Bu e-postayla zaten bir hesap var. Giriş yapmayı dene.';
    case 'account-exists-with-different-credential':
      return 'Bu e-posta başka bir yöntemle kayıtlı. O yöntemle giriş yap.';
    case 'weak-password':
    case 'password-does-not-meet-requirements':
      return 'Şifre çok zayıf. En az 6 karakter kullan.';
    case 'user-disabled':
      return 'Bu hesap kapatılmış.';
    case 'too-many-requests':
      return 'Çok fazla deneme yapıldı. Biraz bekleyip tekrar dene.';
    case 'network-request-failed':
      return 'İnternet bağlantısı yok gibi görünüyor.';
    case 'requires-recent-login':
      return 'Güvenlik için çıkış yapıp tekrar giriş yap, sonra yeniden dene.';
    case 'operation-not-allowed':
      return 'Bu giriş yöntemi henüz açık değil.';
    default:
      return 'Bir sorun oldu (${error.code}). Tekrar dene.';
  }
}
