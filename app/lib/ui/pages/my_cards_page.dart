import 'package:flutter/material.dart';

import '../../models/programs.dart';
import '../../state/app_state.dart';
import '../theme.dart';
import '../widgets/common.dart';
import '../widgets/program_selector.dart';

/// Kartlarım: sahip olduğun kartlar (çıkar) + eklenebilecek kartlar (ekle).
/// Değişiklik anında kaydedilir.
class MyCardsPage extends StatelessWidget {
  const MyCardsPage({super.key, required this.state});

  final AppState state;

  Future<void> _remove(BuildContext context, Program p) async {
    final ok = await state.removeProgram(p.id);
    if (!context.mounted) return;
    ScaffoldMessenger.of(context).hideCurrentSnackBar();
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(ok ? '${p.name} kartlarından çıkarıldı' : 'En az bir kartın olmalı'),
        action: ok ? SnackBarAction(label: 'Geri al', onPressed: () => state.addProgram(p.id)) : null,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: krAppBar(title: const Text('Kartlarım')),
      body: ListenableBuilder(
        listenable: state,
        builder: (context, _) {
          final mine = programs.where((p) => state.myPrograms.contains(p.id)).toList();
          final others = programs.where((p) => !state.myPrograms.contains(p.id)).toList();

          return ListView(
            padding: const EdgeInsets.fromLTRB(20, 4, 20, 32),
            children: [
              const Text(
                'Kampanyalar bu kartlara göre listelenir. Ana sayfadaki kart çipleriyle '
                'o gün hangi kartlarını göreceğini ayrıca seçebilirsin.',
                style: TextStyle(fontSize: 13.5, color: KR.muted, height: 1.4),
              ),
              const SizedBox(height: 20),
              _SectionTitle('Kartlarım', count: mine.length),
              for (final p in mine)
                _CardRow(
                  program: p,
                  subtitle: '${state.countFor(p.id)} aktif kampanya',
                  action: IconButton(
                    tooltip: 'Çıkar',
                    icon: const Icon(Icons.remove_circle_outline),
                    color: KR.muted,
                    onPressed: () => _remove(context, p),
                  ),
                ),
              if (others.isNotEmpty) ...[
                const SizedBox(height: 24),
                _SectionTitle('Kart ekle', count: others.length),
                for (final (kind, group) in programsByKind(others)) ...[
                  KindHeader(kind),
                  for (final p in group)
                    _CardRow(
                      program: p,
                      subtitle: p.cards,
                      muted: true,
                      action: FilledButton.tonalIcon(
                        style: FilledButton.styleFrom(minimumSize: const Size(0, 38)),
                        onPressed: () => state.addProgram(p.id),
                        icon: const Icon(Icons.add, size: 18),
                        label: const Text('Ekle'),
                      ),
                    ),
                  const SizedBox(height: 8),
                ],
              ],
            ],
          );
        },
      ),
    );
  }
}

class _SectionTitle extends StatelessWidget {
  const _SectionTitle(this.text, {required this.count});

  final String text;
  final int count;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Row(
        children: [
          Text(text, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800)),
          const SizedBox(width: 6),
          Text('$count', style: const TextStyle(fontSize: 14, color: KR.muted)),
        ],
      ),
    );
  }
}

class _CardRow extends StatelessWidget {
  const _CardRow({
    required this.program,
    required this.subtitle,
    required this.action,
    this.muted = false,
  });

  final Program program;
  final String subtitle;
  final Widget action;
  final bool muted;

  @override
  Widget build(BuildContext context) {
    final p = program;
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.fromLTRB(14, 12, 8, 12),
      decoration: BoxDecoration(
        color: KR.surface,
        borderRadius: BorderRadius.circular(KR.radius),
        border: Border.all(color: KR.line),
      ),
      child: Row(
        children: [
          CardArt(p, muted: muted),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Flexible(
                      child: Text(
                        '${p.name} · ${p.bank}',
                        style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700),
                      ),
                    ),
                    if (p.tag != null) ...[const SizedBox(width: 6), TagPill(p.tag!, color: p.color)],
                  ],
                ),
                const SizedBox(height: 2),
                Text(subtitle, style: const TextStyle(fontSize: 12.5, color: KR.muted)),
              ],
            ),
          ),
          action,
        ],
      ),
    );
  }
}
