import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Modal,
  ActivityIndicator,
} from 'react-native';
import {
  ScreenContainer,
  Card,
  Button,
  IconButton,
  ProgressIndicator,
  MacroIndicator,
  LoadingIndicator,
  ErrorState,
  TextInput,
} from '../../components';
import { useTheme } from '../../app/providers/ThemeProvider';
import { ChevronLeft, ChevronRight, Plus, Utensils, Pencil, Trash, X } from 'lucide-react-native';
import { defaultDiaryApiClient, DiaryApiClient } from '../../services/diaryApi';
import { defaultFoodApiClient, FoodApiClient } from '../../services/foodApi';
import type {
  DailyNutritionSummary,
  MealEntryDto,
  MealFoodItemDto,
  FoodSearchResultItem,
} from '@calmeter/contracts';
import {
  formatDateToIso,
  parseIsoDate,
  addDays,
  roundTo,
  scaleNutrients,
  convertServingToGrams,
  NutrientProfile,
  MealType,
  LoggedMethod,
} from '@calmeter/shared';

export interface DiaryScreenProps {
  diaryApiClient?: DiaryApiClient;
  foodApiClient?: FoodApiClient;
  initialDate?: string;
}

const MONTH_NAMES = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function formatHeaderDate(isoDate: string): string {
  try {
    const d = parseIsoDate(isoDate);
    const today = new Date();
    const todayIso = formatDateToIso(today);
    const yesterdayIso = formatDateToIso(addDays(today, -1));
    const tomorrowIso = formatDateToIso(addDays(today, 1));

    const dayName = DAY_NAMES[d.getUTCDay()];
    const monthName = MONTH_NAMES[d.getUTCMonth()];
    const dateNum = d.getUTCDate();

    if (isoDate === todayIso) {
      return `Today, ${dateNum} ${monthName}`;
    }
    if (isoDate === yesterdayIso) {
      return `Yesterday, ${dateNum} ${monthName}`;
    }
    if (isoDate === tomorrowIso) {
      return `Tomorrow, ${dateNum} ${monthName}`;
    }
    return `${dayName}, ${dateNum} ${monthName}`;
  } catch {
    return isoDate;
  }
}

export const DiaryScreen: React.FC<DiaryScreenProps> = ({
  diaryApiClient = defaultDiaryApiClient,
  foodApiClient = defaultFoodApiClient,
  initialDate,
}) => {
  const { theme } = useTheme();
  const { colors, typography, spacing } = theme;

  const todayIso = useMemo(() => formatDateToIso(new Date()), []);
  const [selectedDate, setSelectedDate] = useState<string>(initialDate || todayIso);

  const [summary, setSummary] = useState<DailyNutritionSummary | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Add Food Modal state
  const [addModalMealType, setAddModalMealType] = useState<MealType | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchResults, setSearchResults] = useState<FoodSearchResultItem[]>([]);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [selectedFood, setSelectedFood] = useState<FoodSearchResultItem | null>(null);
  const [addPortionAmount, setAddPortionAmount] = useState<string>('1');
  const [addServingUnit, setAddServingUnit] = useState<string>('g');
  const [isSubmittingLog, setIsSubmittingLog] = useState<boolean>(false);
  const [addError, setAddError] = useState<string | null>(null);

  // Edit Food Modal state
  const [editingItem, setEditingItem] = useState<MealFoodItemDto | null>(null);
  const [editPortionAmount, setEditPortionAmount] = useState<string>('1');
  const [editServingUnit, setEditServingUnit] = useState<string>('serving');
  const [isSubmittingEdit, setIsSubmittingEdit] = useState<boolean>(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Fetch diary data for the selected date
  const loadDiary = useCallback(
    async (date: string) => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await diaryApiClient.getDailySummary(date);
        setSummary(data);
      } catch (err) {
        setError((err as Error)?.message || 'Failed to load diary.');
      } finally {
        setIsLoading(false);
      }
    },
    [diaryApiClient],
  );

  useEffect(() => {
    loadDiary(selectedDate);
  }, [selectedDate, loadDiary]);

  // Date navigation handlers
  const handlePrevDay = () => {
    try {
      const prevDate = formatDateToIso(addDays(parseIsoDate(selectedDate), -1));
      setSelectedDate(prevDate);
    } catch {
      // fallback
    }
  };

  const handleNextDay = () => {
    try {
      const nextDate = formatDateToIso(addDays(parseIsoDate(selectedDate), 1));
      setSelectedDate(nextDate);
    } catch {
      // fallback
    }
  };

  const handleToday = () => {
    setSelectedDate(todayIso);
  };

  // Debounced search effect
  useEffect(() => {
    if (!addModalMealType) return;
    const query = searchQuery.trim();
    if (!query) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      setAddError(null);
      try {
        const resp = await foodApiClient.searchFoods({
          q: query,
          page: 1,
          limit: 10,
          sortBy: 'relevance',
          sortOrder: 'asc',
        });
        setSearchResults(resp.items);
      } catch (err) {
        setAddError((err as Error)?.message || 'Failed to search foods.');
      } finally {
        setIsSearching(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [searchQuery, addModalMealType, foodApiClient]);

  // Food selection handler
  const handleSelectFood = (food: FoodSearchResultItem) => {
    setSelectedFood(food);
    setAddPortionAmount('1');
    setAddServingUnit(food.servingUnit || 'g');
  };

  // Live preview calculation for Add Food modal
  const addNutritionPreview = useMemo(() => {
    if (!selectedFood) return null;
    const portion = parseFloat(addPortionAmount);
    if (!Number.isFinite(portion) || portion <= 0) return null;

    let grams = portion * 100;
    const conv = convertServingToGrams([], addServingUnit, portion);
    if (conv.success) {
      grams = conv.gramWeight;
    } else if (addServingUnit === selectedFood.servingUnit) {
      grams = portion * Number(selectedFood.standardWeightGrams || 100);
    }

    const profile: NutrientProfile = {
      calories: Number(selectedFood.calories),
      proteinGrams: Number(selectedFood.protein),
      carbsGrams: Number(selectedFood.carbs),
      fatGrams: Number(selectedFood.fat),
      fiberGrams: selectedFood.fiber !== null ? Number(selectedFood.fiber) : undefined,
    };

    try {
      const scaled = scaleNutrients(profile, grams);
      return {
        calories: roundTo(scaled.calories, 1),
        protein: roundTo(scaled.proteinGrams, 1),
        carbs: roundTo(scaled.carbsGrams, 1),
        fat: roundTo(scaled.fatGrams, 1),
        grams: roundTo(grams, 1),
      };
    } catch {
      return null;
    }
  }, [selectedFood, addPortionAmount, addServingUnit]);

  // Submit Add Food
  const handleLogFoodSubmit = async () => {
    if (!selectedFood || !addModalMealType) return;
    const portion = parseFloat(addPortionAmount);
    if (!Number.isFinite(portion) || portion <= 0) {
      setAddError('Please enter a valid positive quantity.');
      return;
    }

    setIsSubmittingLog(true);
    setAddError(null);
    try {
      await diaryApiClient.createDiaryEntry({
        date: selectedDate,
        mealType: addModalMealType,
        items: [
          {
            foodItemId: selectedFood.id,
            foodName: selectedFood.name,
            portionAmount: portion,
            servingUnit: addServingUnit,
            loggedMethod: LoggedMethod.SEARCH,
          },
        ],
      });

      // Reset modal state & reload
      setAddModalMealType(null);
      setSelectedFood(null);
      setSearchQuery('');
      setSearchResults([]);
      await loadDiary(selectedDate);
    } catch (err) {
      setAddError((err as Error)?.message || 'Failed to log food.');
    } finally {
      setIsSubmittingLog(false);
    }
  };

  // Open Edit Modal
  const handleOpenEdit = (item: MealFoodItemDto) => {
    setEditingItem(item);
    setEditPortionAmount(String(item.portionAmount));
    setEditServingUnit(item.servingUnit);
    setEditError(null);
  };

  // Submit Edit Food
  const handleUpdateItemSubmit = async () => {
    if (!editingItem) return;
    const portion = parseFloat(editPortionAmount);
    if (!Number.isFinite(portion) || portion <= 0) {
      setEditError('Please enter a valid positive quantity.');
      return;
    }

    setIsSubmittingEdit(true);
    setEditError(null);
    try {
      await diaryApiClient.updateDiaryEntry(editingItem.id, {
        portionAmount: portion,
        servingUnit: editServingUnit,
      });

      setEditingItem(null);
      await loadDiary(selectedDate);
    } catch (err) {
      setEditError((err as Error)?.message || 'Failed to update entry.');
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  // Delete Item
  const handleDeleteItem = async (itemId: string) => {
    try {
      await diaryApiClient.deleteDiaryEntry(itemId);
      await loadDiary(selectedDate);
    } catch (err) {
      setError((err as Error)?.message || 'Failed to delete item.');
    }
  };

  // Meal sections configuration
  const mealSections: Array<{
    type: MealType;
    title: string;
    description: string;
  }> = [
    { type: MealType.BREAKFAST, title: 'Breakfast', description: 'Morning fuel' },
    { type: MealType.LUNCH, title: 'Lunch', description: 'Midday meal' },
    { type: MealType.DINNER, title: 'Dinner', description: 'Evening meal' },
    { type: MealType.SNACK, title: 'Snacks', description: 'Bites & snacks' },
  ];

  const mealMap = useMemo(() => {
    const map = new Map<string, MealEntryDto>();
    if (summary?.meals) {
      for (const meal of summary.meals) {
        map.set(meal.mealType, meal);
      }
    }
    return map;
  }, [summary]);

  return (
    <ScreenContainer>
      {/* Top Date Header & Navigation */}
      <View style={[styles.dateHeader, { marginBottom: spacing.md }]}>
        <IconButton
          icon={<ChevronLeft size={22} color={colors.textPrimary} />}
          onPress={handlePrevDay}
          accessibilityLabel="Previous day"
          variant="outline"
          size="sm"
        />

        <View style={styles.dateCenterContainer}>
          <Text
            style={[typography.titleLarge, { color: colors.textPrimary, textAlign: 'center' }]}
            accessibilityRole="header"
          >
            {formatHeaderDate(selectedDate)}
          </Text>
          {selectedDate !== todayIso && (
            <Pressable
              onPress={handleToday}
              style={[styles.todayBadge, { backgroundColor: colors.surface }]}
              accessibilityRole="button"
              accessibilityLabel="Jump to today"
            >
              <Text
                style={[
                  typography.labelSmall,
                  { color: colors.textSecondary, textDecorationLine: 'underline' },
                ]}
              >
                Go to Today
              </Text>
            </Pressable>
          )}
        </View>

        <IconButton
          icon={<ChevronRight size={22} color={colors.textPrimary} />}
          onPress={handleNextDay}
          accessibilityLabel="Next day"
          variant="outline"
          size="sm"
        />
      </View>

      {/* Main Content Area */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <LoadingIndicator message="Loading your diary..." />
        </View>
      ) : error ? (
        <ErrorState message={error} retryLabel="Retry" onRetry={() => loadDiary(selectedDate)} />
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: spacing.xxl }}
        >
          {/* Daily Nutrition Summary Card */}
          {summary && (
            <Card style={[styles.summaryCard, { marginBottom: spacing.lg }]}>
              <View style={styles.summaryTopRow}>
                <View>
                  <Text style={[typography.labelMedium, { color: colors.textSecondary }]}>
                    CALORIES CONSUMED
                  </Text>
                  <Text style={[typography.numericLarge, { color: colors.textPrimary }]}>
                    {summary.caloriesConsumed}
                    <Text
                      style={[typography.bodyMedium, { color: colors.textSecondary }]}
                    >{` / ${summary.calorieGoal} kcal`}</Text>
                  </Text>
                </View>

                <View
                  style={[
                    styles.remainingBadge,
                    {
                      backgroundColor:
                        summary.caloriesRemaining >= 0 ? colors.surface : colors.errorBackground,
                    },
                  ]}
                >
                  <Text
                    style={[
                      typography.labelMedium,
                      {
                        color: summary.caloriesRemaining >= 0 ? colors.textPrimary : colors.error,
                      },
                    ]}
                  >
                    {summary.caloriesRemaining >= 0
                      ? `${summary.caloriesRemaining} kcal left`
                      : `${Math.abs(summary.caloriesRemaining)} kcal over`}
                  </Text>
                </View>
              </View>

              <ProgressIndicator
                current={summary.caloriesConsumed}
                target={summary.calorieGoal}
                label="Calories"
                unit="kcal"
              />

              {/* Macro Indicators */}
              <View style={[styles.macrosContainer, { marginTop: spacing.md }]}>
                <MacroIndicator
                  protein={{
                    label: 'Protein',
                    currentGrams: summary.macros.protein.consumed,
                    targetGrams: summary.macros.protein.target,
                  }}
                  carbs={{
                    label: 'Carbs',
                    currentGrams: summary.macros.carbs.consumed,
                    targetGrams: summary.macros.carbs.target,
                  }}
                  fat={{
                    label: 'Fat',
                    currentGrams: summary.macros.fat.consumed,
                    targetGrams: summary.macros.fat.target,
                  }}
                />
              </View>
            </Card>
          )}

          {/* Meal Sections: Breakfast, Lunch, Dinner, Snacks */}
          {mealSections.map(section => {
            const meal = mealMap.get(section.type);
            const items = meal?.items || [];
            const mealCalories = meal?.totalCalories ?? 0;

            return (
              <Card
                key={section.type}
                style={[styles.mealSectionCard, { marginBottom: spacing.md }]}
              >
                {/* Meal Header */}
                <View style={styles.mealHeader}>
                  <View style={styles.mealTitleRow}>
                    <Utensils size={18} color={colors.textPrimary} style={{ marginRight: 6 }} />
                    <Text style={[typography.titleMedium, { color: colors.textPrimary }]}>
                      {section.title}
                    </Text>
                  </View>

                  <View style={styles.mealHeaderRight}>
                    <Text
                      style={[
                        typography.labelLarge,
                        { color: colors.textPrimary, marginRight: spacing.sm },
                      ]}
                    >
                      {mealCalories > 0 ? `${mealCalories} kcal` : ''}
                    </Text>
                    <IconButton
                      icon={<Plus size={18} color={colors.textPrimary} />}
                      onPress={() => setAddModalMealType(section.type)}
                      accessibilityLabel={`Add food to ${section.title}`}
                      size="sm"
                      variant="outline"
                    />
                  </View>
                </View>

                {/* Logged Items List */}
                {items.length === 0 ? (
                  <View style={[styles.emptyMealContainer, { paddingVertical: spacing.sm }]}>
                    <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>
                      {`No food logged for ${section.title.toLowerCase()}.`}
                    </Text>
                  </View>
                ) : (
                  <View style={{ marginTop: spacing.sm }}>
                    {items.map(item => (
                      <View
                        key={item.id}
                        style={[
                          styles.foodItemRow,
                          {
                            borderTopWidth: StyleSheet.hairlineWidth,
                            borderColor: colors.border,
                            paddingVertical: spacing.sm,
                          },
                        ]}
                      >
                        <View style={{ flex: 1, paddingRight: spacing.sm }}>
                          <Text
                            style={[typography.bodyMedium, { color: colors.textPrimary }]}
                            numberOfLines={1}
                          >
                            {item.foodName}
                          </Text>
                          <Text style={[typography.labelSmall, { color: colors.textSecondary }]}>
                            {`${item.portionAmount} ${item.servingUnit} (${item.gramWeight}g)`}
                          </Text>
                          <Text style={[typography.labelSmall, { color: colors.textSecondary }]}>
                            {`${item.calories} kcal • P: ${item.protein}g • C: ${item.carbs}g • F: ${item.fat}g`}
                          </Text>
                        </View>

                        {/* Edit & Delete Action Buttons */}
                        <View style={styles.itemActionButtons}>
                          <IconButton
                            icon={<Pencil size={15} color={colors.textSecondary} />}
                            onPress={() => handleOpenEdit(item)}
                            accessibilityLabel={`Edit ${item.foodName}`}
                            size="sm"
                            variant="ghost"
                          />
                          <IconButton
                            icon={<Trash size={15} color={colors.error} />}
                            onPress={() => handleDeleteItem(item.id)}
                            accessibilityLabel={`Delete ${item.foodName}`}
                            size="sm"
                            variant="ghost"
                          />
                        </View>
                      </View>
                    ))}
                  </View>
                )}
              </Card>
            );
          })}
        </ScrollView>
      )}

      {/* Add Food Modal */}
      <Modal
        visible={addModalMealType !== null}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setAddModalMealType(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
            {/* Modal Header */}
            <View
              style={[styles.modalHeader, { borderBottomWidth: 1, borderColor: colors.border }]}
            >
              <Text style={[typography.titleLarge, { color: colors.textPrimary }]}>
                {selectedFood ? 'Portion & Nutrition' : `Add to ${addModalMealType || 'Meal'}`}
              </Text>
              <IconButton
                icon={<X size={20} color={colors.textPrimary} />}
                onPress={() => {
                  setAddModalMealType(null);
                  setSelectedFood(null);
                  setSearchQuery('');
                  setSearchResults([]);
                }}
                accessibilityLabel="Close add food modal"
                size="sm"
                variant="ghost"
              />
            </View>

            {/* Step 1: Search foods */}
            {!selectedFood ? (
              <View style={styles.modalBody}>
                <TextInput
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholder="Search foods (e.g. Roti, Dal, Paneer)..."
                  accessibilityLabel="Food search input"
                  autoFocus
                />

                {isSearching ? (
                  <View style={styles.searchingContainer}>
                    <ActivityIndicator size="small" color={colors.textPrimary} />
                    <Text
                      style={[
                        typography.bodySmall,
                        { color: colors.textSecondary, marginLeft: spacing.sm },
                      ]}
                    >
                      Searching catalog...
                    </Text>
                  </View>
                ) : searchResults.length > 0 ? (
                  <ScrollView style={{ marginTop: spacing.md, maxHeight: 320 }}>
                    {searchResults.map(food => (
                      <Pressable
                        key={food.id}
                        onPress={() => handleSelectFood(food)}
                        style={[
                          styles.searchResultItem,
                          {
                            borderBottomWidth: StyleSheet.hairlineWidth,
                            borderColor: colors.border,
                            paddingVertical: spacing.md,
                          },
                        ]}
                        accessibilityRole="button"
                        accessibilityLabel={`Select ${food.name}`}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={[typography.titleSmall, { color: colors.textPrimary }]}>
                            {food.name}
                          </Text>
                          <Text style={[typography.labelSmall, { color: colors.textSecondary }]}>
                            {food.brand ? `${food.brand} • ` : ''}
                            {`${food.calories} kcal / 100g • P: ${food.protein}g`}
                          </Text>
                        </View>
                        <Plus size={18} color={colors.textPrimary} />
                      </Pressable>
                    ))}
                  </ScrollView>
                ) : searchQuery.trim().length > 0 ? (
                  <View style={[styles.emptySearchContainer, { marginTop: spacing.lg }]}>
                    <Text style={[typography.bodyMedium, { color: colors.textSecondary }]}>
                      No foods found matching &quot;{searchQuery}&quot;.
                    </Text>
                  </View>
                ) : null}

                {addError && (
                  <Text
                    style={[typography.labelSmall, { color: colors.error, marginTop: spacing.sm }]}
                  >
                    {addError}
                  </Text>
                )}
              </View>
            ) : (
              /* Step 2: Portion selector & live nutrition preview */
              <View style={styles.modalBody}>
                <Text style={[typography.titleMedium, { color: colors.textPrimary }]}>
                  {selectedFood.name}
                </Text>

                {/* Serving Unit Selector */}
                <View style={{ marginTop: spacing.md }}>
                  <Text
                    style={[
                      typography.labelSmall,
                      { color: colors.textSecondary, marginBottom: spacing.xs },
                    ]}
                  >
                    SERVING UNIT
                  </Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {['g', selectedFood.servingUnit || 'serving'].map(unit => {
                      const isSelected = addServingUnit === unit;
                      return (
                        <Pressable
                          key={unit}
                          onPress={() => setAddServingUnit(unit)}
                          style={[
                            styles.unitPill,
                            {
                              backgroundColor: isSelected ? colors.primary : colors.surface,
                              borderColor: colors.border,
                              marginRight: spacing.xs,
                            },
                          ]}
                          accessibilityRole="button"
                          accessibilityLabel={`Unit ${unit}`}
                        >
                          <Text
                            style={[
                              typography.labelSmall,
                              {
                                color: isSelected ? colors.background : colors.textPrimary,
                              },
                            ]}
                          >
                            {unit}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                </View>

                {/* Quantity input */}
                <View style={{ marginTop: spacing.md }}>
                  <Text
                    style={[
                      typography.labelSmall,
                      { color: colors.textSecondary, marginBottom: spacing.xs },
                    ]}
                  >
                    QUANTITY
                  </Text>
                  <View style={styles.quantityRow}>
                    <IconButton
                      icon={<Text style={{ fontSize: 18, color: colors.textPrimary }}>-</Text>}
                      onPress={() => {
                        const val = Math.max(0.25, (parseFloat(addPortionAmount) || 1) - 0.5);
                        setAddPortionAmount(String(roundTo(val, 2)));
                      }}
                      accessibilityLabel="Decrease quantity"
                      size="sm"
                      variant="outline"
                    />
                    <View style={{ width: 100, marginHorizontal: spacing.sm }}>
                      <TextInput
                        value={addPortionAmount}
                        onChangeText={setAddPortionAmount}
                        keyboardType="numeric"
                        accessibilityLabel="Portion amount"
                      />
                    </View>
                    <IconButton
                      icon={<Text style={{ fontSize: 18, color: colors.textPrimary }}>+</Text>}
                      onPress={() => {
                        const val = (parseFloat(addPortionAmount) || 1) + 0.5;
                        setAddPortionAmount(String(roundTo(val, 2)));
                      }}
                      accessibilityLabel="Increase quantity"
                      size="sm"
                      variant="outline"
                    />
                  </View>
                </View>

                {/* Live Nutrition Preview */}
                {addNutritionPreview && (
                  <Card style={[styles.previewCard, { marginTop: spacing.lg }]}>
                    <Text
                      style={[
                        typography.labelMedium,
                        { color: colors.textSecondary, marginBottom: 4 },
                      ]}
                    >
                      ESTIMATED NUTRITION ({addNutritionPreview.grams}g)
                    </Text>
                    <Text style={[typography.numericMedium, { color: colors.textPrimary }]}>
                      {addNutritionPreview.calories} kcal
                    </Text>
                    <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>
                      {`Protein: ${addNutritionPreview.protein}g • Carbs: ${addNutritionPreview.carbs}g • Fat: ${addNutritionPreview.fat}g`}
                    </Text>
                  </Card>
                )}

                {addError && (
                  <Text
                    style={[typography.labelSmall, { color: colors.error, marginTop: spacing.sm }]}
                  >
                    {addError}
                  </Text>
                )}

                {/* Action Buttons */}
                <View style={[styles.modalActions, { marginTop: spacing.xl }]}>
                  <Button
                    title="Change Food"
                    onPress={() => setSelectedFood(null)}
                    variant="outline"
                    size="md"
                    accessibilityLabel="Change food selection"
                  />
                  <Button
                    title={isSubmittingLog ? 'Logging...' : 'Log Food'}
                    onPress={handleLogFoodSubmit}
                    disabled={isSubmittingLog}
                    variant="primary"
                    size="md"
                    accessibilityLabel="Confirm food logging"
                  />
                </View>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* Edit Food Modal */}
      <Modal
        visible={editingItem !== null}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setEditingItem(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
            <View
              style={[styles.modalHeader, { borderBottomWidth: 1, borderColor: colors.border }]}
            >
              <Text style={[typography.titleLarge, { color: colors.textPrimary }]}>
                Edit Logged Item
              </Text>
              <IconButton
                icon={<X size={20} color={colors.textPrimary} />}
                onPress={() => setEditingItem(null)}
                accessibilityLabel="Close edit modal"
                size="sm"
                variant="ghost"
              />
            </View>

            {editingItem && (
              <View style={styles.modalBody}>
                <Text style={[typography.titleMedium, { color: colors.textPrimary }]}>
                  {editingItem.foodName}
                </Text>

                <View style={{ marginTop: spacing.md }}>
                  <Text
                    style={[
                      typography.labelSmall,
                      { color: colors.textSecondary, marginBottom: spacing.xs },
                    ]}
                  >
                    PORTION QUANTITY ({editingItem.servingUnit})
                  </Text>
                  <View style={styles.quantityRow}>
                    <IconButton
                      icon={<Text style={{ fontSize: 18, color: colors.textPrimary }}>-</Text>}
                      onPress={() => {
                        const val = Math.max(0.25, (parseFloat(editPortionAmount) || 1) - 0.5);
                        setEditPortionAmount(String(roundTo(val, 2)));
                      }}
                      accessibilityLabel="Decrease quantity"
                      size="sm"
                      variant="outline"
                    />
                    <View style={{ width: 100, marginHorizontal: spacing.sm }}>
                      <TextInput
                        value={editPortionAmount}
                        onChangeText={setEditPortionAmount}
                        keyboardType="numeric"
                        accessibilityLabel="Edit portion amount"
                      />
                    </View>
                    <IconButton
                      icon={<Text style={{ fontSize: 18, color: colors.textPrimary }}>+</Text>}
                      onPress={() => {
                        const val = (parseFloat(editPortionAmount) || 1) + 0.5;
                        setEditPortionAmount(String(roundTo(val, 2)));
                      }}
                      accessibilityLabel="Increase quantity"
                      size="sm"
                      variant="outline"
                    />
                  </View>
                </View>

                {editError && (
                  <Text
                    style={[typography.labelSmall, { color: colors.error, marginTop: spacing.sm }]}
                  >
                    {editError}
                  </Text>
                )}

                <View style={[styles.modalActions, { marginTop: spacing.xl }]}>
                  <Button
                    title="Cancel"
                    onPress={() => setEditingItem(null)}
                    variant="outline"
                    size="md"
                    accessibilityLabel="Cancel edit"
                  />
                  <Button
                    title={isSubmittingEdit ? 'Saving...' : 'Save Changes'}
                    onPress={handleUpdateItemSubmit}
                    disabled={isSubmittingEdit}
                    variant="primary"
                    size="md"
                    accessibilityLabel="Save edited food changes"
                  />
                </View>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  dateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  dateCenterContainer: {
    alignItems: 'center',
  },
  todayBadge: {
    marginTop: 2,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 250,
  },
  summaryCard: {
    padding: 16,
  },
  summaryTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  remainingBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  macrosContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  mealSectionCard: {
    padding: 16,
  },
  mealHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  mealTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  mealHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  emptyMealContainer: {
    paddingVertical: 8,
  },
  foodItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  itemActionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 12,
  },
  modalBody: {
    marginTop: 16,
  },
  searchingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  emptySearchContainer: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  unitPill: {
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  quantityRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  previewCard: {
    padding: 12,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
});
