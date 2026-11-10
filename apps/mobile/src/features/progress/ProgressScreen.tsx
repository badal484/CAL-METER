import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, Modal, Alert } from 'react-native';
import {
  ScreenContainer,
  Card,
  Button,
  IconButton,
  TextInput,
  ProgressIndicator,
  LoadingIndicator,
  ErrorState,
} from '../../components';
import { useTheme } from '../../app/providers/ThemeProvider';
import {
  Scale,
  Droplets,
  Dumbbell,
  Plus,
  Trash2,
  X,
  TrendingDown,
  TrendingUp,
  Minus,
  Info,
  Flame,
  Check,
} from 'lucide-react-native';
import { defaultTrackingApiClient, TrackingApiClient } from '../../services/trackingApi';
import type { DailyWaterSummaryDto, ExerciseLogDto, ProgressReportDto } from '@calmeter/contracts';
import {
  kgToLbs,
  lbsToKg,
  mlToLiters,
  litersToMl,
  mlToFlOz,
  flOzToMl,
  roundTo,
  formatDateToIso,
  ExerciseCategory,
  ExerciseIntensity,
} from '@calmeter/shared';

export interface ProgressScreenProps {
  trackingApiClient?: TrackingApiClient;
  initialRange?: '7D' | '30D' | '90D' | '1Y';
}

type RangeOption = '7D' | '30D' | '90D' | '1Y';
type WeightUnit = 'kg' | 'lbs';
type WaterUnit = 'ml' | 'L' | 'fl oz';

export const ProgressScreen: React.FC<ProgressScreenProps> = ({
  trackingApiClient = defaultTrackingApiClient,
  initialRange = '30D',
}) => {
  const { theme } = useTheme();
  const { colors, typography, spacing, radii } = theme;

  // View preferences
  const [activeRange, setActiveRange] = useState<RangeOption>(initialRange);
  const [weightUnit, setWeightUnit] = useState<WeightUnit>('kg');
  const [waterUnit, setWaterUnit] = useState<WaterUnit>('ml');

  // Server state
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [progressReport, setProgressReport] = useState<ProgressReportDto | null>(null);
  const [waterSummary, setWaterSummary] = useState<DailyWaterSummaryDto | null>(null);
  const [recentExercises, setRecentExercises] = useState<ExerciseLogDto[]>([]);

  // Modals
  const [isWeightModalVisible, setIsWeightModalVisible] = useState<boolean>(false);
  const [isWaterModalVisible, setIsWaterModalVisible] = useState<boolean>(false);
  const [isExerciseModalVisible, setIsExerciseModalVisible] = useState<boolean>(false);

  // Form states: Weight
  const [weightInput, setWeightInput] = useState<string>('');
  const [weightNotes, setWeightNotes] = useState<string>('');
  const [weightFormError, setWeightFormError] = useState<string | null>(null);
  const [isSubmittingWeight, setIsSubmittingWeight] = useState<boolean>(false);

  // Form states: Water
  const [waterAmountInput, setWaterAmountInput] = useState<string>('');
  const [waterFormUnit, setWaterFormUnit] = useState<WaterUnit>('ml');
  const [waterFormError, setWaterFormError] = useState<string | null>(null);
  const [isSubmittingWater, setIsSubmittingWater] = useState<boolean>(false);

  // Form states: Exercise
  const [exerciseName, setExerciseName] = useState<string>('');
  const [exerciseCategory, setExerciseCategory] = useState<ExerciseCategory>(
    ExerciseCategory.WALKING,
  );
  const [exerciseDuration, setExerciseDuration] = useState<string>('30');
  const [exerciseIntensity, setExerciseIntensity] = useState<ExerciseIntensity>(
    ExerciseIntensity.MODERATE,
  );
  const [exerciseDistance, setExerciseDistance] = useState<string>('');
  const [exerciseCalories, setExerciseCalories] = useState<string>('');
  const [estimateCaloriesWithMet, setEstimateCaloriesWithMet] = useState<boolean>(true);
  const [exerciseNotes, setExerciseNotes] = useState<string>('');
  const [exerciseFormError, setExerciseFormError] = useState<string | null>(null);
  const [isSubmittingExercise, setIsSubmittingExercise] = useState<boolean>(false);

  // Range day count mapper
  const rangeDays = useMemo(() => {
    switch (activeRange) {
      case '7D':
        return 7;
      case '30D':
        return 30;
      case '90D':
        return 90;
      case '1Y':
        return 365;
    }
  }, [activeRange]);

  const todayIso = useMemo(() => formatDateToIso(new Date()), []);

  // Fetch all tracking and progress data
  const loadTrackingData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [report, dailyWater, exercises] = await Promise.all([
        trackingApiClient.getProgressReport({ days: rangeDays }),
        trackingApiClient.getWaterSummaryForDate(todayIso),
        trackingApiClient.getExercises({ limit: 15 }),
      ]);

      setProgressReport(report);
      setWaterSummary(dailyWater);
      setRecentExercises(exercises);
    } catch (err: any) {
      setError(err.message || 'Failed to load progress data.');
    } finally {
      setLoading(false);
    }
  }, [trackingApiClient, rangeDays, todayIso]);

  useEffect(() => {
    loadTrackingData();
  }, [loadTrackingData]);

  // ============================================================================
  // UNIT FORMATTERS
  // ============================================================================

  const displayWeight = useCallback(
    (kg: number | null | undefined): string => {
      if (kg === null || kg === undefined || !Number.isFinite(kg)) return '—';
      if (weightUnit === 'lbs') {
        return `${kgToLbs(kg)} lbs`;
      }
      return `${roundTo(kg, 1)} kg`;
    },
    [weightUnit],
  );

  const displayWater = useCallback(
    (ml: number): string => {
      if (!Number.isFinite(ml)) return '—';
      if (waterUnit === 'L') {
        return `${mlToLiters(ml)} L`;
      }
      if (waterUnit === 'fl oz') {
        return `${mlToFlOz(ml)} fl oz`;
      }
      return `${ml} ml`;
    },
    [waterUnit],
  );

  // ============================================================================
  // HANDLERS: WEIGHT
  // ============================================================================

  const handleOpenWeightModal = () => {
    const initialVal = progressReport?.weight?.currentWeightKg
      ? weightUnit === 'lbs'
        ? String(kgToLbs(progressReport.weight.currentWeightKg))
        : String(progressReport.weight.currentWeightKg)
      : '';
    setWeightInput(initialVal);
    setWeightNotes('');
    setWeightFormError(null);
    setIsWeightModalVisible(true);
  };

  const handleSaveWeight = async () => {
    const numeric = parseFloat(weightInput.trim());
    if (isNaN(numeric) || numeric <= 0) {
      setWeightFormError('Please enter a valid numeric weight measurement.');
      return;
    }

    const weightKg = weightUnit === 'lbs' ? lbsToKg(numeric) : numeric;
    if (weightKg < 30 || weightKg > 350) {
      setWeightFormError(
        weightUnit === 'lbs'
          ? 'Weight must be between 66.1 lbs and 771.6 lbs.'
          : 'Weight must be between 30 kg and 350 kg.',
      );
      return;
    }

    try {
      setIsSubmittingWeight(true);
      setWeightFormError(null);
      await trackingApiClient.logWeight({
        weightKg: roundTo(weightKg, 2),
        source: 'MANUAL',
        notes: weightNotes.trim() ? weightNotes.trim() : undefined,
      });
      setIsWeightModalVisible(false);
      await loadTrackingData();
    } catch (err: any) {
      setWeightFormError(err.message || 'Failed to record weight.');
    } finally {
      setIsSubmittingWeight(false);
    }
  };

  const handleDeleteWeight = (id: string) => {
    Alert.alert('Delete Measurement', 'Are you sure you want to delete this weight log?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await trackingApiClient.deleteWeightLog(id);
            await loadTrackingData();
          } catch (err: any) {
            Alert.alert('Error', err.message || 'Failed to delete weight log.');
          }
        },
      },
    ]);
  };

  // ============================================================================
  // HANDLERS: WATER
  // ============================================================================

  const handleQuickAddWater = async (amountMl: number) => {
    try {
      await trackingApiClient.logWater({
        amountMl,
        date: todayIso,
        source: 'QUICK_ADD',
      });
      const updated = await trackingApiClient.getWaterSummaryForDate(todayIso);
      setWaterSummary(updated);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to log water intake.');
    }
  };

  const handleOpenWaterModal = () => {
    setWaterAmountInput('');
    setWaterFormUnit(waterUnit);
    setWaterFormError(null);
    setIsWaterModalVisible(true);
  };

  const handleSaveWater = async () => {
    const val = parseFloat(waterAmountInput.trim());
    if (isNaN(val) || val <= 0) {
      setWaterFormError('Please enter a valid positive volume.');
      return;
    }

    let ml = val;
    if (waterFormUnit === 'L') {
      ml = litersToMl(val);
    } else if (waterFormUnit === 'fl oz') {
      ml = flOzToMl(val);
    }

    const roundedMl = Math.round(ml);
    if (roundedMl <= 0 || roundedMl > 5000) {
      setWaterFormError('Water intake per single entry must be between 1 ml and 5,000 ml.');
      return;
    }

    try {
      setIsSubmittingWater(true);
      setWaterFormError(null);
      await trackingApiClient.logWater({
        amountMl: roundedMl,
        date: todayIso,
        source: 'MANUAL',
      });
      setIsWaterModalVisible(false);
      const updated = await trackingApiClient.getWaterSummaryForDate(todayIso);
      setWaterSummary(updated);
    } catch (err: any) {
      setWaterFormError(err.message || 'Failed to log water intake.');
    } finally {
      setIsSubmittingWater(false);
    }
  };

  const handleDeleteWater = (id: string) => {
    Alert.alert('Delete Entry', 'Remove this water intake entry?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await trackingApiClient.deleteWaterLog(id);
            const updated = await trackingApiClient.getWaterSummaryForDate(todayIso);
            setWaterSummary(updated);
          } catch (err: any) {
            Alert.alert('Error', err.message || 'Failed to delete water log.');
          }
        },
      },
    ]);
  };

  // ============================================================================
  // HANDLERS: EXERCISE
  // ============================================================================

  const handleOpenExerciseModal = () => {
    setExerciseName('');
    setExerciseCategory(ExerciseCategory.WALKING);
    setExerciseDuration('30');
    setExerciseIntensity(ExerciseIntensity.MODERATE);
    setExerciseDistance('');
    setExerciseCalories('');
    setEstimateCaloriesWithMet(true);
    setExerciseNotes('');
    setExerciseFormError(null);
    setIsExerciseModalVisible(true);
  };

  const handleSaveExercise = async () => {
    if (!exerciseName.trim()) {
      setExerciseFormError('Please enter an activity name.');
      return;
    }

    const duration = parseInt(exerciseDuration.trim(), 10);
    if (isNaN(duration) || duration <= 0 || duration > 1440) {
      setExerciseFormError('Duration must be between 1 and 1,440 minutes.');
      return;
    }

    let parsedDistance: number | undefined = undefined;
    if (exerciseDistance.trim()) {
      const d = parseFloat(exerciseDistance.trim());
      if (isNaN(d) || d < 0 || d > 500) {
        setExerciseFormError('Distance must be a valid number up to 500 km.');
        return;
      }
      parsedDistance = roundTo(d, 2);
    }

    let parsedCalories: number | undefined = undefined;
    if (!estimateCaloriesWithMet && exerciseCalories.trim()) {
      const cal = parseFloat(exerciseCalories.trim());
      if (isNaN(cal) || cal < 0 || cal > 10000) {
        setExerciseFormError('Calories burned must be a positive number up to 10,000 kcal.');
        return;
      }
      parsedCalories = Math.round(cal);
    }

    try {
      setIsSubmittingExercise(true);
      setExerciseFormError(null);
      await trackingApiClient.logExercise({
        name: exerciseName.trim(),
        category: exerciseCategory,
        durationMinutes: duration,
        intensity: exerciseIntensity,
        distanceKm: parsedDistance,
        caloriesBurned: parsedCalories,
        estimateCalories: estimateCaloriesWithMet,
        notes: exerciseNotes.trim() ? exerciseNotes.trim() : undefined,
      });
      setIsExerciseModalVisible(false);
      await loadTrackingData();
    } catch (err: any) {
      setExerciseFormError(err.message || 'Failed to record exercise.');
    } finally {
      setIsSubmittingExercise(false);
    }
  };

  const handleDeleteExercise = (id: string) => {
    Alert.alert('Delete Activity', 'Remove this exercise activity record?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await trackingApiClient.deleteExerciseLog(id);
            await loadTrackingData();
          } catch (err: any) {
            Alert.alert('Error', err.message || 'Failed to delete exercise.');
          }
        },
      },
    ]);
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  if (loading && !progressReport) {
    return (
      <ScreenContainer>
        <LoadingIndicator message="Loading progress and health metrics..." />
      </ScreenContainer>
    );
  }

  if (error && !progressReport) {
    return (
      <ScreenContainer>
        <ErrorState title="Could Not Load Progress" message={error} onRetry={loadTrackingData} />
      </ScreenContainer>
    );
  }

  const weightData = progressReport?.weight;
  const waterData = waterSummary;
  const exerciseData = progressReport?.exercise;

  return (
    <ScreenContainer scrollable>
      {/* HEADER */}
      <View style={{ marginBottom: spacing.md }}>
        <Text style={[typography.titleLarge, { color: colors.textPrimary }]}>
          Progress & Activity
        </Text>
        <Text
          style={[typography.bodyMedium, { color: colors.textSecondary, marginTop: spacing.xxs }]}
        >
          Weight trends, hydration targets, and physical activity.
        </Text>
      </View>

      {/* TIMEFRAME RANGE SELECTOR */}
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
        accessible
        accessibilityRole="tablist"
      >
        {(['7D', '30D', '90D', '1Y'] as RangeOption[]).map(range => {
          const isSelected = activeRange === range;
          return (
            <Pressable
              key={range}
              onPress={() => setActiveRange(range)}
              accessibilityRole="tab"
              accessibilityLabel={`Range ${range}`}
              accessibilityState={{ selected: isSelected }}
              style={[
                styles.rangeTab,
                {
                  backgroundColor: isSelected ? colors.primary : 'transparent',
                  borderRadius: radii.sm,
                },
              ]}
            >
              <Text
                style={[
                  typography.labelMedium,
                  { color: isSelected ? colors.textInverse : colors.textSecondary },
                ]}
              >
                {range}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* ==================================================================== */}
      {/* SECTION 1: WEIGHT TRACKING                                          */}
      {/* ==================================================================== */}
      <Card style={{ marginBottom: spacing.lg }}>
        <View style={styles.cardHeaderRow}>
          <View style={styles.rowCentered}>
            <Scale size={20} color={colors.textPrimary} />
            <Text
              style={[typography.titleSmall, { color: colors.textPrimary, marginLeft: spacing.xs }]}
            >
              Body Weight
            </Text>
          </View>
          <View style={styles.rowCentered}>
            {/* Unit Toggle */}
            <Pressable
              onPress={() => setWeightUnit(weightUnit === 'kg' ? 'lbs' : 'kg')}
              accessibilityRole="button"
              accessibilityLabel={`Switch weight unit to ${weightUnit === 'kg' ? 'lbs' : 'kg'}`}
              style={[
                styles.unitBadge,
                {
                  backgroundColor: colors.surfaceMuted,
                  borderRadius: radii.sm,
                  marginRight: spacing.xs,
                },
              ]}
            >
              <Text style={[typography.labelSmall, { color: colors.textPrimary }]}>
                {weightUnit.toUpperCase()}
              </Text>
            </Pressable>
            <Button
              title="Log Weight"
              variant="outline"
              size="sm"
              onPress={handleOpenWeightModal}
            />
          </View>
        </View>

        {/* Current Weight & Stats Grid */}
        <View style={[styles.statsGrid, { marginVertical: spacing.md }]}>
          <View style={styles.statColumn}>
            <Text style={[typography.labelSmall, { color: colors.textSecondary }]}>CURRENT</Text>
            <Text
              style={[
                typography.numericLarge,
                { color: colors.textPrimary, marginTop: spacing.xxs },
              ]}
            >
              {displayWeight(weightData?.currentWeightKg)}
            </Text>
          </View>

          <View style={styles.statColumn}>
            <Text style={[typography.labelSmall, { color: colors.textSecondary }]}>NET CHANGE</Text>
            <View style={[styles.rowCentered, { marginTop: spacing.xxs }]}>
              {weightData?.trend === 'LOSING' ? (
                <TrendingDown size={16} color={colors.primary} />
              ) : weightData?.trend === 'GAINING' ? (
                <TrendingUp size={16} color={colors.textSecondary} />
              ) : (
                <Minus size={16} color={colors.textSecondary} />
              )}
              <Text
                style={[
                  typography.titleMedium,
                  {
                    color: colors.textPrimary,
                    marginLeft: spacing.xxs,
                  },
                ]}
              >
                {weightData?.netChangeKg !== null && weightData?.netChangeKg !== undefined
                  ? `${weightData.netChangeKg > 0 ? '+' : ''}${
                      weightUnit === 'lbs'
                        ? roundTo(weightData.netChangeKg * 2.20462, 1)
                        : weightData.netChangeKg
                    } ${weightUnit}`
                  : '0.0'}
              </Text>
            </View>
          </View>

          <View style={styles.statColumn}>
            <Text style={[typography.labelSmall, { color: colors.textSecondary }]}>GOAL</Text>
            <Text
              style={[
                typography.titleMedium,
                { color: colors.textPrimary, marginTop: spacing.xxs },
              ]}
            >
              {displayWeight(weightData?.targetWeightKg)}
            </Text>
          </View>
        </View>

        {/* Trend Bar Visualization */}
        {weightData?.history && weightData.history.length > 0 ? (
          <View style={{ marginTop: spacing.xs, marginBottom: spacing.md }}>
            <Text
              style={[
                typography.labelSmall,
                { color: colors.textSecondary, marginBottom: spacing.xs },
              ]}
            >
              HISTORICAL READINGS ({weightData.history.length})
            </Text>
            <View
              style={[
                styles.chartContainer,
                {
                  backgroundColor: colors.surfaceMuted,
                  borderRadius: radii.md,
                  padding: spacing.sm,
                },
              ]}
            >
              {weightData.history
                .slice(0, 10)
                .reverse()
                .map((entry, idx) => {
                  const min = weightData.minWeightKg ?? 50;
                  const max = weightData.maxWeightKg ?? 100;
                  const rangeDiff = max - min || 1;
                  const normalizedHeight = Math.max(
                    20,
                    Math.min(80, ((entry.weightKg - min) / rangeDiff) * 60 + 20),
                  );

                  return (
                    <View key={entry.id || idx} style={styles.chartBarWrapper}>
                      <Text
                        style={[
                          typography.labelSmall,
                          { fontSize: 9, color: colors.textSecondary, marginBottom: 2 },
                        ]}
                      >
                        {roundTo(
                          weightUnit === 'lbs' ? kgToLbs(entry.weightKg) : entry.weightKg,
                          1,
                        )}
                      </Text>
                      <View
                        style={[
                          styles.chartBar,
                          {
                            height: normalizedHeight,
                            backgroundColor:
                              idx === (weightData.history?.length ?? 1) - 1
                                ? colors.primary
                                : colors.textTertiary,
                            borderRadius: radii.xs,
                          },
                        ]}
                      />
                      <Text
                        style={[
                          typography.labelSmall,
                          { fontSize: 9, color: colors.textTertiary, marginTop: 4 },
                        ]}
                      >
                        {entry.loggedAt ? entry.loggedAt.substring(5, 10) : ''}
                      </Text>
                    </View>
                  );
                })}
            </View>
          </View>
        ) : (
          <View
            style={[
              styles.emptyBox,
              { borderColor: colors.border, padding: spacing.md, borderRadius: radii.md },
            ]}
          >
            <Text
              style={[typography.bodySmall, { color: colors.textSecondary, textAlign: 'center' }]}
            >
              No weight measurements recorded in this timeframe. Tap &quot;Log Weight&quot; to begin
              tracking trends.
            </Text>
          </View>
        )}

        {/* Recent Weight Entries with delete action */}
        {weightData?.history && weightData.history.length > 0 && (
          <View style={{ marginTop: spacing.xs }}>
            <Text
              style={[
                typography.labelSmall,
                { color: colors.textSecondary, marginBottom: spacing.xxs },
              ]}
            >
              RECENT MEASUREMENTS
            </Text>
            {weightData.history.slice(0, 5).map(item => (
              <View
                key={item.id}
                style={[
                  styles.entryRow,
                  { borderBottomColor: colors.border, paddingVertical: spacing.xs },
                ]}
              >
                <View>
                  <Text
                    style={[
                      typography.bodyMedium,
                      { color: colors.textPrimary, fontWeight: '600' },
                    ]}
                  >
                    {displayWeight(item.weightKg)}
                  </Text>
                  <Text style={[typography.labelSmall, { color: colors.textTertiary }]}>
                    {item.loggedAt ? new Date(item.loggedAt).toLocaleDateString() : ''}
                    {item.notes ? ` • ${item.notes}` : ''}
                  </Text>
                </View>
                <IconButton
                  icon={<Trash2 size={16} color={colors.textPrimary} />}
                  accessibilityLabel="Delete weight entry"
                  onPress={() => handleDeleteWeight(item.id)}
                  variant="ghost"
                  size="sm"
                />
              </View>
            ))}
          </View>
        )}
      </Card>

      {/* ==================================================================== */}
      {/* SECTION 2: WATER TRACKING                                           */}
      {/* ==================================================================== */}
      <Card style={{ marginBottom: spacing.lg }}>
        <View style={styles.cardHeaderRow}>
          <View style={styles.rowCentered}>
            <Droplets size={20} color={colors.textPrimary} />
            <Text
              style={[typography.titleSmall, { color: colors.textPrimary, marginLeft: spacing.xs }]}
            >
              Hydration (Today)
            </Text>
          </View>
          <View style={styles.rowCentered}>
            {/* Unit Toggle */}
            <Pressable
              onPress={() => {
                const nextUnit: WaterUnit =
                  waterUnit === 'ml' ? 'L' : waterUnit === 'L' ? 'fl oz' : 'ml';
                setWaterUnit(nextUnit);
              }}
              accessibilityRole="button"
              accessibilityLabel={`Switch water unit to ${waterUnit === 'ml' ? 'L' : waterUnit === 'L' ? 'fl oz' : 'ml'}`}
              style={[
                styles.unitBadge,
                {
                  backgroundColor: colors.surfaceMuted,
                  borderRadius: radii.sm,
                  marginRight: spacing.xs,
                },
              ]}
            >
              <Text style={[typography.labelSmall, { color: colors.textPrimary }]}>
                {waterUnit.toUpperCase()}
              </Text>
            </Pressable>
            <Button title="+ Add" variant="outline" size="sm" onPress={handleOpenWaterModal} />
          </View>
        </View>

        {/* Water Progress Bar */}
        <View style={{ marginVertical: spacing.md }}>
          <View style={[styles.cardHeaderRow, { marginBottom: spacing.xs }]}>
            <Text style={[typography.numericMedium, { color: colors.textPrimary }]}>
              {displayWater(waterData?.totalMl ?? 0)}
            </Text>
            <Text style={[typography.bodyMedium, { color: colors.textSecondary }]}>
              Goal: {displayWater(waterData?.targetMl ?? 2500)} ({waterData?.percentage ?? 0}%)
            </Text>
          </View>

          <ProgressIndicator
            current={waterData?.totalMl ?? 0}
            target={waterData?.targetMl ?? 2500}
            unit={waterUnit}
            showValues={false}
            height={10}
          />
        </View>

        {/* Quick Add Water Buttons */}
        <View style={styles.quickAddRow}>
          {[250, 500, 750].map(amount => (
            <Pressable
              key={amount}
              onPress={() => handleQuickAddWater(amount)}
              accessibilityRole="button"
              accessibilityLabel={`Quick add ${amount} ml of water`}
              style={[
                styles.quickAddBtn,
                {
                  backgroundColor: colors.surfaceMuted,
                  borderColor: colors.border,
                  borderRadius: radii.sm,
                  paddingVertical: spacing.xs,
                  paddingHorizontal: spacing.sm,
                },
              ]}
            >
              <Plus size={14} color={colors.textPrimary} />
              <Text
                style={[
                  typography.labelMedium,
                  { color: colors.textPrimary, marginLeft: spacing.xxs },
                ]}
              >
                {waterUnit === 'L'
                  ? `${amount / 1000} L`
                  : waterUnit === 'fl oz'
                    ? `${roundTo(amount * 0.0338, 0)} oz`
                    : `${amount} ml`}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Today's Water Entries */}
        {waterData?.entries && waterData.entries.length > 0 && (
          <View style={{ marginTop: spacing.md }}>
            <Text
              style={[
                typography.labelSmall,
                { color: colors.textSecondary, marginBottom: spacing.xxs },
              ]}
            >
              TODAY&apos;S LOGS ({waterData.entries.length})
            </Text>
            {waterData.entries.slice(0, 4).map(w => (
              <View
                key={w.id}
                style={[
                  styles.entryRow,
                  { borderBottomColor: colors.border, paddingVertical: spacing.xs },
                ]}
              >
                <View>
                  <Text
                    style={[
                      typography.bodyMedium,
                      { color: colors.textPrimary, fontWeight: '600' },
                    ]}
                  >
                    {displayWater(w.amountMl)}
                  </Text>
                  <Text style={[typography.labelSmall, { color: colors.textTertiary }]}>
                    {w.loggedAt
                      ? new Date(w.loggedAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : ''}
                    {w.source ? ` • ${w.source}` : ''}
                  </Text>
                </View>
                <IconButton
                  icon={<Trash2 size={16} color={colors.textPrimary} />}
                  accessibilityLabel="Delete water log entry"
                  onPress={() => handleDeleteWater(w.id)}
                  variant="ghost"
                  size="sm"
                />
              </View>
            ))}
          </View>
        )}
      </Card>

      {/* ==================================================================== */}
      {/* SECTION 3: EXERCISE & PHYSICAL ACTIVITY                              */}
      {/* ==================================================================== */}
      <Card style={{ marginBottom: spacing.lg }}>
        <View style={styles.cardHeaderRow}>
          <View style={styles.rowCentered}>
            <Dumbbell size={20} color={colors.textPrimary} />
            <Text
              style={[typography.titleSmall, { color: colors.textPrimary, marginLeft: spacing.xs }]}
            >
              Physical Activity
            </Text>
          </View>
          <Button
            title="+ Log Activity"
            variant="outline"
            size="sm"
            onPress={handleOpenExerciseModal}
          />
        </View>

        {/* Exercise Stats Summary */}
        <View style={[styles.statsGrid, { marginVertical: spacing.md }]}>
          <View style={styles.statColumn}>
            <Text style={[typography.labelSmall, { color: colors.textSecondary }]}>SESSIONS</Text>
            <Text
              style={[
                typography.numericLarge,
                { color: colors.textPrimary, marginTop: spacing.xxs },
              ]}
            >
              {exerciseData?.totalSessions ?? 0}
            </Text>
          </View>

          <View style={styles.statColumn}>
            <Text style={[typography.labelSmall, { color: colors.textSecondary }]}>TOTAL TIME</Text>
            <Text
              style={[
                typography.numericLarge,
                { color: colors.textPrimary, marginTop: spacing.xxs },
              ]}
            >
              {exerciseData?.totalDurationMinutes ?? 0}m
            </Text>
          </View>

          <View style={styles.statColumn}>
            <Text style={[typography.labelSmall, { color: colors.textSecondary }]}>
              EST. BURNED
            </Text>
            <View style={[styles.rowCentered, { marginTop: spacing.xxs }]}>
              <Flame size={18} color={colors.textPrimary} />
              <Text
                style={[
                  typography.numericLarge,
                  { color: colors.textPrimary, marginLeft: spacing.xxs },
                ]}
              >
                {exerciseData?.totalCaloriesBurned ?? 0}
              </Text>
            </View>
            <Text style={[typography.labelSmall, { fontSize: 9, color: colors.textTertiary }]}>
              *Not added to diet budget
            </Text>
          </View>
        </View>

        {/* Recent Activities List */}
        {recentExercises.length > 0 ? (
          <View style={{ marginTop: spacing.xs }}>
            <Text
              style={[
                typography.labelSmall,
                { color: colors.textSecondary, marginBottom: spacing.xs },
              ]}
            >
              RECENT ACTIVITIES
            </Text>
            {recentExercises.slice(0, 5).map(ex => (
              <View
                key={ex.id}
                style={[
                  styles.entryRow,
                  { borderBottomColor: colors.border, paddingVertical: spacing.xs },
                ]}
              >
                <View style={{ flex: 1 }}>
                  <Text
                    style={[
                      typography.bodyMedium,
                      { color: colors.textPrimary, fontWeight: '600' },
                    ]}
                  >
                    {ex.name}
                  </Text>
                  <Text
                    style={[typography.labelSmall, { color: colors.textSecondary, marginTop: 2 }]}
                  >
                    {ex.category.replace('_', ' ')} • {ex.durationMinutes} min • {ex.intensity}
                    {ex.distanceKm ? ` • ${ex.distanceKm} km` : ''}
                  </Text>
                  {ex.caloriesBurned ? (
                    <Text
                      style={[typography.labelSmall, { color: colors.textSecondary, marginTop: 2 }]}
                    >
                      🔥 {ex.caloriesBurned} kcal (Est.)
                    </Text>
                  ) : null}
                </View>
                <IconButton
                  icon={<Trash2 size={16} color={colors.textPrimary} />}
                  accessibilityLabel="Delete exercise activity"
                  onPress={() => handleDeleteExercise(ex.id)}
                  variant="ghost"
                  size="sm"
                />
              </View>
            ))}
          </View>
        ) : (
          <View
            style={[
              styles.emptyBox,
              { borderColor: colors.border, padding: spacing.md, borderRadius: radii.md },
            ]}
          >
            <Text
              style={[typography.bodySmall, { color: colors.textSecondary, textAlign: 'center' }]}
            >
              No workouts logged recently. Tap &quot;+ Log Activity&quot; to track walks, runs, gym,
              or yoga sessions.
            </Text>
          </View>
        )}
      </Card>

      {/* ==================================================================== */}
      {/* SECTION 4: EDUCATIONAL DISCLAIMERS & NOTES                           */}
      {/* ==================================================================== */}
      <View
        style={[
          styles.disclaimerCard,
          {
            backgroundColor: colors.surfaceMuted,
            borderColor: colors.border,
            borderRadius: radii.md,
            padding: spacing.md,
            marginBottom: spacing.xl,
          },
        ]}
      >
        <View style={styles.rowCentered}>
          <Info size={18} color={colors.textSecondary} />
          <Text
            style={[typography.labelMedium, { color: colors.textPrimary, marginLeft: spacing.xs }]}
          >
            Tracking Science & Non-Medical Notice
          </Text>
        </View>
        <Text
          style={[
            typography.bodySmall,
            { color: colors.textSecondary, marginTop: spacing.xs, lineHeight: 18 },
          ]}
        >
          • Day-to-day weight fluctuations of ±0.5–1.5 kg are common due to water retention,
          hydration levels, sodium intake, and glycogen replenishment.
        </Text>
        <Text
          style={[
            typography.bodySmall,
            { color: colors.textSecondary, marginTop: spacing.xxs, lineHeight: 18 },
          ]}
        >
          • Exercise calorie estimates use standard Compendium MET equations and are not added back
          to your food calories to keep energy deficit predictable.
        </Text>
        <Text
          style={[
            typography.bodySmall,
            { color: colors.textSecondary, marginTop: spacing.xxs, lineHeight: 18 },
          ]}
        >
          • Water targets and fitness suggestions are general lifestyle guides and do not substitute
          clinical medical counsel.
        </Text>
      </View>

      {/* ==================================================================== */}
      {/* MODAL: LOG WEIGHT                                                   */}
      {/* ==================================================================== */}
      <Modal visible={isWeightModalVisible} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View
            style={[
              styles.modalContent,
              { backgroundColor: colors.surface, borderRadius: radii.lg, padding: spacing.lg },
            ]}
          >
            <View style={styles.modalHeader}>
              <Text style={[typography.titleMedium, { color: colors.textPrimary }]}>
                Record Body Weight
              </Text>
              <IconButton
                icon={<X size={20} color={colors.textSecondary} />}
                onPress={() => setIsWeightModalVisible(false)}
                accessibilityLabel="Close modal"
                variant="ghost"
              />
            </View>

            {weightFormError && (
              <View
                style={[
                  styles.errorBox,
                  {
                    backgroundColor: colors.errorBackground,
                    borderRadius: radii.sm,
                    padding: spacing.xs,
                    marginBottom: spacing.sm,
                  },
                ]}
              >
                <Text style={[typography.bodySmall, { color: colors.error }]}>
                  {weightFormError}
                </Text>
              </View>
            )}

            <TextInput
              label={`Weight (${weightUnit})`}
              value={weightInput}
              onChangeText={setWeightInput}
              placeholder={weightUnit === 'lbs' ? 'e.g. 175.5' : 'e.g. 79.5'}
              keyboardType="decimal-pad"
              autoFocus
            />

            <TextInput
              label="Notes (Optional)"
              value={weightNotes}
              onChangeText={setWeightNotes}
              placeholder="e.g. Morning weigh-in before breakfast"
              maxLength={255}
              containerStyle={{ marginTop: spacing.sm }}
            />

            <View style={[styles.modalActions, { marginTop: spacing.md }]}>
              <Button
                title="Cancel"
                variant="ghost"
                onPress={() => setIsWeightModalVisible(false)}
                style={{ flex: 1, marginRight: spacing.xs }}
              />
              <Button
                title={isSubmittingWeight ? 'Saving...' : 'Save Reading'}
                variant="primary"
                onPress={handleSaveWeight}
                disabled={isSubmittingWeight}
                style={{ flex: 1, marginLeft: spacing.xs }}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* ==================================================================== */}
      {/* MODAL: LOG WATER                                                    */}
      {/* ==================================================================== */}
      <Modal visible={isWaterModalVisible} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View
            style={[
              styles.modalContent,
              { backgroundColor: colors.surface, borderRadius: radii.lg, padding: spacing.lg },
            ]}
          >
            <View style={styles.modalHeader}>
              <Text style={[typography.titleMedium, { color: colors.textPrimary }]}>
                Log Water Intake
              </Text>
              <IconButton
                icon={<X size={20} color={colors.textSecondary} />}
                onPress={() => setIsWaterModalVisible(false)}
                accessibilityLabel="Close modal"
                variant="ghost"
              />
            </View>

            {waterFormError && (
              <View
                style={[
                  styles.errorBox,
                  {
                    backgroundColor: colors.errorBackground,
                    borderRadius: radii.sm,
                    padding: spacing.xs,
                    marginBottom: spacing.sm,
                  },
                ]}
              >
                <Text style={[typography.bodySmall, { color: colors.error }]}>
                  {waterFormError}
                </Text>
              </View>
            )}

            <View style={styles.rowCentered}>
              <View style={{ flex: 1 }}>
                <TextInput
                  label="Amount"
                  value={waterAmountInput}
                  onChangeText={setWaterAmountInput}
                  placeholder={waterFormUnit === 'L' ? 'e.g. 0.5' : 'e.g. 350'}
                  keyboardType="decimal-pad"
                  autoFocus
                />
              </View>
              {/* Unit selection tabs */}
              <View style={[styles.unitSelectorInline, { marginLeft: spacing.sm }]}>
                {(['ml', 'L', 'fl oz'] as WaterUnit[]).map(u => (
                  <Pressable
                    key={u}
                    onPress={() => setWaterFormUnit(u)}
                    style={[
                      styles.unitChoiceBtn,
                      {
                        backgroundColor: waterFormUnit === u ? colors.primary : colors.surfaceMuted,
                        borderRadius: radii.xs,
                        paddingVertical: 6,
                        paddingHorizontal: 10,
                        marginVertical: 2,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        typography.labelSmall,
                        { color: waterFormUnit === u ? colors.textInverse : colors.textSecondary },
                      ]}
                    >
                      {u}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={[styles.modalActions, { marginTop: spacing.md }]}>
              <Button
                title="Cancel"
                variant="ghost"
                onPress={() => setIsWaterModalVisible(false)}
                style={{ flex: 1, marginRight: spacing.xs }}
              />
              <Button
                title={isSubmittingWater ? 'Saving...' : 'Add Intake'}
                variant="primary"
                onPress={handleSaveWater}
                disabled={isSubmittingWater}
                style={{ flex: 1, marginLeft: spacing.xs }}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* ==================================================================== */}
      {/* MODAL: LOG EXERCISE                                                 */}
      {/* ==================================================================== */}
      <Modal visible={isExerciseModalVisible} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View
            style={[
              styles.modalContent,
              {
                backgroundColor: colors.surface,
                borderRadius: radii.lg,
                padding: spacing.lg,
                maxHeight: '90%',
              },
            ]}
          >
            <View style={styles.modalHeader}>
              <Text style={[typography.titleMedium, { color: colors.textPrimary }]}>
                Log Physical Activity
              </Text>
              <IconButton
                icon={<X size={20} color={colors.textSecondary} />}
                onPress={() => setIsExerciseModalVisible(false)}
                accessibilityLabel="Close modal"
                variant="ghost"
              />
            </View>

            {exerciseFormError && (
              <View
                style={[
                  styles.errorBox,
                  {
                    backgroundColor: colors.errorBackground,
                    borderRadius: radii.sm,
                    padding: spacing.xs,
                    marginBottom: spacing.sm,
                  },
                ]}
              >
                <Text style={[typography.bodySmall, { color: colors.error }]}>
                  {exerciseFormError}
                </Text>
              </View>
            )}

            <TextInput
              label="Activity Name"
              value={exerciseName}
              onChangeText={setExerciseName}
              placeholder="e.g. Brisk Morning Walk, Bench Press"
              maxLength={100}
            />

            {/* Category selection */}
            <Text
              style={[
                typography.labelSmall,
                { color: colors.textSecondary, marginTop: spacing.sm, marginBottom: spacing.xxs },
              ]}
            >
              CATEGORY
            </Text>
            <View style={styles.categoryWrap}>
              {[
                ExerciseCategory.WALKING,
                ExerciseCategory.RUNNING,
                ExerciseCategory.CYCLING,
                ExerciseCategory.SWIMMING,
                ExerciseCategory.GYM_WORKOUT,
                ExerciseCategory.STRENGTH_TRAINING,
                ExerciseCategory.YOGA,
                ExerciseCategory.SPORTS,
              ].map(cat => {
                const isSelected = exerciseCategory === cat;
                return (
                  <Pressable
                    key={cat}
                    onPress={() => setExerciseCategory(cat)}
                    style={[
                      styles.categoryPill,
                      {
                        backgroundColor: isSelected ? colors.primary : colors.surfaceMuted,
                        borderRadius: radii.sm,
                        paddingVertical: 6,
                        paddingHorizontal: spacing.sm,
                        marginRight: spacing.xs,
                        marginBottom: spacing.xs,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        typography.labelSmall,
                        { color: isSelected ? colors.textInverse : colors.textSecondary },
                      ]}
                    >
                      {cat.replace('_', ' ')}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Duration and Intensity */}
            <View style={[styles.rowCentered, { marginTop: spacing.xs }]}>
              <View style={{ flex: 1, marginRight: spacing.xs }}>
                <TextInput
                  label="Duration (mins)"
                  value={exerciseDuration}
                  onChangeText={setExerciseDuration}
                  placeholder="30"
                  keyboardType="number-pad"
                />
              </View>
              <View style={{ flex: 1, marginLeft: spacing.xs }}>
                <TextInput
                  label="Distance (km, opt)"
                  value={exerciseDistance}
                  onChangeText={setExerciseDistance}
                  placeholder="e.g. 5.0"
                  keyboardType="decimal-pad"
                />
              </View>
            </View>

            {/* Intensity Selector */}
            <Text
              style={[
                typography.labelSmall,
                { color: colors.textSecondary, marginTop: spacing.sm, marginBottom: spacing.xxs },
              ]}
            >
              INTENSITY
            </Text>
            <View style={styles.rowCentered}>
              {[
                ExerciseIntensity.LIGHT,
                ExerciseIntensity.MODERATE,
                ExerciseIntensity.VIGOROUS,
              ].map(i => {
                const isSelected = exerciseIntensity === i;
                return (
                  <Pressable
                    key={i}
                    onPress={() => setExerciseIntensity(i)}
                    style={[
                      styles.intensityTab,
                      {
                        backgroundColor: isSelected ? colors.primary : colors.surfaceMuted,
                        borderRadius: radii.sm,
                        paddingVertical: 6,
                        flex: 1,
                        marginHorizontal: 3,
                        alignItems: 'center',
                      },
                    ]}
                  >
                    <Text
                      style={[
                        typography.labelSmall,
                        { color: isSelected ? colors.textInverse : colors.textSecondary },
                      ]}
                    >
                      {i}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Auto MET estimate toggle */}
            <Pressable
              onPress={() => setEstimateCaloriesWithMet(!estimateCaloriesWithMet)}
              style={[styles.rowCentered, { marginTop: spacing.sm, paddingVertical: spacing.xxs }]}
            >
              <View
                style={[
                  styles.checkbox,
                  {
                    borderColor: colors.primary,
                    backgroundColor: estimateCaloriesWithMet ? colors.primary : 'transparent',
                    borderRadius: radii.xs,
                  },
                ]}
              >
                {estimateCaloriesWithMet && <Check size={14} color={colors.textInverse} />}
              </View>
              <Text
                style={[
                  typography.bodySmall,
                  { color: colors.textPrimary, marginLeft: spacing.xs },
                ]}
              >
                Auto-estimate calories using Compendium MET formula
              </Text>
            </Pressable>

            {!estimateCaloriesWithMet && (
              <TextInput
                label="Manual Calories Burned (kcal)"
                value={exerciseCalories}
                onChangeText={setExerciseCalories}
                placeholder="e.g. 300"
                keyboardType="number-pad"
                containerStyle={{ marginTop: spacing.xs }}
              />
            )}

            <View style={[styles.modalActions, { marginTop: spacing.md }]}>
              <Button
                title="Cancel"
                variant="ghost"
                onPress={() => setIsExerciseModalVisible(false)}
                style={{ flex: 1, marginRight: spacing.xs }}
              />
              <Button
                title={isSubmittingExercise ? 'Saving...' : 'Save Activity'}
                variant="primary"
                onPress={handleSaveExercise}
                disabled={isSubmittingExercise}
                style={{ flex: 1, marginLeft: spacing.xs }}
              />
            </View>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  rangeToggle: {
    flexDirection: 'row',
  },
  rangeTab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rowCentered: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  unitBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statColumn: {
    flex: 1,
  },
  chartContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 110,
  },
  chartBarWrapper: {
    alignItems: 'center',
    flex: 1,
  },
  chartBar: {
    width: 14,
  },
  entryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  quickAddRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  quickAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    marginHorizontal: 3,
    borderWidth: 1,
  },
  disclaimerCard: {
    borderWidth: 1,
  },
  emptyBox: {
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  errorBox: {
    marginBottom: 8,
  },
  unitSelectorInline: {
    justifyContent: 'center',
  },
  unitChoiceBtn: {
    alignItems: 'center',
  },
  categoryWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  categoryPill: {
    marginVertical: 2,
  },
  intensityTab: {
    paddingVertical: 6,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
