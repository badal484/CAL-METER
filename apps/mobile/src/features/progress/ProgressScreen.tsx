import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { ScreenContainer, Card, SectionHeader, Button } from '../../components';
import { useTheme } from '../../app/providers/ThemeProvider';
import { TrendingDown, Calendar, Award } from 'lucide-react-native';

export const ProgressScreen: React.FC = () => {
  const { theme } = useTheme();
  const { colors, typography, spacing, radii } = theme;

  const [activeRange, setActiveRange] = useState<'7D' | '30D' | '90D'>('7D');

  // Illustrative weekly weight mock entries
  const weightPoints = [
    { day: 'Mon', weight: 82.4 },
    { day: 'Tue', weight: 82.2 },
    { day: 'Wed', weight: 82.0 },
    { day: 'Thu', weight: 81.8 },
    { day: 'Fri', weight: 81.9 },
    { day: 'Sat', weight: 81.6 },
    { day: 'Sun', weight: 81.4 },
  ];

  const minWeight = 81.0;
  const maxWeight = 83.0;

  return (
    <ScreenContainer>
      <View style={{ marginBottom: spacing.lg }}>
        <Text style={[typography.titleLarge, { color: colors.textPrimary }]}>
          Progress & Analytics
        </Text>
        <Text
          style={[typography.bodyMedium, { color: colors.textSecondary, marginTop: spacing.xs }]}
        >
          Historical weight change and caloric adherence.
        </Text>
      </View>

      {/* Range Filter Buttons */}
      <View
        style={[
          styles.rangeToggle,
          {
            backgroundColor: colors.surface,
            borderRadius: radii.md,
            padding: spacing.xxs,
            marginBottom: spacing.lg,
          },
        ]}
      >
        {(['7D', '30D', '90D'] as const).map(range => {
          const isActive = activeRange === range;
          return (
            <Button
              key={range}
              title={range === '7D' ? 'Last 7 Days' : range === '30D' ? '30 Days' : '90 Days'}
              onPress={() => setActiveRange(range)}
              variant={isActive ? 'primary' : 'ghost'}
              size="sm"
              style={{ flex: 1, minHeight: 34 }}
            />
          );
        })}
      </View>

      {/* Weight Summary Card */}
      <Card style={{ marginBottom: spacing.lg }}>
        <View style={styles.cardHeader}>
          <View>
            <Text style={[typography.labelSmall, { color: colors.textSecondary }]}>
              CURRENT WEIGHT [MOCK]
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', marginTop: spacing.xxs }}>
              <Text style={[typography.numericLarge, { color: colors.textPrimary }]}>81.4</Text>
              <Text
                style={[
                  typography.labelMedium,
                  { color: colors.textSecondary, marginLeft: spacing.xs },
                ]}
              >
                kg
              </Text>
            </View>
          </View>

          <View
            style={[
              styles.trendBadge,
              {
                backgroundColor: colors.surfaceMuted,
                borderRadius: radii.full,
                paddingHorizontal: spacing.sm,
                paddingVertical: spacing.xs,
              },
            ]}
          >
            <TrendingDown size={14} color={colors.textPrimary} style={{ marginRight: 4 }} />
            <Text style={[typography.caption, { color: colors.textPrimary, fontWeight: '600' }]}>
              -1.0 kg (7d)
            </Text>
          </View>
        </View>

        {/* Lightweight SVG/Bar Chart Representation */}
        <Text
          style={[
            typography.caption,
            { color: colors.textTertiary, marginTop: spacing.md, marginBottom: spacing.xs },
          ]}
        >
          DAILY WEIGH-INS (KG)
        </Text>
        <View
          style={[
            styles.chartContainer,
            {
              height: 110,
              borderColor: colors.borderSubtle,
              borderBottomWidth: 1,
              paddingTop: spacing.md,
            },
          ]}
        >
          {weightPoints.map(point => {
            const heightPercent = Math.max(
              20,
              Math.min(100, ((point.weight - minWeight) / (maxWeight - minWeight)) * 100),
            );

            return (
              <View key={point.day} style={styles.chartCol}>
                <Text
                  style={[
                    typography.caption,
                    { color: colors.textTertiary, fontSize: 10, marginBottom: 4 },
                  ]}
                >
                  {point.weight}
                </Text>
                <View
                  style={[
                    styles.chartBar,
                    {
                      height: `${heightPercent}%`,
                      backgroundColor: colors.primary,
                      borderRadius: radii.xs,
                    },
                  ]}
                />
                <Text
                  style={[
                    typography.caption,
                    { color: colors.textSecondary, marginTop: 4, fontSize: 10 },
                  ]}
                >
                  {point.day}
                </Text>
              </View>
            );
          })}
        </View>
      </Card>

      {/* Calorie Adherence */}
      <SectionHeader title="Adherence & Consistency" />
      <View style={[styles.statsRow, { marginBottom: spacing.lg }]}>
        <Card style={{ flex: 1, marginRight: spacing.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xs }}>
            <Calendar size={16} color={colors.textSecondary} style={{ marginRight: spacing.xs }} />
            <Text style={[typography.labelSmall, { color: colors.textSecondary }]}>GOAL HIT</Text>
          </View>
          <Text style={[typography.numericMedium, { color: colors.textPrimary }]}>6 / 7</Text>
          <Text style={[typography.caption, { color: colors.textTertiary, marginTop: 2 }]}>
            Days on target
          </Text>
        </Card>

        <Card style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xs }}>
            <Award size={16} color={colors.textSecondary} style={{ marginRight: spacing.xs }} />
            <Text style={[typography.labelSmall, { color: colors.textSecondary }]}>
              AVG DEFICIT
            </Text>
          </View>
          <Text style={[typography.numericMedium, { color: colors.textPrimary }]}>-480</Text>
          <Text style={[typography.caption, { color: colors.textTertiary, marginTop: 2 }]}>
            kcal / day
          </Text>
        </Card>
      </View>

      {/* Milestone note */}
      <View
        style={[
          styles.footerNote,
          {
            backgroundColor: colors.surface,
            borderColor: colors.borderSubtle,
            borderRadius: radii.md,
            padding: spacing.md,
          },
        ]}
      >
        <Text style={[typography.caption, { color: colors.textSecondary, textAlign: 'center' }]}>
          Illustrative analytics preview. Real-time charting with zoomable time windows and weight
          projections will be unlocked with persistent tracking in Milestone 9.
        </Text>
      </View>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  rangeToggle: {
    flexDirection: 'row',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  trendBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  chartContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  chartCol: {
    flex: 1,
    alignItems: 'center',
    height: '100%',
    justifyContent: 'flex-end',
  },
  chartBar: {
    width: 14,
  },
  statsRow: {
    flexDirection: 'row',
  },
  footerNote: {
    borderWidth: 1,
  },
});
