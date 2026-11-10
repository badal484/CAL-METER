import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { useTheme } from '../../app/providers/ThemeProvider';

export interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  rightAction?: React.ReactNode;
  style?: ViewStyle;
}

export const SectionHeader: React.FC<SectionHeaderProps> = ({
  title,
  subtitle,
  rightAction,
  style,
}) => {
  const { theme } = useTheme();
  const { colors, typography, spacing } = theme;

  return (
    <View style={[styles.container, { marginBottom: spacing.md }, style]}>
      <View style={styles.textContainer}>
        <Text style={[typography.titleSmall, { color: colors.textPrimary }]}>{title}</Text>
        {subtitle ? (
          <Text
            style={[typography.caption, { color: colors.textSecondary, marginTop: spacing.xxs }]}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>
      {rightAction ? <View>{rightAction}</View> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  textContainer: {
    flex: 1,
  },
});
