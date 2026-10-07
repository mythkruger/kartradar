import 'package:shared_preferences/shared_preferences.dart';

/*
 * Kullanıcının seçtiği kartlar telefonda tutulur (giriş yapmadan da çalışır).
 * Giriş yapan kullanıcıda ayrıca hesaba yazılır: data/user_cards_sync.dart
 */
class CardStore {
  static const _key = 'myPrograms';

  Future<Set<String>> load() async {
    final prefs = await SharedPreferences.getInstance();
    return (prefs.getStringList(_key) ?? const []).toSet();
  }

  Future<void> save(Set<String> ids) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setStringList(_key, ids.toList()..sort());
  }
}
