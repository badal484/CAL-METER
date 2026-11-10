import { TextStyle, Platform } from 'react-native';

const fontFamily = Platform.select({
  ios: 'System',
  android: 'Roboto',
  default: 'System',
});

export const typography = {
  families: {
    regular: fontFamily,
    medium: fontFamily,
    bold: fontFamily,
  },
  display: {
    fontFamily,
    fontSize: 34,
    lineHeight: 40,
    fontWeight: '700',
    letterSpacing: -0.6,
  } as TextStyle,
  titleLarge: {
    fontFamily,
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '700',
    letterSpacing: -0.4,
  } as TextStyle,
  titleMedium: {
    fontFamily,
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '600',
    letterSpacing: -0.3,
  } as TextStyle,
  titleSmall: {
    fontFamily,
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '600',
    letterSpacing: -0.2,
  } as TextStyle,
  bodyLarge: {
    fontFamily,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '400',
    letterSpacing: -0.1,
  } as TextStyle,
  bodyMedium: {
    fontFamily,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '400',
  } as TextStyle,
  bodySmall: {
    fontFamily,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '400',
  } as TextStyle,
  labelLarge: {
    fontFamily,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '600',
    letterSpacing: -0.1,
  } as TextStyle,
  labelMedium: {
    fontFamily,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
  } as TextStyle,
  labelSmall: {
    fontFamily,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  } as TextStyle,
  caption: {
    fontFamily,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '400',
  } as TextStyle,
  numericDisplay: {
    fontFamily,
    fontSize: 44,
    lineHeight: 48,
    fontWeight: '700',
    letterSpacing: -1,
  } as TextStyle,
  numericLarge: {
    fontFamily,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '700',
    letterSpacing: -0.5,
  } as TextStyle,
  numericMedium: {
    fontFamily,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '600',
  } as TextStyle,
} as const;

export type TypographyToken = keyof typeof typography;
