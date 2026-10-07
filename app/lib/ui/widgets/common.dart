import 'package:flutter/material.dart';

import '../../models/campaign.dart';
import '../../models/programs.dart';
import '../format.dart';
import '../theme.dart';

/// Program rozeti: renkli nokta + ad ("● Bonus")
class ProgramBadge extends StatelessWidget {
  const ProgramBadge(this.programId, {super.key, this.solid = false});

  final String programId;
  final bool solid;

  @override
  Widget build(BuildContext context) {
    final p = programById(programId);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: solid ? p.color : p.color.withValues(alpha: 0.10),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (!solid) ...[
            Container(
              width: 6,
              height: 6,
              decoration: BoxDecoration(color: p.color, shape: BoxShape.circle),
            ),
            const SizedBox(width: 5),
          ],
          Text(
            p.name,
            style: TextStyle(
              fontSize: 11.5,
              fontWeight: FontWeight.w700,
              color: solid ? Colors.white : p.color,
            ),
          ),
        ],
      ),
    );
  }
}

/// Kampanya görseli; yoksa program renginde sektör ikonu
class CampaignImage extends StatelessWidget {
  const CampaignImage(this.campaign, {super.key, this.radius = 12});

  final Campaign campaign;
  final double radius;

  @override
  Widget build(BuildContext context) {
    final p = programById(campaign.programId);
    final placeholder = Container(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [p.color.withValues(alpha: 0.85), p.color.withValues(alpha: 0.55)],
        ),
      ),
      alignment: Alignment.center,
      child: Icon(sectorIcon(campaign.sectors.first), color: Colors.white, size: 28),
    );

    final url = campaign.imageUrl;
    return ClipRRect(
      borderRadius: BorderRadius.circular(radius),
      child: url == null
          ? placeholder
          : Image.network(
              url,
              fit: BoxFit.cover,
              errorBuilder: (_, __, ___) => placeholder,
              loadingBuilder: (context, child, progress) =>
                  progress == null ? child : Container(color: KR.line),
            ),
    );
  }
}

/// "Bugün bitiyor" / "3 gün kaldı" etiketi
class DaysLeftPill extends StatelessWidget {
  const DaysLeftPill(this.campaign, {super.key});

  final Campaign campaign;

  @override
  Widget build(BuildContext context) {
    final text = daysLeftText(campaign);
    if (text == null) return const SizedBox.shrink();
    final urgent = campaign.isEndingSoon;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: urgent ? KR.urgentBg : KR.bg,
        borderRadius: BorderRadius.circular(20),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.schedule, size: 12, color: urgent ? KR.urgent : KR.muted),
          const SizedBox(width: 4),
          Text(
            text,
            style: TextStyle(
              fontSize: 11.5,
              fontWeight: FontWeight.w600,
              color: urgent ? KR.urgent : KR.muted,
            ),
          ),
        ],
      ),
    );
  }
}

IconData joinIcon(JoinMethod? j) => switch (j) {
      JoinMethod.app => Icons.touch_app_outlined,
      JoinMethod.sms => Icons.sms_outlined,
      JoinMethod.auto => Icons.bolt_outlined,
      null => Icons.help_outline,
    };

/// Küçük kart çizimi (bankanın tasarımı değil, kendi çizimimiz).
/// Program `stripes` verdiyse kartın üzerinde çapraz renkli çizgiler olur.
class CardArt extends StatelessWidget {
  const CardArt(this.program, {super.key, this.width = 56, this.muted = false});

  final Program program;
  final double width;
  final bool muted;

  @override
  Widget build(BuildContext context) {
    final p = program;
    final height = width * 0.68;

    Widget stripes = const SizedBox.shrink();
    if (p.stripes.isNotEmpty) {
      // Sert geçişli gradyan = çizgiler: her renk bir bant, aralarda kart rengi
      final colors = <Color>[];
      final stops = <double>[];
      final n = p.stripes.length;
      const start = 0.45, band = 0.07;
      for (var i = 0; i < n; i++) {
        final a = start + i * band;
        colors..add(p.stripes[i])..add(p.stripes[i]);
        stops..add(a)..add(a + band);
      }
      stripes = DecoratedBox(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topRight,
            end: Alignment.bottomLeft,
            colors: [Colors.transparent, Colors.transparent, ...colors, Colors.transparent, Colors.transparent],
            stops: [0, start, ...stops, start + n * band, 1],
          ),
        ),
      );
    }

    return Opacity(
      opacity: muted ? 0.55 : 1,
      child: Container(
        width: width,
        height: height,
        clipBehavior: Clip.antiAlias,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(width * 0.125),
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [p.color, p.color.withValues(alpha: 0.7)],
          ),
        ),
        child: Stack(
          fit: StackFit.expand,
          children: [
            stripes,
            Align(
              alignment: Alignment.bottomLeft,
              child: Padding(
                padding: EdgeInsets.all(width * 0.1),
                child: Container(
                  width: width * 0.21,
                  height: width * 0.16,
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.8),
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Küçük etiket ("Öğrenci")
class TagPill extends StatelessWidget {
  const TagPill(this.text, {super.key, required this.color});

  final String text;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
      decoration: BoxDecoration(color: color.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(6)),
      child: Text(text, style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.w800, color: color)),
    );
  }
}
