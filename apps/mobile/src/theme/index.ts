import { lightColors, darkColors, ThemeColors } from './colors';
import { typography } from './typography';
import { spacing } from './spacing';
import { radii } from './radii';
import { dimensions } from './dimensions';
import { shadows } from './shadows';

export interface Theme {
  isDark: boolean;
  colors: ThemeColors;
  typography: typeof typography;
  spacing: typeof spacing;
  radii: typeof radii;
  dimensions: typeof dimensions;
  shadows: typeof shadows;
}

export const lightTheme: Theme = {
  isDark: false,
  colors: lightColors,
  typography,
  spacing,
  radii,
  dimensions,
  shadows,
};

export const darkTheme: Theme = {
  isDark: true,
  colors: darkColors,
  typography,
  spacing,
  radii,
  dimensions,
  shadows,
};

export * from './colors';
export * from './typography';
export * from './spacing';
export * from './radii';
export * from './dimensions';
export * from './shadows';
