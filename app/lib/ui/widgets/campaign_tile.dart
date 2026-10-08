import 'package:flutter/material.dart';

import '../../models/campaign.dart';
import '../format.dart';
import '../pages/campaign_detail_page.dart';
import '../theme.dart';
import 'common.dart';

void openCampaign(BuildContext context, Campaign c) {
  Navigator.of(context).push(
    MaterialPageRoute(builder: (_) => CampaignDetailPage(campaign: c)),
  );
}

/// Liste satırı: görsel | program + işyeri, başlık, kazanç, kalan gün
class CampaignTile extends StatelessWidget {
  const CampaignTile(this.campaign, {super.key});

  final Campaign campaign;

  @override
  Widget build(BuildContext context) {
    final c = campaign;
    final minSpend = minSpendText(c.benefit);

    return Material(
      color: KR.surface,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(KR.radius),
        side: const BorderSide(color: KR.cardBorder, width: 1.2),
      ),
      child: InkWell(
        borderRadius: BorderRadius.circular(KR.radius),
        onTap: () => openCampaign(context, c),
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              SizedBox(width: 84, height: 84, child: CampaignImage(c)),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        ProgramBadge(c.programId),
                        if (c.merchant != null) ...[
                          const SizedBox(width: 6),
                          Flexible(
                            child: Text(
                              c.merchant!,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(fontSize: 12, color: KR.muted),
                            ),
                          ),
                        ],
                        if (c.isNew) ...[
                          const SizedBox(width: 6),
                          const _NewDot(),
                        ],
                      ],
                    ),
                    const SizedBox(height: 6),
                    Text(
                      c.title,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600, height: 1.3),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      benefitHeadline(c.benefit),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w700,
                        color: c.benefit.isEmpty ? KR.muted : KR.gain,
                      ),
                    ),
                    if (minSpend != null)
                      Text(minSpend, style: const TextStyle(fontSize: 11.5, color: KR.muted)),
                    const SizedBox(height: 8),
                    Row(
                      children: [
                        DaysLeftPill(c),
                        const Spacer(),
                        Icon(joinIcon(c.join), size: 16, color: KR.muted),
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _NewDot extends StatelessWidget {
  const _NewDot();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(color: KR.brand, borderRadius: BorderRadius.circular(6)),
      child: const Text(
        'YENİ',
        style: TextStyle(fontSize: 9.5, fontWeight: FontWeight.w800, color: Colors.white),
      ),
    );
  }
}

/// "Bitmek üzere" şeridindeki büyük kart
class EndingSoonCard extends StatelessWidget {
  const EndingSoonCard(this.campaign, {super.key});

  final Campaign campaign;

  @override
  Widget build(BuildContext context) {
    final c = campaign;
    return SizedBox(
      width: 240,
      child: Material(
        color: KR.surface,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(KR.radius),
          side: const BorderSide(color: KR.cardBorder, width: 1.2),
        ),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: () => openCampaign(context, c),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              SizedBox(
                height: 110,
                width: double.infinity,
                child: Stack(
                  fit: StackFit.expand,
                  children: [
                    CampaignImage(c, radius: 0),
                    Positioned(left: 10, top: 10, child: DaysLeftPill(c)),
                  ],
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(12, 10, 12, 12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    ProgramBadge(c.programId),
                    const SizedBox(height: 6),
                    Text(
                      c.title,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(fontSize: 13.5, fontWeight: FontWeight.w600, height: 1.3),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      benefitHeadline(c.benefit),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        fontSize: 12.5,
                        fontWeight: FontWeight.w700,
                        color: c.benefit.isEmpty ? KR.muted : KR.gain,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
