import 'package:flutter/material.dart';

import '../../models/programs.dart';
import '../../state/app_state.dart';
import '../theme.dart';
import '../widgets/common.dart';

/// İlk açılışta tanıtım: 4 kaydırmalı sayfa. Bir kez gösterilir (AppState.introSeen).
class IntroPage extends StatefulWidget {
  const IntroPage({super.key, required this.state});

  final AppState state;

  @override
  State<IntroPage> createState() => _IntroPageState();
}

class _IntroPageState extends State<IntroPage> {
  final _pages = PageController();
  int _index = 0;

  static const _slides = <_Slide>[
    _Slide(
      title: 'Tüm kart kampanyaları\ntek yerde',
      text: 'Bonus, World, Maximum, Axess ve daha fazlası. Bankaların sitelerini tek tek gezmene gerek yok.',
      art: _CardsArt(),
    ),
    _Slide(
      title: 'Sadece senin\nkartların',
      text: 'Hangi kartların olduğunu seç, sana uymayan kampanyalarla uğraşma. Yemek ve öğrenci kartları da dahil.',
      art: _ChooseArt(),
    ),
    _Slide(
      title: 'Ne kazanacağın\nbir bakışta',
      text: 'Puan, indirim, taksit ya da iade… Kazancı, alt limiti ve nasıl katılacağını tek satırda gör.',
      art: _GainArt(),
    ),
    _Slide(
      title: 'Fırsatı\nkaçırma',
      text: 'Kartına yeni kampanya gelince haber verelim, bitmek üzere olanları en üstte gör.',
      art: _NotifyArt(),
    ),
  ];

  bool get _last => _index == _slides.length - 1;

  void _next() {
    if (_last) {
      widget.state.markIntroSeen();
    } else {
      _pages.nextPage(duration: const Duration(milliseconds: 320), curve: Curves.easeOutCubic);
    }
  }

  @override
  void dispose() {
    _pages.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: KR.surface,
      body: SafeArea(
        child: Column(
          children: [
            // Üst: logo + Geç
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 8, 8, 0),
              child: Row(
                children: [
                  Container(
                    width: 30,
                    height: 30,
                    decoration: BoxDecoration(color: KR.brand, borderRadius: BorderRadius.circular(9)),
                    child: const Icon(Icons.radar, color: Colors.white, size: 19),
                  ),
                  const SizedBox(width: 8),
                  const Text('KartRadar', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w800)),
                  const Spacer(),
                  AnimatedOpacity(
                    opacity: _last ? 0 : 1,
                    duration: const Duration(milliseconds: 200),
                    child: TextButton(
                      onPressed: _last ? null : widget.state.markIntroSeen,
                      child: const Text('Geç'),
                    ),
                  ),
                ],
              ),
            ),

            Expanded(
              child: PageView.builder(
                controller: _pages,
                itemCount: _slides.length,
                onPageChanged: (i) => setState(() => _index = i),
                itemBuilder: (_, i) => _SlideView(_slides[i]),
              ),
            ),

            // Noktalar
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                for (var i = 0; i < _slides.length; i++)
                  AnimatedContainer(
                    duration: const Duration(milliseconds: 220),
                    margin: const EdgeInsets.symmetric(horizontal: 4),
                    width: i == _index ? 22 : 8,
                    height: 8,
                    decoration: BoxDecoration(
                      color: i == _index ? KR.brand : KR.line,
                      borderRadius: BorderRadius.circular(4),
                    ),
                  ),
              ],
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 22, 20, 16),
              child: FilledButton(
                onPressed: _next,
                child: Text(_last ? 'Hemen başla' : 'İleri'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _Slide {
  const _Slide({required this.title, required this.text, required this.art});

  final String title;
  final String text;
  final Widget art;
}

class _SlideView extends StatelessWidget {
  const _SlideView(this.slide);

  final _Slide slide;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, box) => SingleChildScrollView(
        child: ConstrainedBox(
          constraints: BoxConstraints(minHeight: box.maxHeight),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 28),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Çizim alanı
                Container(
                  width: double.infinity,
                  height: 260,
                  decoration: BoxDecoration(
                    color: const Color(0xFFEFF7F6),
                    borderRadius: BorderRadius.circular(28),
                  ),
                  alignment: Alignment.center,
                  child: slide.art,
                ),
                const SizedBox(height: 32),
                Text(slide.title, style: const TextStyle(fontSize: 28, fontWeight: FontWeight.w800, height: 1.18)),
                const SizedBox(height: 12),
                Text(slide.text, style: const TextStyle(fontSize: 15.5, color: KR.muted, height: 1.5)),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/* ---------------- Çizimler (resim dosyası yok, hepsi widget) ---------------- */

/// 1: üst üste kartlar
class _CardsArt extends StatelessWidget {
  const _CardsArt();

  @override
  Widget build(BuildContext context) {
    final picks = ['bonus', 'world', 'maximum', 'axess'].map(programById).toList();
    return SizedBox(
      width: 230,
      height: 180,
      child: Stack(
        alignment: Alignment.center,
        children: [
          for (var i = 0; i < picks.length; i++)
            Transform.translate(
              offset: Offset((i - 1.5) * 26, (i - 1.5) * -14),
              child: Transform.rotate(
                angle: (i - 1.5) * 0.09,
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(18),
                    boxShadow: const [BoxShadow(color: Color(0x22000000), blurRadius: 14, offset: Offset(0, 6))],
                  ),
                  child: CardArt(picks[i], width: 150),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

/// 2: kart seçimi
class _ChooseArt extends StatelessWidget {
  const _ChooseArt();

  @override
  Widget build(BuildContext context) {
    final rows = [('bonus', true), ('bankkart-genc', true), ('multinet', false)];
    return SizedBox(
      width: 250,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          for (final (id, on) in rows)
            Container(
              margin: const EdgeInsets.symmetric(vertical: 5),
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: KR.surface,
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: on ? KR.brand : KR.line, width: on ? 1.6 : 1),
              ),
              child: Row(
                children: [
                  CardArt(programById(id), width: 44),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(programById(id).name, style: const TextStyle(fontWeight: FontWeight.w700)),
                  ),
                  Icon(on ? Icons.check_circle : Icons.radio_button_unchecked, color: on ? KR.brand : KR.line),
                ],
              ),
            ),
        ],
      ),
    );
  }
}

/// 3: kampanya kartı ve kazanç
class _GainArt extends StatelessWidget {
  const _GainArt();

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 250,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: KR.surface,
        borderRadius: BorderRadius.circular(18),
        boxShadow: const [BoxShadow(color: Color(0x14000000), blurRadius: 16, offset: Offset(0, 6))],
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              CardArt(programById('axess'), width: 34),
              const SizedBox(width: 8),
              const Text('Market', style: TextStyle(fontSize: 12.5, color: KR.muted)),
            ],
          ),
          const SizedBox(height: 10),
          Container(height: 10, width: 190, decoration: _bar),
          const SizedBox(height: 6),
          Container(height: 10, width: 140, decoration: _bar),
          const SizedBox(height: 14),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(color: KR.gainBg, borderRadius: BorderRadius.circular(12)),
            child: const Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('400 TL puan', style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800, color: KR.gain)),
                SizedBox(height: 2),
                Text('2.000 TL ve üzeri alışverişe', style: TextStyle(fontSize: 12.5)),
              ],
            ),
          ),
          const SizedBox(height: 10),
          const Row(
            children: [
              Icon(Icons.smartphone, size: 16, color: KR.muted),
              SizedBox(width: 6),
              Text('Uygulamadan katıl', style: TextStyle(fontSize: 12.5, color: KR.muted)),
            ],
          ),
        ],
      ),
    );
  }

  static final _bar = BoxDecoration(color: KR.line, borderRadius: BorderRadius.circular(5));
}

/// 4: bildirim
class _NotifyArt extends StatelessWidget {
  const _NotifyArt();

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 260,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: KR.surface,
              borderRadius: BorderRadius.circular(16),
              boxShadow: const [BoxShadow(color: Color(0x1A000000), blurRadius: 16, offset: Offset(0, 6))],
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  width: 34,
                  height: 34,
                  decoration: BoxDecoration(color: KR.brand, borderRadius: BorderRadius.circular(9)),
                  child: const Icon(Icons.radar, color: Colors.white, size: 20),
                ),
                const SizedBox(width: 10),
                const Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('KartRadar', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 13.5)),
                      SizedBox(height: 2),
                      Text('Yeni kampanyalar radarımıza takıldı! Axess: 3 · World: 1',
                          style: TextStyle(fontSize: 12.5, height: 1.35)),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
                decoration: BoxDecoration(color: KR.urgentBg, borderRadius: BorderRadius.circular(999)),
                child: const Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(Icons.local_fire_department_outlined, size: 16, color: KR.urgent),
                    SizedBox(width: 6),
                    Text('Son 2 gün', style: TextStyle(color: KR.urgent, fontWeight: FontWeight.w700, fontSize: 13)),
                  ],
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
