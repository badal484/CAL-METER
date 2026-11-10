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

  const validTarget = target > 0 ? target : 1;
  const progressRatio = Math.min(Math.max(current / validTarget, 0), 1);
  const percentage = Math.round(progressRatio * 100);

  return (
    <View
      style={[styles.container, style]}
      accessible
      accessibilityRole="progressbar"
      accessibilityValue={{
        min: 0,
        max: target,
        now: current,
        text: `${percentage}% completed`,
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
              <Text style={{ fontWeight: '600' }}>{Math.round(current)}</Text>
              {target ? ` / ${Math.round(target)}${unit ? ' ' + unit : ''}` : ''}
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
              width: `${percentage}%`,
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
