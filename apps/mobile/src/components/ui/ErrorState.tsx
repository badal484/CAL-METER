import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { useTheme } from '../../app/providers/ThemeProvider';
import { Button } from './Button';

export interface ErrorStateProps {
  icon?: React.ReactNode;
  title?: string;
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
  style?: ViewStyle;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  icon,
  title = 'Something went wrong',
  message,
  onRetry,
  retryLabel = 'Try Again',
  style,
}) => {
  const { theme } = useTheme();
  const { colors, typography, spacing, radii } = theme;

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.surface,
          borderRadius: radii.lg,
          borderColor: colors.border,
          padding: spacing.xl,
        },
        style,
      ]}
      accessible
      accessibilityRole="alert"
      accessibilityLabel={`${title}. ${message}`}
    >
      {icon ? <View style={{ marginBottom: spacing.md }}>{icon}</View> : null}
      <Text style={[typography.titleSmall, { color: colors.textPrimary, textAlign: 'center' }]}>
        {title}
      </Text>
      <Text
        style={[
          typography.bodyMedium,
          { color: colors.textSecondary, textAlign: 'center', marginTop: spacing.xs },
        ]}
      >
        {message}
      </Text>
      {onRetry ? (
        <View style={{ marginTop: spacing.lg, width: '100%', maxWidth: 200 }}>
          <Button title={retryLabel} onPress={onRetry} variant="outline" size="sm" />
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
});
