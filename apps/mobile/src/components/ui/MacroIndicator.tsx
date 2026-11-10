import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { useTheme } from '../../app/providers/ThemeProvider';

export interface MacroItemData {
  label: string;
  currentGrams: number;
  targetGrams: number;
}

export interface MacroIndicatorProps {
  protein: MacroItemData;
  carbs: MacroItemData;
  fat: MacroItemData;
  style?: ViewStyle;
}

export const MacroIndicator: React.FC<MacroIndicatorProps> = ({ protein, carbs, fat, style }) => {
  const { theme } = useTheme();
  const { colors, typography, radii, spacing } = theme;

  const renderMacroCol = (item: MacroItemData) => {
    const validTarget = item.targetGrams > 0 ? item.targetGrams : 1;
    const ratio = Math.min(Math.max(item.currentGrams / validTarget, 0), 1);
    const pct = Math.round(ratio * 100);

    return (
      <View
        key={item.label}
        style={[
          styles.macroCol,
          { backgroundColor: colors.surface, borderRadius: radii.md, padding: spacing.md },
        ]}
        accessible
        accessibilityLabel={`${item.label}: ${Math.round(item.currentGrams)} of ${Math.round(item.targetGrams)} grams, ${pct}%`}
      >
        <Text style={[typography.labelSmall, { color: colors.textSecondary }]}>{item.label}</Text>

        <Text
          style={[
            typography.numericMedium,
            { color: colors.textPrimary, marginVertical: spacing.xxs },
          ]}
        >
          {Math.round(item.currentGrams)}
          <Text style={[typography.caption, { color: colors.textTertiary }]}>g</Text>
        </Text>

        <Text
          style={[typography.caption, { color: colors.textTertiary, marginBottom: spacing.xs }]}
        >
          / {Math.round(item.targetGrams)}g
        </Text>

        <View
          style={[
            styles.barTrack,
            { backgroundColor: colors.progressTrack, borderRadius: radii.full },
          ]}
        >
          <View
            style={[
              styles.barFill,
              {
                width: `${pct}%`,
                backgroundColor: colors.progressFill,
                borderRadius: radii.full,
              },
            ]}
          />
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, style]}>
      {renderMacroCol(protein)}
      <View style={{ width: spacing.sm }} />
      {renderMacroCol(carbs)}
      <View style={{ width: spacing.sm }} />
      {renderMacroCol(fat)}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    width: '100%',
  },
  macroCol: {
    flex: 1,
    alignItems: 'center',
  },
  barTrack: {
    width: '100%',
    height: 4,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
  },
});
