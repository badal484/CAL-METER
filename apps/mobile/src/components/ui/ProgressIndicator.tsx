import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { useTheme } from '../../app/providers/ThemeProvider';

export interface ProgressIndicatorProps {
  current: number;
  target: number;
  label?: string;
  unit?: string;
  showValues?: boolean;
  height?: number;
  style?: ViewStyle;
}

export const ProgressIndicator: React.FC<ProgressIndicatorProps> = ({
  current,
  target,
  label,
  unit = '',
  showValues = true,
  height = 8,
  style,
}) => {
  const { theme } = useTheme();
  const { colors, typography, radii, spacing } = theme;

  const safeCurrent =
    typeof current === 'number' && Number.isFinite(current) ? Math.max(0, current) : 0;
  const safeTarget =
    typeof target === 'number' && Number.isFinite(target) ? Math.max(0, target) : 0;
  const progressRatio = safeTarget > 0 ? Math.min(Math.max(safeCurrent / safeTarget, 0), 1) : 0;
  const percentage = Number.isFinite(progressRatio) ? Math.round(progressRatio * 100) : 0;
  const clampedPercentage = Math.min(100, Math.max(0, percentage));

  return (
    <View
      style={[styles.container, style]}
      accessible
      accessibilityRole="progressbar"
      accessibilityValue={{
        min: 0,
        max: safeTarget,
        now: safeCurrent,
        text: `${clampedPercentage}% completed`,
      }}
      accessibilityLabel={label || 'Progress'}
    >
      {label || showValues ? (
        <View style={[styles.headerRow, { marginBottom: spacing.xs }]}>
          {label ? (
            <Text style={[typography.labelMedium, { color: colors.textSecondary }]}>{label}</Text>
          ) : (
            <View />
          )}
          {showValues ? (
            <Text style={[typography.bodySmall, { color: colors.textPrimary }]}>
              <Text style={{ fontWeight: '600' }}>{Math.round(safeCurrent)}</Text>
              {safeTarget > 0 ? ` / ${Math.round(safeTarget)}${unit ? ' ' + unit : ''}` : ''}
            </Text>
          ) : null}
        </View>
      ) : null}

      <View
        style={[
          styles.track,
          {
            height,
            backgroundColor: colors.progressTrack,
            borderRadius: radii.full,
          },
        ]}
      >
        <View
          style={[
            styles.fill,
            {
              width: `${clampedPercentage}%`,
              backgroundColor: colors.progressFill,
              borderRadius: radii.full,
            },
          ]}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  track: {
    width: '100%',
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
  },
});
