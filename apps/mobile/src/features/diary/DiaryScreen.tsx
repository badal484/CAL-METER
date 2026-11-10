import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useNavigation, NavigationProp } from '@react-navigation/native';
import type { RootTabParamList } from '../../app/navigation/types';
import { ScreenContainer, Card, Button, EmptyState, IconButton } from '../../components';
import { useTheme } from '../../app/providers/ThemeProvider';
import { ChevronLeft, ChevronRight, Plus, Utensils } from 'lucide-react-native';

interface FoodItemPreview {
  id: string;
  name: string;
  portion: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export const DiaryScreen: React.FC = () => {
  const { theme } = useTheme();
  const { colors, typography, spacing, radii } = theme;
  const navigation = useNavigation<NavigationProp<RootTabParamList>>();

  const [dateIndex, setDateIndex] = useState(0); // 0 = Today

  const dates = ['Today, Nov 10', 'Yesterday, Nov 9', 'Sunday, Nov 8'];
  const currentDateLabel = dates[Math.abs(dateIndex) % dates.length]!;

  const handleAddFood = (_mealTitle: string) => {
    navigation.navigate('Scan');
  };

  const breakfastItems: FoodItemPreview[] = [
    {
      id: 'b1',
      name: 'Steel-cut Oats with Whole Milk',
      portion: '1 bowl (250g)',
      calories: 340,
      protein: 12,
      carbs: 54,
      fat: 8,
    },
    {
      id: 'b2',
      name: 'Black Coffee without Sugar',
      portion: '1 cup (200ml)',
      calories: 5,
      protein: 0.5,
      carbs: 0,
      fat: 0,
    },
  ];

  const lunchItems: FoodItemPreview[] = [
    {
      id: 'l1',
      name: 'Yellow Dal Tadka',
      portion: '1.5 katori (300g)',
      calories: 275,
      protein: 14,
      carbs: 36,
      fat: 8,
    },
    {
      id: 'l2',
      name: 'Whole Wheat Phulka Roti',
      portion: '2 pieces (70g)',
      calories: 210,
      protein: 7,
      carbs: 42,
      fat: 1,
    },
    {
      id: 'l3',
      name: 'Cucumber Tomato Salad',
      portion: '1 bowl (150g)',
      calories: 45,
      protein: 1.5,
      carbs: 9,
      fat: 0.3,
    },
  ];

  const snackItems: FoodItemPreview[] = [
    {
      id: 's1',
      name: 'Roasted Almonds',
      portion: '1 handful (25g)',
      calories: 155,
      protein: 6,
      carbs: 5,
      fat: 13,
    },
  ];

  const dinnerItems: FoodItemPreview[] = []; // Empty state demo

  const renderMealSection = (title: string, items: FoodItemPreview[], targetCalories: number) => {
    const mealCalories = items.reduce((acc, it) => acc + it.calories, 0);

    return (
      <View style={{ marginBottom: spacing.xl }} key={title}>
        <View style={[styles.mealHeader, { marginBottom: spacing.sm }]}>
          <View>
            <Text style={[typography.titleSmall, { color: colors.textPrimary }]}>{title}</Text>
            <Text style={[typography.caption, { color: colors.textSecondary }]}>
              {mealCalories} kcal of {targetCalories} kcal budget
            </Text>
          </View>
          <IconButton
            icon={<Plus size={18} color={colors.textPrimary} />}
            onPress={() => handleAddFood(title)}
            accessibilityLabel={`Add food to ${title}`}
            variant="filled"
            size="sm"
          />
        </View>

        {items.length === 0 ? (
          <EmptyState
            icon={<Utensils size={24} color={colors.textTertiary} />}
            title={`No foods logged for ${title}`}
            description="Track your meal to stay within your daily caloric target."
            action={
              <Button
                title={`Log ${title}`}
                onPress={() => handleAddFood(title)}
                variant="outline"
                size="sm"
              />
            }
          />
        ) : (
          <Card style={{ padding: 0 }}>
            {items.map((item, idx) => (
              <View
                key={item.id}
                style={[
                  styles.itemRow,
                  {
                    paddingHorizontal: spacing.lg,
                    paddingVertical: spacing.md,
                    borderBottomColor: colors.borderSubtle,
                    borderBottomWidth: idx < items.length - 1 ? 1 : 0,
                  },
                ]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[typography.labelLarge, { color: colors.textPrimary }]}>
                    {item.name}
                  </Text>
                  <Text
                    style={[
                      typography.caption,
                      { color: colors.textTertiary, marginTop: spacing.xxs },
                    ]}
                  >
                    {item.portion} • P: {item.protein}g • C: {item.carbs}g • F: {item.fat}g
                  </Text>
                </View>

                <View style={{ alignItems: 'flex-end', marginLeft: spacing.md }}>
                  <Text style={[typography.labelLarge, { color: colors.textPrimary }]}>
                    {item.calories}{' '}
                    <Text style={[typography.caption, { color: colors.textTertiary }]}>kcal</Text>
                  </Text>
                </View>
              </View>
            ))}
          </Card>
        )}
      </View>
    );
  };

  const totalCalories =
    breakfastItems.reduce((acc, i) => acc + i.calories, 0) +
    lunchItems.reduce((acc, i) => acc + i.calories, 0) +
    snackItems.reduce((acc, i) => acc + i.calories, 0);

  return (
    <ScreenContainer>
      {/* Date Navigator */}
      <View
        style={[
          styles.dateNav,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
            borderRadius: radii.md,
            paddingHorizontal: spacing.sm,
            paddingVertical: spacing.xs,
            marginBottom: spacing.lg,
          },
        ]}
      >
        <IconButton
          icon={<ChevronLeft size={20} color={colors.textPrimary} />}
          onPress={() => setDateIndex(prev => prev - 1)}
          accessibilityLabel="Previous day"
          size="sm"
        />
        <Text style={[typography.labelLarge, { color: colors.textPrimary }]}>
          {currentDateLabel}
        </Text>
        <IconButton
          icon={<ChevronRight size={20} color={colors.textPrimary} />}
          onPress={() => setDateIndex(prev => prev + 1)}
          accessibilityLabel="Next day"
          size="sm"
        />
      </View>

      {/* Daily Summary Bar */}
      <Card style={[styles.daySummaryCard, { marginBottom: spacing.xl }]}>
        <View style={styles.summaryCol}>
          <Text style={[typography.labelSmall, { color: colors.textSecondary }]}>TOTAL LOGGED</Text>
          <Text
            style={[typography.numericLarge, { color: colors.textPrimary, marginTop: spacing.xxs }]}
          >
            {totalCalories}
          </Text>
          <Text style={[typography.caption, { color: colors.textTertiary }]}>kcal</Text>
        </View>

        <View style={[styles.divider, { backgroundColor: colors.border }]} />

        <View style={styles.summaryCol}>
          <Text style={[typography.labelSmall, { color: colors.textSecondary }]}>DAILY TARGET</Text>
          <Text
            style={[typography.numericLarge, { color: colors.textPrimary, marginTop: spacing.xxs }]}
          >
            2100
          </Text>
          <Text style={[typography.caption, { color: colors.textTertiary }]}>kcal</Text>
        </View>

        <View style={[styles.divider, { backgroundColor: colors.border }]} />

        <View style={styles.summaryCol}>
          <Text style={[typography.labelSmall, { color: colors.textSecondary }]}>REMAINING</Text>
          <Text
            style={[typography.numericLarge, { color: colors.textPrimary, marginTop: spacing.xxs }]}
          >
            {2100 - totalCalories}
          </Text>
          <Text style={[typography.caption, { color: colors.textTertiary }]}>kcal</Text>
        </View>
      </Card>

      {/* Meal Sections */}
      {renderMealSection('Breakfast', breakfastItems, 550)}
      {renderMealSection('Lunch', lunchItems, 750)}
      {renderMealSection('Snacks', snackItems, 250)}
      {renderMealSection('Dinner', dinnerItems, 550)}
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  dateNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
  },
  daySummaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: 16,
  },
  summaryCol: {
    alignItems: 'center',
    flex: 1,
  },
  divider: {
    width: 1,
    height: 36,
  },
  mealHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});
