import 'package:flutter/material.dart';

/*
 * KartRadar görsel dili
 * - Sakin, açık zemin; kampanya görselleri ve program renkleri öne çıksın.
 * - Kazanç her yerde aynı yeşille yazılır: kullanıcı ilk bakışta "ne kazanırım"ı görür.
 * - Aciliyet (bitmek üzere) turuncu, hata kırmızı.
 */
class KR {
  static const ink = Color(0xFF111827);
  static const muted = Color(0xFF6B7280);
  static const line = Color(0xFFE5E7EB);
  static const bg = Color(0xFFF5F6F8);
  static const surface = Colors.white;
  static const brand = Color(0xFF0F766E);
  static const gain = Color(0xFF15803D);
  static const gainBg = Color(0xFFE8F5EC);
  static const urgent = Color(0xFFC2410C);
  static const urgentBg = Color(0xFFFFF1E7);

  static const radius = 16.0;

  /// Kampanya kartlarının çerçevesi (açık marka yeşili)
  static const cardBorder = Color(0xFF9FD3CC);
}

ThemeData buildTheme() {
  final scheme = ColorScheme.fromSeed(
    seedColor: KR.brand,
    primary: KR.brand,
    surface: KR.surface,
  );
  final base = ThemeData(colorScheme: scheme, useMaterial3: true);

  return base.copyWith(
    scaffoldBackgroundColor: KR.bg,
    textTheme: base.textTheme.apply(bodyColor: KR.ink, displayColor: KR.ink),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        minimumSize: const Size.fromHeight(52),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
        textStyle: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
      ),
    ),
  );
}

/// Tüm sayfalarda aynı görünen üst çubuk (tema API'si Flutter sürümüne göre değiştiği için elle)
AppBar krAppBar({Widget? title, List<Widget>? actions, double? titleSpacing}) => AppBar(
      title: title,
      actions: actions,
      titleSpacing: titleSpacing,
      backgroundColor: KR.bg,
      foregroundColor: KR.ink,
      elevation: 0,
      scrolledUnderElevation: 0,
      centerTitle: false,
    );

/// Arama kutusu görünümü
InputDecoration krInput({String? hint, Widget? prefixIcon, Widget? suffixIcon}) {
  OutlineInputBorder border(Color c, [double w = 1]) => OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: BorderSide(color: c, width: w),
      );
  return InputDecoration(
    hintText: hint,
    prefixIcon: prefixIcon,
    suffixIcon: suffixIcon,
    filled: true,
    fillColor: KR.surface,
    contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
    border: border(KR.line),
    enabledBorder: border(KR.line),
    focusedBorder: border(KR.brand, 1.5),
  );
}
