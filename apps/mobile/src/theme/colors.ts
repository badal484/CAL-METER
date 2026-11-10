export const PALETTE = {
  white: '#FFFFFF',
  gray50: '#F9FAFB',
  gray100: '#F3F4F6',
  gray200: '#E5E7EB',
  gray300: '#D1D5DB',
  gray400: '#9CA3AF',
  gray500: '#6B7280',
  gray600: '#4B5563',
  gray700: '#374151',
  gray800: '#1F2937',
  gray900: '#111827',
  gray950: '#0B0F17',
  black: '#000000',
} as const;

export type ThemeColors = {
  background: string;
  backgroundSurface: string;
  surface: string;
  surfaceElevated: string;
  surfaceMuted: string;
  border: string;
  borderSubtle: string;
  borderFocus: string;
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  textMuted: string;
  textInverse: string;
  primary: string;
  primaryText: string;
  accentPrimary: string;
  secondary: string;
  secondaryText: string;
  tabBarBackground: string;
  tabBarBorder: string;
  tabBarActive: string;
  tabBarInactive: string;
  card: string;
  cardBorder: string;
  progressTrack: string;
  progressFill: string;
  error: string;
  errorBackground: string;
};

export const lightColors: ThemeColors = {
  background: PALETTE.white,
  backgroundSurface: PALETTE.gray50,
  surface: PALETTE.gray50,
  surfaceElevated: PALETTE.white,
  surfaceMuted: PALETTE.gray100,
  border: PALETTE.gray200,
  borderSubtle: PALETTE.gray100,
  borderFocus: PALETTE.gray900,
  textPrimary: PALETTE.gray900,
  textSecondary: PALETTE.gray600,
  textTertiary: PALETTE.gray400,
  textMuted: PALETTE.gray500,
  textInverse: PALETTE.white,
  primary: PALETTE.black,
  primaryText: PALETTE.white,
  accentPrimary: PALETTE.black,
  secondary: PALETTE.gray100,
  secondaryText: PALETTE.gray900,
  tabBarBackground: PALETTE.white,
  tabBarBorder: PALETTE.gray200,
  tabBarActive: PALETTE.black,
  tabBarInactive: PALETTE.gray400,
  card: PALETTE.white,
  cardBorder: PALETTE.gray200,
  progressTrack: PALETTE.gray200,
  progressFill: PALETTE.black,
  error: PALETTE.gray900,
  errorBackground: PALETTE.gray100,
};

export const darkColors: ThemeColors = {
  background: PALETTE.black,
  backgroundSurface: PALETTE.gray950,
  surface: PALETTE.gray950,
  surfaceElevated: PALETTE.gray900,
  surfaceMuted: PALETTE.gray800,
  border: PALETTE.gray800,
  borderSubtle: PALETTE.gray900,
  borderFocus: PALETTE.white,
  textPrimary: PALETTE.gray50,
  textSecondary: PALETTE.gray400,
  textTertiary: PALETTE.gray600,
  textMuted: PALETTE.gray400,
  textInverse: PALETTE.black,
  primary: PALETTE.white,
  primaryText: PALETTE.black,
  accentPrimary: PALETTE.white,
  secondary: PALETTE.gray800,
  secondaryText: PALETTE.gray50,
  tabBarBackground: PALETTE.gray950,
  tabBarBorder: PALETTE.gray800,
  tabBarActive: PALETTE.white,
  tabBarInactive: PALETTE.gray600,
  card: PALETTE.gray950,
  cardBorder: PALETTE.gray800,
  progressTrack: PALETTE.gray800,
  progressFill: PALETTE.white,
  error: PALETTE.white,
  errorBackground: PALETTE.gray900,
};
