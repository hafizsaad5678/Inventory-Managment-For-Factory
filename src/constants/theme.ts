import { Platform } from 'react-native';

// ─── Brand Palette ────────────────────────────────────────────────────────────
// Black / Dark Coffee / Brown / Beige
export const Palette = {
  black: '#000000',
  darkCoffee: '#1F150C',
  coffee: '#2A1A0E',
  brown: '#412D15',
  brownMid: '#5C3D1E',
  brownLight: '#7A5230',
  caramel: '#A0693A',
  beige: '#E1DCC9',
  beigeLight: '#EDE9DC',
  beigeWarm: '#F5F1E8',
  cream: '#FAF8F3',
  white: '#FFFFFF',

  // Accent — warm amber for CTAs, active states
  accent: '#C47E35',
  accentDark: '#9E5F1E',
  accentLight: '#D9954F',

  // Semantic
  success: '#4A7C59',
  successLight: '#6FAF80',
  danger: '#9B3A2A',
  dangerLight: '#C45040',
  warning: '#B07820',
  warningLight: '#D4A030',
  info: '#2E5F8A',
  infoLight: '#4A84B8',
} as const;

// ─── Color Scheme ─────────────────────────────────────────────────────────────
export const Colors = {
  light: {
    // Surfaces
    background: Palette.beigeWarm,
    backgroundElement: Palette.beigeLight,
    backgroundSelected: Palette.beige,
    backgroundCard: Palette.cream,

    // Text
    text: Palette.darkCoffee,
    textSecondary: Palette.brownLight,
    textMuted: Palette.caramel,
    textInverse: Palette.cream,

    // Brand
    accent: Palette.accent,
    accentDark: Palette.accentDark,

    // Borders
    border: Palette.beige,
    borderStrong: Palette.brownLight,

    // Semantic
    success: Palette.success,
    danger: Palette.danger,
    warning: Palette.warning,
    info: Palette.info,

    // Tab / Nav
    tabActive: Palette.accent,
    tabInactive: Palette.brownLight,
    headerBg: Palette.cream,
    tabBarBg: Palette.cream,
  },
  dark: {
    // Surfaces
    background: Palette.black,
    backgroundElement: Palette.darkCoffee,
    backgroundSelected: Palette.coffee,
    backgroundCard: Palette.coffee,

    // Text
    text: Palette.beige,
    textSecondary: Palette.caramel,
    textMuted: Palette.brownLight,
    textInverse: Palette.darkCoffee,

    // Brand
    accent: Palette.accentLight,
    accentDark: Palette.accent,

    // Borders
    border: Palette.brown,
    borderStrong: Palette.brownMid,

    // Semantic
    success: Palette.successLight,
    danger: Palette.dangerLight,
    warning: Palette.warningLight,
    info: Palette.infoLight,

    // Tab / Nav
    tabActive: Palette.accentLight,
    tabInactive: Palette.caramel,
    headerBg: Palette.darkCoffee,
    tabBarBg: Palette.darkCoffee,
  },
} as const;

export type ColorScheme = keyof typeof Colors;
export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

// ─── Typography ───────────────────────────────────────────────────────────────
export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

// ─── Spacing ──────────────────────────────────────────────────────────────────
export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

// ─── Radius ───────────────────────────────────────────────────────────────────
export const Radius = {
  sm: 6,
  md: 12,
  lg: 20,
  xl: 32,
  full: 9999,
} as const;

// ─── Shadows ──────────────────────────────────────────────────────────────────
export const Shadow = {
  sm: {
    shadowColor: Palette.brown,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  md: {
    shadowColor: Palette.brown,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  lg: {
    shadowColor: Palette.darkCoffee,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 8,
  },
} as const;

// ─── Glass / Jelly UI Tokens ─────────────────────────────────────────────────
export const Glass = {
  light: {
    // Cards — semi-transparent frosted white over warm beige
    card: 'rgba(255, 252, 245, 0.72)',
    cardBorder: 'rgba(225, 220, 201, 0.60)',
    cardStrong: 'rgba(255, 252, 245, 0.88)',
    // Elevated modal / sheet
    sheet: 'rgba(250, 248, 243, 0.94)',
    sheetBorder: 'rgba(160, 105, 58, 0.18)',
    // Pill badges, filters
    pill: 'rgba(225, 220, 201, 0.55)',
    pillActive: 'rgba(196, 126, 53, 0.88)',
    // Search bar
    input: 'rgba(255, 252, 245, 0.65)',
    inputBorder: 'rgba(160, 105, 58, 0.25)',
    // Header / tab bar
    bar: 'rgba(250, 248, 243, 0.82)',
    barBorder: 'rgba(225, 220, 201, 0.70)',
    // Overlay scrim
    scrim: 'rgba(31, 21, 12, 0.45)',
    // Highlight glow
    glow: 'rgba(196, 126, 53, 0.15)',
  },
  dark: {
    card: 'rgba(31, 21, 12, 0.70)',
    cardBorder: 'rgba(65, 45, 21, 0.65)',
    cardStrong: 'rgba(42, 26, 14, 0.90)',
    sheet: 'rgba(20, 13, 7, 0.94)',
    sheetBorder: 'rgba(92, 61, 30, 0.35)',
    pill: 'rgba(65, 45, 21, 0.55)',
    pillActive: 'rgba(217, 149, 79, 0.85)',
    input: 'rgba(42, 26, 14, 0.60)',
    inputBorder: 'rgba(92, 61, 30, 0.45)',
    bar: 'rgba(20, 13, 7, 0.85)',
    barBorder: 'rgba(65, 45, 21, 0.55)',
    scrim: 'rgba(0, 0, 0, 0.65)',
    glow: 'rgba(217, 149, 79, 0.12)',
  },
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
