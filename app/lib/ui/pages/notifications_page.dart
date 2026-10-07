import 'package:flutter/material.dart';

import '../../models/programs.dart';
import '../../push/push_service.dart';
import '../../state/app_state.dart';
import '../theme.dart';

/// Bildirim ayarları: yeni kampanya bildirimi aç / kapat + saat seçimi. Ayarlar sadece telefonda.
class NotificationsPage extends StatelessWidget {
  const NotificationsPage({super.key, required this.state});

  final AppState state;

  Future<void> _toggle(BuildContext context, bool on) async {
    final ok = await state.setNotifications(enabled: on);
    if (!ok && context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Bildirim izni verilmedi. Telefon ayarlarından açabilirsin.')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: krAppBar(title: const Text('Bildirimler')),
      body: ListenableBuilder(
        listenable: state,
        builder: (context, _) {
          final on = state.notifyEnabled;
          final cards = programs.where((p) => state.myPrograms.contains(p.id)).map((p) => p.name).join(', ');

          return ListView(
            padding: const EdgeInsets.fromLTRB(20, 4, 20, 32),
            children: [
              Container(
                decoration: BoxDecoration(color: KR.surface, borderRadius: BorderRadius.circular(KR.radius)),
                child: SwitchListTile(
                  value: on,
                  onChanged: (v) => _toggle(context, v),
                  contentPadding: const EdgeInsets.fromLTRB(16, 6, 10, 6),
                  title: const Text('Yeni kampanyalar', style: TextStyle(fontWeight: FontWeight.w700)),
                  subtitle: const Padding(
                    padding: EdgeInsets.only(top: 4),
                    child: Text(
                      'Kartlarına yeni kampanya gelince seçtiğin saatte tek bir bildirimle '
                      'haber veririz: hangi kartta kaç yeni kampanya var.',
                      style: TextStyle(fontSize: 13, height: 1.4),
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 24),
              Text(
                'Ne zaman gelsin?',
                style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: on ? KR.ink : KR.muted),
              ),
              const SizedBox(height: 8),
              for (final slot in NotifySlot.values)
                _SlotRow(
                  slot: slot,
                  selected: state.notifySlot == slot,
                  enabled: on,
                  onTap: () => state.setNotifications(enabled: true, slot: slot),
                ),
              const SizedBox(height: 20),
              Text(
                'Bildirim gelecek kartlar: $cards',
                style: const TextStyle(fontSize: 12.5, color: KR.muted, height: 1.5),
              ),
            ],
          );
        },
      ),
    );
  }
}

class _SlotRow extends StatelessWidget {
  const _SlotRow({required this.slot, required this.selected, required this.enabled, required this.onTap});

  final NotifySlot slot;
  final bool selected;
  final bool enabled;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final active = enabled && selected;
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Material(
        color: KR.surface,
        borderRadius: BorderRadius.circular(KR.radius),
        child: InkWell(
          borderRadius: BorderRadius.circular(KR.radius),
          onTap: enabled ? onTap : null,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(KR.radius),
              border: Border.all(color: active ? KR.brand : KR.line, width: active ? 1.5 : 1),
            ),
            child: Row(
              children: [
                Icon(
                  slot == NotifySlot.noon ? Icons.wb_sunny_outlined : Icons.nights_stay_outlined,
                  color: enabled ? KR.ink : KR.muted,
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(slot.label,
                          style: TextStyle(fontWeight: FontWeight.w700, color: enabled ? KR.ink : KR.muted)),
                      Text(slot.hint, style: const TextStyle(fontSize: 12.5, color: KR.muted)),
                    ],
                  ),
                ),
                if (active) const Icon(Icons.check_circle, color: KR.brand),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
