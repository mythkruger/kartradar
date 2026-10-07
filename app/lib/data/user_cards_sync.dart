import 'package:cloud_firestore/cloud_firestore.dart';

/*
 * Giriş yapan kullanıcının kartları: users/{uid} = { programs: [...], updatedAt }
 * Sadece gerçek hesapla girenlerde (anonimde yazılmaz).
 * Maliyet: girişte 1 okuma, kart eklenip çıkarılınca 1 yazma. Kampanya okumasıyla ilgisi yok.
 * Kurallar: firebase/firestore.rules → herkes sadece kendi belgesine, sadece bu iki alan.
 */
class UserCardsSync {
  UserCardsSync({FirebaseFirestore? db}) : _db = db ?? FirebaseFirestore.instance;

  final FirebaseFirestore _db;

  DocumentReference<Map<String, dynamic>> _doc(String uid) => _db.collection('users').doc(uid);

  /// Hesapta kayıtlı kartlar. Belge yoksa null.
  Future<Set<String>?> load(String uid) async {
    final snap = await _doc(uid).get();
    final list = snap.data()?['programs'];
    return list is List ? list.whereType<String>().toSet() : null;
  }

  Future<void> save(String uid, Set<String> programs) => _doc(uid).set({
        'programs': programs.toList()..sort(),
        'updatedAt': FieldValue.serverTimestamp(),
      });

  Future<void> delete(String uid) => _doc(uid).delete();
}
