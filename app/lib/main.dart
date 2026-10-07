import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/material.dart';

import 'auth/auth_service.dart';
import 'data/campaign_repository.dart';
import 'data/card_store.dart';
import 'data/firestore_campaign_repository.dart';
import 'data/user_cards_sync.dart';
// flutterfire configure üretir. Gizli değer içerir, git'e girmez (.gitignore).
import 'firebase_options.dart';
import 'push/fcm_push_service.dart';
import 'state/app_state.dart';
import 'ui/pages/home_page.dart';
import 'ui/pages/onboarding_page.dart';
import 'ui/theme.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Firebase.initializeApp(options: DefaultFirebaseOptions.currentPlatform);
  await FirebaseAuth.instance.setLanguageCode('tr'); // doğrulama / şifre e-postaları Türkçe
  await FcmPushService.setup(); // bildirimler: uygulama kapalıyken de gelen mesajı yakalar

  // Telefonda önbellek: değişmeyen kart listesi tekrar indirilmez (okuma yok)
  FirebaseFirestore.instance.settings = const Settings(
    persistenceEnabled: true,
    cacheSizeBytes: 40 * 1024 * 1024,
  );

  final auth = AuthService();
  auth.ensureSignedIn(); // anonim giriş arka planda, açılışı bekletmez

  // Geliştirme: bilgisayardaki admin sunucusundan okumak için
  //   flutter run --dart-define=USE_API=true
  const useApi = bool.fromEnvironment('USE_API');
  final CampaignRepository repository = useApi
      ? ApiCampaignRepository()
      : FirestoreCampaignRepository(beforeRead: auth.ensureSignedIn);

  final state = AppState(
    repository: repository,
    cardStore: CardStore(),
    push: FcmPushService(),
    auth: auth,
    userCards: UserCardsSync(),
  )..init();

  runApp(KartRadarApp(state: state));
}

class KartRadarApp extends StatelessWidget {
  const KartRadarApp({super.key, required this.state});

  final AppState state;

  @override
  Widget build(BuildContext context) {
    return AppScope(
      state: state,
      child: MaterialApp(
      title: 'KartRadar',
      debugShowCheckedModeBanner: false,
      theme: buildTheme(),
      home: ListenableBuilder(
        listenable: state,
        builder: (context, _) {
          if (!state.ready) {
            return const Scaffold(body: Center(child: CircularProgressIndicator()));
          }
          // Kart seçilmediyse önce kart seçimi
          if (state.myPrograms.isEmpty) return OnboardingPage(state: state);
          return HomePage(state: state);
        },
      ),
      ),
    );
  }
}
