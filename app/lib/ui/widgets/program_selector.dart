import 'package:flutter/material.dart';

import '../../models/programs.dart';
import '../theme.dart';
import 'common.dart';

/// Kart programı seçme listesi (ilk açılış + Kartlarım)
class ProgramSelector extends StatelessWidget {
  const ProgramSelector({super.key, required this.selected, required this.onChanged});

  final Set<String> selected;
  final ValueChanged<Set<String>> onChanged;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        for (final (kind, group) in programsByKind()) ...[
          KindHeader(kind),
          for (final p in group) ...[
            _ProgramOption(
              program: p,
              selected: selected.contains(p.id),
              onTap: () {
                final next = {...selected};
                if (!next.remove(p.id)) next.add(p.id);
                onChanged(next);
              },
            ),
            const SizedBox(height: 10),
          ],
          const SizedBox(height: 12),
        ],
      ],
    );
  }
}

class _ProgramOption extends StatelessWidget {
  const _ProgramOption({required this.program, required this.selected, required this.onTap});

  final Program program;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final p = program;
    return AnimatedContainer(
      duration: const Duration(milliseconds: 180),
      decoration: BoxDecoration(
        color: selected ? p.color.withValues(alpha: 0.06) : KR.surface,
        borderRadius: BorderRadius.circular(KR.radius),
        border: Border.all(color: selected ? p.color : KR.line, width: selected ? 1.6 : 1),
      ),
      child: Material(
        type: MaterialType.transparency,
        child: InkWell(
        borderRadius: BorderRadius.circular(KR.radius),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Row(
            children: [
              CardArt(p),
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
                            style: const TextStyle(fontSize: 15.5, fontWeight: FontWeight.w700),
                          ),
                        ),
                        if (p.tag != null) ...[const SizedBox(width: 6), TagPill(p.tag!, color: p.color)],
                      ],
                    ),
                    const SizedBox(height: 2),
                    Text(p.cards, style: const TextStyle(fontSize: 12.5, color: KR.muted)),
                  ],
                ),
              ),
              AnimatedSwitcher(
                duration: const Duration(milliseconds: 150),
                child: selected
                    ? Icon(Icons.check_circle, key: const ValueKey(1), color: p.color, size: 26)
                    : const Icon(Icons.radio_button_unchecked, key: ValueKey(0), color: KR.line, size: 26),
              ),
            ],
          ),
        ),
      ),
      ),
    );
  }
}

/// Grup başlığı: "Yemek ve yan hak kartların" + kısa açıklama
class KindHeader extends StatelessWidget {
  const KindHeader(this.kind, {super.key});

  final ProgramKind kind;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10, top: 4),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(kindTitles[kind]!, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w800)),
          const SizedBox(height: 2),
          Text(kindHints[kind]!, style: const TextStyle(fontSize: 12.5, color: KR.muted)),
        ],
      ),
    );
  }
}
