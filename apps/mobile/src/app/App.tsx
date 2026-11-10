import React from 'react';
import { StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer, Theme as NavigationTheme } from '@react-navigation/native';
import { ThemeProvider, useTheme } from './providers/ThemeProvider';
import { AppNavigator } from './navigation/AppNavigator';

const AppContent: React.FC = () => {
  const { theme, isDark } = useTheme();

  const navigationTheme: NavigationTheme = {
    dark: isDark,
    colors: {
      primary: theme.colors.textPrimary,
      background: theme.colors.background,
      card: theme.colors.surface,
      text: theme.colors.textPrimary,
      border: theme.colors.border,
      notification: theme.colors.primary,
    },
    fonts: {
      regular: {
        fontFamily: theme.typography.families.regular,
        fontWeight: '400',
      },
      medium: {
        fontFamily: theme.typography.families.medium,
        fontWeight: '500',
      },
      bold: {
        fontFamily: theme.typography.families.bold,
        fontWeight: '700',
      },
      heavy: {
        fontFamily: theme.typography.families.bold,
        fontWeight: '900',
      },
    },
  };

  return (
    <>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <NavigationContainer theme={navigationTheme}>
        <AppNavigator />
      </NavigationContainer>
    </>
  );
};

export const App: React.FC = () => {
  return (
    <SafeAreaProvider>
      <ThemeProvider initialMode="system">
        <AppContent />
      </ThemeProvider>
    </SafeAreaProvider>
  );
};

export default App;
