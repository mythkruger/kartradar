import 'package:flutter/material.dart';

import '../../legal/legal_texts.dart';
import '../theme.dart';

/// Gizlilik / KVKK ve Yasal uyarı sayfaları
class LegalPage extends StatelessWidget {
  const LegalPage({super.key, required this.title, required this.sections});

  const LegalPage.privacy({super.key})
      : title = 'Gizlilik ve KVKK Aydınlatma Metni',
        sections = kPrivacySections;

  const LegalPage.terms({super.key})
      : title = 'Yasal uyarı',
        sections = kTermsSections;

  final String title;
  final List<LegalSection> sections;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: krAppBar(title: Text(title, style: const TextStyle(fontSize: 17))),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 32),
        children: [
          for (final s in sections) ...[
            Text(s.title, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800)),
            const SizedBox(height: 6),
            SelectableText(s.body, style: const TextStyle(fontSize: 14, height: 1.55, color: KR.ink)),
            const SizedBox(height: 20),
          ],
        ],
      ),
    );
  }
}
