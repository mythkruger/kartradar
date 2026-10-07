import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../models/campaign.dart';
import '../../models/programs.dart';
import '../../state/app_state.dart';
import '../format.dart';
import '../theme.dart';
import '../widgets/common.dart';

/// Kampanya detayı: özet bilgiler + "Bankanın sayfasında gör"
/// Tam koşullar bankanın sayfasında; biz metni kopyalamıyoruz, özetliyoruz.
class CampaignDetailPage extends StatefulWidget {
  const CampaignDetailPage({super.key, required this.campaign});

  final Campaign campaign;

  @override
  State<CampaignDetailPage> createState() => _CampaignDetailPageState();
}

class _CampaignDetailPageState extends State<CampaignDetailPage> {
  Future<String?>? _summary;

  Campaign get campaign => widget.campaign;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    // Özet ayrı belgede: sayfa açılınca bir kez okunur
    _summary ??= AppScope.of(context).repository.summary(campaign);
  }

  Future<void> _open(BuildContext context) async {
    final ok = await launchUrl(Uri.parse(campaign.url), mode: LaunchMode.externalApplication);
    if (!ok && context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Sayfa açılamadı')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = campaign;
    final p = programById(c.programId);
    final minSpend = minSpendText(c.benefit);
    final left = daysLeftText(c);

    return Scaffold(
      body: CustomScrollView(
        slivers: [
          SliverAppBar(
            pinned: true,
            expandedHeight: 220,
            backgroundColor: KR.surface,
            foregroundColor: KR.ink,
            flexibleSpace: FlexibleSpaceBar(
              background: CampaignImage(c, radius: 0),
            ),
          ),
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(20, 18, 20, 24),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      ProgramBadge(c.programId),
                      const SizedBox(width: 8),
                      Text(p.bank, style: const TextStyle(fontSize: 12.5, color: KR.muted)),
                    ],
                  ),
                  const SizedBox(height: 10),
                  Text(
                    c.title,
                    style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800, height: 1.3),
                  ),
                  const SizedBox(height: 16),

                  // Kazanç kutusu
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: c.benefit.isEmpty ? KR.bg : KR.gainBg,
                      borderRadius: BorderRadius.circular(KR.radius),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text('Kazancın', style: TextStyle(fontSize: 12, color: KR.muted)),
                        const SizedBox(height: 4),
                        Text(
                          benefitHeadline(c.benefit),
                          style: TextStyle(
                            fontSize: 22,
                            fontWeight: FontWeight.w800,
                            color: c.benefit.isEmpty ? KR.muted : KR.gain,
                          ),
                        ),
                        if (minSpend != null) ...[
                          const SizedBox(height: 2),
                          Text(minSpend, style: const TextStyle(fontSize: 13, color: KR.ink)),
                        ],
                      ],
                    ),
                  ),
                  const SizedBox(height: 16),

                  _InfoRow(
                    icon: Icons.event_outlined,
                    label: 'Tarih',
                    value: dateRange(c),
                    trailing: left != null ? DaysLeftPill(c) : null,
                  ),
                  _InfoRow(icon: joinIcon(c.join), label: 'Katılım', value: joinLabel(c.join)),
                  if (c.merchant != null)
                    _InfoRow(icon: Icons.storefront_outlined, label: 'İşyeri', value: c.merchant!),
                  _InfoRow(
                    icon: sectorIcon(c.sectors.first),
                    label: 'Sektör',
                    value: c.sectors.map(sectorLabel).join(', '),
                  ),

                  FutureBuilder<String?>(
                    future: _summary,
                    builder: (context, snap) {
                      if (snap.connectionState != ConnectionState.done) {
                        return const Padding(
                          padding: EdgeInsets.only(top: 20),
                          child: LinearProgressIndicator(minHeight: 2),
                        );
                      }
                      final text = snap.data?.trim();
                      if (text == null || text.isEmpty) return const SizedBox.shrink();
                      return Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const SizedBox(height: 18),
                          const Text('Özet', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700)),
                          const SizedBox(height: 6),
                          Text(text, style: const TextStyle(fontSize: 14, height: 1.5, color: KR.ink)),
                        ],
                      );
                    },
                  ),
                  const SizedBox(height: 12),
                  const Text(
                    'Tüm koşullar ve katılım adımları bankanın sayfasındadır.',
                    style: TextStyle(fontSize: 12, color: KR.muted),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
      bottomNavigationBar: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 8, 20, 12),
          child: FilledButton.icon(
            onPressed: () => _open(context),
            icon: const Icon(Icons.open_in_new, size: 18),
            label: Text('${p.name} sayfasında gör'),
          ),
        ),
      ),
    );
  }
}

class _InfoRow extends StatelessWidget {
  const _InfoRow({required this.icon, required this.label, required this.value, this.trailing});

  final IconData icon;
  final String label;
  final String value;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 12),
      decoration: const BoxDecoration(border: Border(bottom: BorderSide(color: KR.line))),
      child: Row(
        children: [
          Icon(icon, size: 20, color: KR.muted),
          const SizedBox(width: 12),
          SizedBox(
            width: 70,
            child: Text(label, style: const TextStyle(fontSize: 13, color: KR.muted)),
          ),
          Expanded(
            child: Text(value, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
          ),
          if (trailing != null) trailing!,
        ],
      ),
    );
  }
}
