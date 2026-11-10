import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useNavigation, NavigationProp } from '@react-navigation/native';
import type { RootTabParamList } from '../../app/navigation/types';
import {
  ScreenContainer,
  Card,
  SectionHeader,
  ProgressIndicator,
  MacroIndicator,
  Button,
} from '../../components';
import { useTheme } from '../../app/providers/ThemeProvider';
import { Camera, Plus } from 'lucide-react-native';

export const HomeScreen: React.FC = () => {
  const { theme } = useTheme();
  const { colors, typography, spacing, radii } = theme;
  const navigation = useNavigation<NavigationProp<RootTabParamList>>();

  // Mock data for preview milestone
  const dailyBudget = 2100;
  const consumedCalories = 1420;
  const remainingCalories = dailyBudget - consumedCalories;

  const mockMacros = {
    protein: { label: 'Protein', currentGrams: 112, targetGrams: 150 },
    carbs: { label: 'Carbs', currentGrams: 165, targetGrams: 220 },
    fat: { label: 'Fat', currentGrams: 42, targetGrams: 65 },
  };

  const recentEntries = [
    {
      id: '1',
      name: 'Steel-cut Oats with Almond Milk',
      time: '8:30 AM',
      calories: 340,
      meal: 'Breakfast',
    },
    {
      id: '2',
      name: 'Grilled Chicken Salad with Olive Oil',
      time: '1:15 PM',
      calories: 520,
      meal: 'Lunch',
    },
    {
      id: '3',
      name: 'Plain Greek Yogurt with Walnuts',
      time: '4:45 PM',
      calories: 210,
      meal: 'Snack',
    },
  ];

  return (
    <ScreenContainer>
      {/* Top Brand Header */}
      <View style={[styles.header, { marginBottom: spacing.lg }]}>
        <View>
          <Text style={[typography.labelSmall, { color: colors.textTertiary }]}>
            TUESDAY, NOVEMBER 10
          </Text>
          <Text
            style={[typography.titleLarge, { color: colors.textPrimary, marginTop: spacing.xxs }]}
          >
            Today's Nutrition
          </Text>
        </View>
        <View
          style={[
            styles.previewBadge,
            {
              backgroundColor: colors.surfaceMuted,
              borderColor: colors.borderSubtle,
              borderRadius: radii.full,
              paddingHorizontal: spacing.sm,
              paddingVertical: spacing.xxs,
            },
          ]}
        >
          <Text style={[typography.caption, { color: colors.textSecondary, fontWeight: '600' }]}>
            MOCK PREVIEW
          </Text>
        </View>
      </View>

      {/* Hero Calorie Card */}
      <Card style={{ marginBottom: spacing.lg }}>
        <Text style={[typography.labelSmall, { color: colors.textSecondary }]}>ENERGY BALANCE</Text>

        <View style={[styles.calorieNumbers, { marginVertical: spacing.md }]}>
          <View>
            <Text style={[typography.numericDisplay, { color: colors.textPrimary }]}>
              {remainingCalories}
            </Text>
            <Text style={[typography.caption, { color: colors.textSecondary }]}>
              Calories Remaining
            </Text>
          </View>

          <View style={styles.rightStats}>
            <View style={{ alignItems: 'flex-end', marginBottom: spacing.xs }}>
              <Text style={[typography.labelSmall, { color: colors.textTertiary }]}>CONSUMED</Text>
              <Text style={[typography.titleSmall, { color: colors.textPrimary }]}>
                {consumedCalories}
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={[typography.labelSmall, { color: colors.textTertiary }]}>GOAL</Text>
              <Text style={[typography.titleSmall, { color: colors.textPrimary }]}>
                {dailyBudget}
              </Text>
            </View>
          </View>
        </View>

        <ProgressIndicator
          current={consumedCalories}
          target={dailyBudget}
          showValues={false}
          height={10}
        />
      </Card>

      {/* Macronutrient Section */}
      <SectionHeader
        title="Macronutrients"
        subtitle="Distribution across protein, carbs, and fat"
      />
      <MacroIndicator
        protein={mockMacros.protein}
        carbs={mockMacros.carbs}
        fat={mockMacros.fat}
        style={{ marginBottom: spacing.xl }}
      />

      {/* Quick Action Shortcuts */}
      <SectionHeader title="Quick Actions" />
      <View style={[styles.quickActions, { marginBottom: spacing.xl }]}>
        <View style={{ flex: 1, marginRight: spacing.sm }}>
          <Button
            title="Scan Meal"
            onPress={() => navigation.navigate('Scan')}
            variant="primary"
            leftIcon={<Camera size={18} color={colors.primaryText} />}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Button
            title="Food Diary"
            onPress={() => navigation.navigate('Diary')}
            variant="outline"
            leftIcon={<Plus size={18} color={colors.textPrimary} />}
          />
        </View>
      </View>

      {/* Recent Food Entries Preview */}
      <SectionHeader
        title="Recent Food Logs"
        subtitle="Illustrative preview entries"
        rightAction={
          <Button
            title="View All"
            onPress={() => navigation.navigate('Diary')}
            variant="ghost"
            size="sm"
          />
        }
      />
      <Card style={{ padding: 0 }}>
        {recentEntries.map((entry, index) => (
          <View
            key={entry.id}
            style={[
              styles.foodRow,
              {
                paddingHorizontal: spacing.lg,
                paddingVertical: spacing.md,
                borderBottomColor: colors.borderSubtle,
                borderBottomWidth: index < recentEntries.length - 1 ? 1 : 0,
              },
            ]}
          >
            <View style={{ flex: 1 }}>
              <Text
                style={[typography.labelLarge, { color: colors.textPrimary }]}
                numberOfLines={1}
              >
                {entry.name}
              </Text>
              <Text
                style={[typography.caption, { color: colors.textTertiary, marginTop: spacing.xxs }]}
              >
                {entry.meal} • {entry.time}
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end', marginLeft: spacing.md }}>
              <Text style={[typography.labelLarge, { color: colors.textPrimary }]}>
                {entry.calories}{' '}
                <Text style={[typography.caption, { color: colors.textTertiary }]}>kcal</Text>
              </Text>
            </View>
          </View>
        ))}
      </Card>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  previewBadge: {
    borderWidth: 1,
  },
  calorieNumbers: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  rightStats: {
    alignItems: 'flex-end',
  },
  quickActions: {
    flexDirection: 'row',
  },
  foodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});
