import 'package:flutter/material.dart';

import '../../models/campaign.dart';
import '../../models/programs.dart';
import '../../state/app_state.dart';
import '../format.dart';
import '../theme.dart';
import '../widgets/campaign_tile.dart';
import '../widgets/common.dart';
import 'account_page.dart';
import 'my_cards_page.dart';

/// Ana sayfa: kartlarına uyan kampanyalar
///  - Bitmek üzere şeridi (filtre yokken)
///  - Arama + sektör çipleri + Filtre sayfası
///  - Liste
class HomePage extends StatefulWidget {
  const HomePage({super.key, required this.state});

  final AppState state;

  @override
  State<HomePage> createState() => _HomePageState();
}

class _HomePageState extends State<HomePage> {
  final _search = TextEditingController();
  final _scroll = ScrollController();

  /// Aşağı inildikçe görünen "başa dön" oku
  final _showTop = ValueNotifier(false);

  AppState get state => widget.state;

  @override
  void initState() {
    super.initState();
    _scroll.addListener(() {
      final show = _scroll.hasClients && _scroll.offset > 700;
      if (show != _showTop.value) _showTop.value = show;
    });
  }

  @override
  void dispose() {
    _search.dispose();
    _scroll.dispose();
    _showTop.dispose();
    super.dispose();
  }

  void _toTop() {
    _scroll.animateTo(0, duration: const Duration(milliseconds: 450), curve: Curves.easeOutCubic);
  }

  void _openMyCards() {
    Navigator.of(context).push(MaterialPageRoute(builder: (_) => MyCardsPage(state: state)));
  }

  void _openAccount() {
    Navigator.of(context).push(MaterialPageRoute(builder: (_) => AccountPage(state: state)));
  }

  void _clear() {
    _search.clear();
    state.clearFilters();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: krAppBar(
        titleSpacing: 20,
        title: Row(
          children: [
            Container(
              width: 30,
              height: 30,
              decoration: BoxDecoration(color: KR.brand, borderRadius: BorderRadius.circular(9)),
              child: const Icon(Icons.radar, color: Colors.white, size: 19),
            ),
            const SizedBox(width: 9),
            const Text('KartRadar', style: TextStyle(fontSize: 19, fontWeight: FontWeight.w800)),
          ],
        ),
        actions: [
          // Hesabım: giriş / kayıt + bildirim ayarları
          ListenableBuilder(
            listenable: state,
            builder: (context, _) => IconButton(
              tooltip: 'Hesabım',
              onPressed: _openAccount,
              icon: Icon(state.signedIn ? Icons.account_circle : Icons.account_circle_outlined),
            ),
          ),
          TextButton.icon(
            onPressed: _openMyCards,
            icon: const Icon(Icons.credit_card, size: 18),
            label: const Text('Kartlarım'),
          ),
          const SizedBox(width: 8),
        ],
      ),
      body: ListenableBuilder(
        listenable: state,
        builder: (context, _) {
          return RefreshIndicator(
            onRefresh: () => state.refresh(force: true),
            child: CustomScrollView(
              controller: _scroll,
              physics: const AlwaysScrollableScrollPhysics(),
              slivers: _slivers(context),
            ),
          );
        },
      ),
      // Başa dön: liste uzunken görünür, dokununca en üste kayar
      floatingActionButton: ValueListenableBuilder<bool>(
        valueListenable: _showTop,
        builder: (context, show, _) => AnimatedScale(
          scale: show ? 1 : 0,
          duration: const Duration(milliseconds: 200),
          curve: Curves.easeOut,
          child: FloatingActionButton.small(
            heroTag: 'toTop',
            tooltip: 'Başa dön',
            onPressed: show ? _toTop : null,
            backgroundColor: KR.brand,
            foregroundColor: Colors.white,
            elevation: 3,
            child: const Icon(Icons.keyboard_arrow_up, size: 26),
          ),
        ),
      ),
    );
  }

  List<Widget> _slivers(BuildContext context) {
    if (state.loading && state.campaigns.isEmpty) {
      return const [
        SliverFillRemaining(child: Center(child: CircularProgressIndicator())),
      ];
    }
    if (state.error != null && state.campaigns.isEmpty) {
      return [SliverFillRemaining(child: _ErrorView(onRetry: () => state.refresh(force: true)))];
    }

    final items = state.filtered;
    final ending = state.endingSoon;

    return [
      // Başlık: kaç kampanya
      SliverToBoxAdapter(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 4, 20, 12),
          child: Text.rich(
            TextSpan(
              children: [
                TextSpan(
                  text: '${state.byCard.length} kampanya',
                  style: const TextStyle(fontWeight: FontWeight.w800),
                ),
                TextSpan(
                  text: state.shownPrograms.isEmpty
                      ? ' kartlarına uygun'
                      : ' seçtiğin ${state.shownPrograms.length == 1 ? 'kartta' : 'kartlarda'}',
                ),
              ],
            ),
            style: const TextStyle(fontSize: 22, height: 1.25),
          ),
        ),
      ),

      // Kart çipleri: bugün hangi kartlarım?
      SliverToBoxAdapter(child: _CardBar(state: state, onAdd: _openMyCards)),

      // Arama
      SliverToBoxAdapter(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 10, 20, 14),
          child: TextField(
            controller: _search,
            onChanged: state.setQuery,
            textInputAction: TextInputAction.search,
            decoration: krInput(
              hint: 'Market, akaryakıt, marka ara…',
              prefixIcon: const Icon(Icons.search),
              suffixIcon: state.query.isEmpty
                  ? null
                  : IconButton(
                      icon: const Icon(Icons.close),
                      onPressed: () {
                        _search.clear();
                        state.setQuery('');
                      },
                    ),
            ),
          ),
        ),
      ),

      // Bitmek üzere (filtre yokken)
      if (!state.hasFilters && ending.isNotEmpty) ...[
        _sectionTitle('Bitmek üzere', trailing: '${ending.length}', icon: Icons.local_fire_department_outlined),
        SliverToBoxAdapter(
          child: SizedBox(
            height: 232,
            child: ListView.separated(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              scrollDirection: Axis.horizontal,
              itemCount: ending.length,
              separatorBuilder: (_, __) => const SizedBox(width: 12),
              itemBuilder: (_, i) => EndingSoonCard(ending[i]),
            ),
          ),
        ),
        const SliverToBoxAdapter(child: SizedBox(height: 18)),
      ],

      // Filtreler: Sektör · Kazanç · Katılım (açılır menüler)
      SliverToBoxAdapter(child: _FilterBar(state: state)),

      // Sonuç başlığı
      SliverToBoxAdapter(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 14, 12, 8),
          child: Row(
            children: [
              Text(
                state.hasFilters ? '${items.length} sonuç' : 'Tüm kampanyalar',
                style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
              ),
              const Spacer(),
              if (state.hasFilters) TextButton(onPressed: _clear, child: const Text('Temizle')),
            ],
          ),
        ),
      ),

      if (items.isEmpty)
        const SliverToBoxAdapter(
          child: Padding(
            padding: EdgeInsets.all(40),
            child: Column(
              children: [
                Icon(Icons.search_off, size: 40, color: KR.muted),
                SizedBox(height: 10),
                Text('Bu filtreye uyan kampanya yok', style: TextStyle(color: KR.muted)),
              ],
            ),
          ),
        )
      else
        SliverPadding(
          padding: const EdgeInsets.fromLTRB(16, 0, 16, 32),
          sliver: SliverList.separated(
            itemCount: items.length,
            separatorBuilder: (_, __) => const SizedBox(height: 10),
            itemBuilder: (_, i) => CampaignTile(items[i]),
          ),
        ),
    ];
  }

  Widget _sectionTitle(String text, {String? trailing, IconData? icon}) {
    return SliverToBoxAdapter(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 0, 20, 10),
        child: Row(
          children: [
            if (icon != null) ...[
              Icon(icon, size: 20, color: KR.urgent),
              const SizedBox(width: 6),
            ],
            Text(text, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
            if (trailing != null) ...[
              const SizedBox(width: 6),
              Text(trailing, style: const TextStyle(fontSize: 14, color: KR.muted)),
            ],
          ],
        ),
      ),
    );
  }
}

/* ---------------- Kart çipleri ---------------- */

class _CardBar extends StatelessWidget {
  const _CardBar({required this.state, required this.onAdd});

  final AppState state;
  final VoidCallback onAdd;

  @override
  Widget build(BuildContext context) {
    final ids = programs.map((p) => p.id).where(state.myPrograms.contains).toList();
    return SizedBox(
      height: 44,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(20, 0, 20, 4),
        scrollDirection: Axis.horizontal,
        children: [
          if (ids.length > 1) ...[
            _CardChip(
              label: 'Tüm kartlarım',
              color: KR.ink,
              selected: state.shownPrograms.isEmpty,
              onTap: state.showAllPrograms,
            ),
            const SizedBox(width: 8),
          ],
          for (final id in ids) ...[
            _CardChip(
              label: '${programById(id).name} ${state.countFor(id)}',
              color: programById(id).color,
              selected: ids.length == 1 || state.shownPrograms.contains(id),
              onTap: ids.length == 1 ? null : () => state.toggleShown(id),
            ),
            const SizedBox(width: 8),
          ],
          ActionChip(
            avatar: const Icon(Icons.add, size: 18),
            label: const Text('Kart ekle'),
            onPressed: onAdd,
            shape: const StadiumBorder(side: BorderSide(color: KR.line)),
            backgroundColor: KR.surface,
          ),
        ],
      ),
    );
  }
}

class _CardChip extends StatelessWidget {
  const _CardChip({required this.label, required this.color, required this.selected, this.onTap});

  final String label;
  final Color color;
  final bool selected;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: selected ? color : KR.surface,
      shape: StadiumBorder(side: BorderSide(color: selected ? color : KR.line)),
      child: InkWell(
        customBorder: const StadiumBorder(),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 14),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(
                selected ? Icons.credit_card : Icons.credit_card_outlined,
                size: 16,
                color: selected ? Colors.white : color,
              ),
              const SizedBox(width: 6),
              Text(
                label,
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w700,
                  color: selected ? Colors.white : KR.ink,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}


/* ---------------- Filtreler: açılır menüler ---------------- */

/// Sektör · Kazanç · Katılım — her biri dokununca açılan bir menü. Seçiliyse koyu görünür.
class _FilterBar extends StatelessWidget {
  const _FilterBar({required this.state});

  final AppState state;

  @override
  Widget build(BuildContext context) {
    final sector = state.sector;
    final benefit = state.benefitTypes.length == 1 ? state.benefitTypes.first : null;
    final join = state.join;

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20),
      child: Row(
        children: [
          Expanded(
            flex: 5,
            child: _DropPill<String?>(
              label: sector == null ? 'Sektör' : sectorLabel(sector),
              icon: sector == null ? Icons.category_outlined : sectorIcon(sector),
              active: sector != null,
              value: sector,
              options: [
                const _Opt(null, 'Tüm sektörler', Icons.apps),
                for (final e in state.sectorCounts) _Opt(e.key, '${sectorLabel(e.key)}  ·  ${e.value}', sectorIcon(e.key)),
              ],
              onSelected: state.setSector,
            ),
          ),
          const SizedBox(width: 8),
          Expanded(
            flex: 4,
            child: _DropPill<BenefitType?>(
              label: benefit == null ? 'Kazanç' : benefitTypeLabel(benefit),
              icon: Icons.savings_outlined,
              active: benefit != null,
              value: benefit,
              options: [
                const _Opt(null, 'Hepsi', Icons.apps),
                for (final t in BenefitType.values) _Opt(t, benefitTypeLabel(t), Icons.savings_outlined),
              ],
              onSelected: state.setBenefit,
            ),
          ),
          const SizedBox(width: 8),
          Expanded(
            flex: 4,
            child: _DropPill<JoinMethod?>(
              label: join == null ? 'Katılım' : joinLabel(join),
              icon: join == null ? Icons.how_to_reg_outlined : joinIcon(join),
              active: join != null,
              value: join,
              options: [
                const _Opt(null, 'Hepsi', Icons.apps),
                for (final j in JoinMethod.values) _Opt(j, joinLabel(j), joinIcon(j)),
              ],
              onSelected: state.setJoin,
            ),
          ),
        ],
      ),
    );
  }
}

class _Opt<T> {
  const _Opt(this.value, this.label, this.icon);

  final T value;
  final String label;
  final IconData icon;
}

class _DropPill<T> extends StatelessWidget {
  const _DropPill({
    required this.label,
    required this.icon,
    required this.active,
    required this.value,
    required this.options,
    required this.onSelected,
  });

  final String label;
  final IconData icon;
  final bool active;
  final T value;
  final List<_Opt<T>> options;
  final ValueChanged<T> onSelected;

  @override
  Widget build(BuildContext context) {
    final fg = active ? Colors.white : KR.ink;
    return PopupMenuButton<int>(
      tooltip: '',
      position: PopupMenuPosition.under,
      constraints: const BoxConstraints(minWidth: 200, maxHeight: 420),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
      color: KR.surface,
      onSelected: (i) => onSelected(options[i].value),
      itemBuilder: (_) => [
        for (var i = 0; i < options.length; i++)
          PopupMenuItem<int>(
            value: i,
            height: 44,
            child: Row(
              children: [
                Icon(options[i].icon, size: 19, color: options[i].value == value ? KR.brand : KR.muted),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    options[i].label,
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: options[i].value == value ? FontWeight.w700 : FontWeight.w500,
                      color: options[i].value == value ? KR.brand : KR.ink,
                    ),
                  ),
                ),
                if (options[i].value == value) const Icon(Icons.check, size: 18, color: KR.brand),
              ],
            ),
          ),
      ],
      child: Container(
        height: 40,
        padding: const EdgeInsets.symmetric(horizontal: 12),
        decoration: BoxDecoration(
          color: active ? KR.ink : KR.surface,
          borderRadius: BorderRadius.circular(999),
          border: Border.all(color: active ? KR.ink : KR.line),
        ),
        child: Row(
          children: [
            Icon(icon, size: 16, color: fg),
            const SizedBox(width: 6),
            Expanded(
              child: Text(
                label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: fg),
              ),
            ),
            Icon(Icons.keyboard_arrow_down, size: 18, color: fg),
          ],
        ),
      ),
    );
  }
}

/* ---------------- Hata ---------------- */

class _ErrorView extends StatelessWidget {
  const _ErrorView({required this.onRetry});

  final Future<void> Function() onRetry;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(32),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Icon(Icons.cloud_off_outlined, size: 44, color: KR.muted),
          const SizedBox(height: 12),
          const Text(
            'Kampanyalar alınamadı',
            style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: 6),
          const Text(
            'İnternet bağlantını kontrol edip tekrar dene.',
            textAlign: TextAlign.center,
            style: TextStyle(color: KR.muted, height: 1.4),
          ),
          const SizedBox(height: 18),
          OutlinedButton(onPressed: onRetry, child: const Text('Tekrar dene')),
        ],
      ),
    );
  }
}
