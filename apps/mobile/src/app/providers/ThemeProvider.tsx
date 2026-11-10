import React, { createContext, useContext, useState, useMemo } from 'react';
import { useColorScheme as useDeviceColorScheme } from 'react-native';
import { Theme, lightTheme, darkTheme } from '../../theme';

export type ColorSchemePreference = 'light' | 'dark' | 'system';

export interface ThemeContextValue {
  theme: Theme;
  isDark: boolean;
  colorScheme: ColorSchemePreference;
  setColorScheme: (scheme: ColorSchemePreference) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export interface ThemeProviderProps {
  children: React.ReactNode;
  initialScheme?: ColorSchemePreference;
  initialMode?: ColorSchemePreference;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({
  children,
  initialScheme,
  initialMode,
}) => {
  const deviceColorScheme = useDeviceColorScheme();
  const [colorScheme, setColorScheme] = useState<ColorSchemePreference>(
    initialMode ?? initialScheme ?? 'system',
  );

  const isDark = useMemo(() => {
    if (colorScheme === 'system') {
      return deviceColorScheme === 'dark';
    }
    return colorScheme === 'dark';
  }, [colorScheme, deviceColorScheme]);

  const theme = useMemo(() => (isDark ? darkTheme : lightTheme), [isDark]);

  const toggleTheme = () => {
    setColorScheme(prev => (prev === 'dark' ? 'light' : 'dark'));
  };

  const value = useMemo(
    () => ({
      theme,
      isDark,
      colorScheme,
      setColorScheme,
      toggleTheme,
    }),
    [theme, isDark, colorScheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = (): ThemeContextValue => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
