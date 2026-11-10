import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { useTheme } from '../../app/providers/ThemeProvider';

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  style?: ViewStyle;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action,
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
          borderColor: colors.borderSubtle,
          padding: spacing.xl,
        },
        style,
      ]}
      accessible
      accessibilityLabel={`${title}. ${description || ''}`}
    >
      {icon ? <View style={{ marginBottom: spacing.md }}>{icon}</View> : null}
      <Text style={[typography.titleSmall, { color: colors.textPrimary, textAlign: 'center' }]}>
        {title}
      </Text>
      {description ? (
        <Text
          style={[
            typography.bodyMedium,
            { color: colors.textSecondary, textAlign: 'center', marginTop: spacing.xs },
          ]}
        >
          {description}
        </Text>
      ) : null}
      {action ? <View style={{ marginTop: spacing.lg }}>{action}</View> : null}
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
