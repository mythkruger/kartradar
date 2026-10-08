import 'package:flutter/material.dart';

import '../../state/app_state.dart';
import '../theme.dart';
import '../widgets/program_selector.dart';

/// İlk açılış: "Hangi kartların var?"
class OnboardingPage extends StatefulWidget {
  const OnboardingPage({super.key, required this.state});

  final AppState state;

  @override
  State<OnboardingPage> createState() => _OnboardingPageState();
}

class _OnboardingPageState extends State<OnboardingPage> {
  Set<String> _selected = {};

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Column(
          children: [
            Expanded(
              child: ListView(
                padding: const EdgeInsets.fromLTRB(20, 32, 20, 20),
                children: [
                  const _Logo(),
                  const SizedBox(height: 28),
                  const Text(
                    'Hangi kartların var?',
                    style: TextStyle(fontSize: 26, fontWeight: FontWeight.w800, height: 1.2),
                  ),
                  const SizedBox(height: 8),
                  const Text(
                    'Sadece senin kartlarına uyan kampanyaları gösterelim. '
                    'İstediğin zaman değiştirebilirsin.',
                    style: TextStyle(fontSize: 14.5, color: KR.muted, height: 1.45),
                  ),
                  const SizedBox(height: 24),
                  ProgramSelector(
                    selected: _selected,
                    onChanged: (s) => setState(() => _selected = s),
                  ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 8, 20, 16),
              child: FilledButton(
                onPressed: _selected.isEmpty ? null : () => widget.state.setPrograms(_selected),
                child: Text(
                  _selected.isEmpty ? 'En az bir kart seç' : 'Kampanyaları göster (${_selected.length} kart)',
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _Logo extends StatelessWidget {
  const _Logo();

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Container(
          width: 36,
          height: 36,
          decoration: BoxDecoration(color: KR.brand, borderRadius: BorderRadius.circular(10)),
          child: const Icon(Icons.radar, color: Colors.white, size: 22),
        ),
        const SizedBox(width: 10),
        const Text('KartRadar', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
      ],
    );
  }
}
