import { InsightType, InsightCategory } from '../constants/enums.js';
import { roundTo } from '../utils/measurements.js';

export interface UserInsightsContext {
  todayCaloriesConsumed: number;
  dailyCalorieTarget: number;
  todayMacros: {
    protein: number;
    carbs: number;
    fat: number;
    fiber: number;
  };
  macroTargets: {
    protein: number;
    carbs: number;
    fat: number;
    fiber: number;
  };
  todayWaterMl: number;
  dailyWaterTargetMl: number;
  loggedMealsCount: number;
  recentDayCalories?: { date: string; calories: number }[];
  recentWeightsKg?: { date: string; weightKg: number }[];
  targetWeightKg?: number | null;
  recentExerciseSessions?: { date: string; durationMinutes: number; category: string }[];
}

export interface DeterministicInsight {
  type: InsightType;
  category: InsightCategory;
  title: string;
  message: string;
  actionableTip: string;
  periodAnalyzed: string;
  metricData: {
    current: number;
    target: number;
    unit: string;
    percentage: number;
    delta?: number;
  };
}

/**
 * Deterministically analyzes daily calorie progress against target.
 */
export function calculateDailyCalorieInsight(
  consumed: number,
  target: number,
  loggedMealsCount: number,
): DeterministicInsight | null {
  if (target <= 0 || !Number.isFinite(consumed) || !Number.isFinite(target)) {
    return null;
  }

  const percentage = roundTo((consumed / target) * 100, 1);
  const remaining = Math.max(0, target - consumed);

  if (loggedMealsCount === 0 || consumed === 0) {
    return {
      type: InsightType.CALORIE_PROGRESS,
      category: InsightCategory.OBSERVATION,
      title: 'Awaiting Today’s Food Logs',
      message: `You haven’t logged any meals yet today. Your daily target is ${Math.round(target)} kcal.`,
      actionableTip:
        'Log your breakfast or first snack to begin tracking your energy distribution.',
      periodAnalyzed: 'TODAY',
      metricData: {
        current: 0,
        target: Math.round(target),
        unit: 'kcal',
        percentage: 0,
      },
    };
  }

  if (consumed > target * 1.15) {
    const surplus = Math.round(consumed - target);
    return {
      type: InsightType.CALORIE_PROGRESS,
      category: InsightCategory.CAUTION,
      title: 'Calorie Target Exceeded Today',
      message: `You are currently ${surplus} kcal above your daily target (${Math.round(consumed)} of ${Math.round(target)} kcal, ${percentage}%). An occasional surplus is completely normal and best balanced over your 7-day average.`,
      actionableTip:
        'Avoid compensatory starvation tomorrow. Focus on hydration, fiber-rich whole foods, and returning to your baseline deficit.',
      periodAnalyzed: 'TODAY',
      metricData: {
        current: Math.round(consumed),
        target: Math.round(target),
        unit: 'kcal',
        percentage,
        delta: surplus,
      },
    };
  }

  if (percentage >= 85 && percentage <= 110) {
    return {
      type: InsightType.CALORIE_PROGRESS,
      category: InsightCategory.CELEBRATION,
      title: 'Optimal Caloric Balance',
      message: `You have consumed ${Math.round(consumed)} kcal (${percentage}% of your ${Math.round(target)} kcal target), maintaining an ideal energy pacing.`,
      actionableTip:
        'Keep your evening intake light and balanced to conclude the day within your target deficit.',
      periodAnalyzed: 'TODAY',
      metricData: {
        current: Math.round(consumed),
        target: Math.round(target),
        unit: 'kcal',
        percentage,
      },
    };
  }

  return {
    type: InsightType.CALORIE_PROGRESS,
    category: InsightCategory.RECOMMENDATION,
    title: 'Calorie Pacing on Track',
    message: `You have logged ${Math.round(consumed)} kcal so far, with ${Math.round(remaining)} kcal remaining for the rest of today.`,
    actionableTip: `Structure your next meal around your remaining ${Math.round(remaining)} kcal budget to meet your daily target comfortably.`,
    periodAnalyzed: 'TODAY',
    metricData: {
      current: Math.round(consumed),
      target: Math.round(target),
      unit: 'kcal',
      percentage,
      delta: Math.round(remaining),
    },
  };
}

/**
 * Deterministically analyzes protein intake relative to goal.
 */
export function calculateProteinPacingInsight(
  consumedProtein: number,
  targetProtein: number,
  consumedCalories: number,
  dailyCalorieTarget: number,
): DeterministicInsight | null {
  if (targetProtein <= 0 || !Number.isFinite(consumedProtein)) {
    return null;
  }

  const percentage = roundTo((consumedProtein / targetProtein) * 100, 1);
  const remainingProtein = Math.max(0, roundTo(targetProtein - consumedProtein, 1));
  const calorieFraction = dailyCalorieTarget > 0 ? consumedCalories / dailyCalorieTarget : 0;

  if (percentage >= 90) {
    return {
      type: InsightType.PROTEIN_PACING,
      category: InsightCategory.CELEBRATION,
      title: 'Strong Protein Consistency',
      message: `You have hit ${roundTo(consumedProtein, 1)}g of your ${roundTo(targetProtein, 1)}g protein target (${percentage}%). This supports muscle protein synthesis and lean tissue preservation.`,
      actionableTip: 'Great job prioritizing protein density across your meals today.',
      periodAnalyzed: 'TODAY',
      metricData: {
        current: roundTo(consumedProtein, 1),
        target: roundTo(targetProtein, 1),
        unit: 'g',
        percentage,
      },
    };
  }

  // If user has consumed > 65% of calories but < 45% of protein
  if (calorieFraction >= 0.65 && percentage < 50) {
    return {
      type: InsightType.PROTEIN_PACING,
      category: InsightCategory.RECOMMENDATION,
      title: 'Protein Density Opportunity',
      message: `You have utilized ${Math.round(calorieFraction * 100)}% of your calorie allowance but reached only ${percentage}% (${roundTo(consumedProtein, 1)}g) of your protein target.`,
      actionableTip: `Incorporate a lean protein source (e.g. paneer, Greek yogurt, lentils/dal, tofu, eggs, or chicken breast) into your next meal to bridge the remaining ${remainingProtein}g gap.`,
      periodAnalyzed: 'TODAY',
      metricData: {
        current: roundTo(consumedProtein, 1),
        target: roundTo(targetProtein, 1),
        unit: 'g',
        percentage,
        delta: remainingProtein,
      },
    };
  }

  return {
    type: InsightType.PROTEIN_PACING,
    category: InsightCategory.OBSERVATION,
    title: 'Protein Progress',
    message: `You have logged ${roundTo(consumedProtein, 1)}g of protein (${percentage}% of your ${roundTo(targetProtein, 1)}g target).`,
    actionableTip: `Distribute the remaining ${remainingProtein}g across your remaining meals to ensure steady amino acid absorption.`,
    periodAnalyzed: 'TODAY',
    metricData: {
      current: roundTo(consumedProtein, 1),
      target: roundTo(targetProtein, 1),
      unit: 'g',
      percentage,
      delta: remainingProtein,
    },
  };
}

/**
 * Deterministically analyzes dietary fiber intake against reference targets.
 */
export function calculateFiberInsight(
  consumedFiber: number,
  targetFiber: number = 30,
  loggedMealsCount: number,
): DeterministicInsight | null {
  if (loggedMealsCount === 0 || targetFiber <= 0) {
    return null;
  }

  const percentage = roundTo((consumedFiber / targetFiber) * 100, 1);
  const remaining = Math.max(0, roundTo(targetFiber - consumedFiber, 1));

  if (percentage >= 80) {
    return {
      type: InsightType.FIBER_INTAKE,
      category: InsightCategory.CELEBRATION,
      title: 'High Dietary Fiber Adherence',
      message: `You have logged ${roundTo(consumedFiber, 1)}g of dietary fiber (${percentage}% of ${targetFiber}g target). Adequate fiber promotes healthy gut microbiota and satiety.`,
      actionableTip:
        'Keep hydrating adequately to assist optimal digestion with high-fiber intake.',
      periodAnalyzed: 'TODAY',
      metricData: {
        current: roundTo(consumedFiber, 1),
        target: targetFiber,
        unit: 'g',
        percentage,
      },
    };
  }

  if (loggedMealsCount >= 2 && percentage < 40) {
    return {
      type: InsightType.FIBER_INTAKE,
      category: InsightCategory.RECOMMENDATION,
      title: 'Boost Dietary Fiber',
      message: `You have consumed ${roundTo(consumedFiber, 1)}g of fiber across ${loggedMealsCount} meals today (${percentage}% of ${targetFiber}g target).`,
      actionableTip:
        'Add whole grains (oats, brown rice, whole wheat roti), green vegetables, or legumes/chana to increase fiber without excess calories.',
      periodAnalyzed: 'TODAY',
      metricData: {
        current: roundTo(consumedFiber, 1),
        target: targetFiber,
        unit: 'g',
        percentage,
        delta: remaining,
      },
    };
  }

  return null;
}

/**
 * Deterministically analyzes daily hydration progress.
 */
export function calculateHydrationInsight(
  todayWaterMl: number,
  targetWaterMl: number = 2500,
): DeterministicInsight | null {
  if (targetWaterMl <= 0) return null;

  const percentage = roundTo((todayWaterMl / targetWaterMl) * 100, 1);
  const remainingMl = Math.max(0, targetWaterMl - todayWaterMl);

  if (percentage >= 100) {
    return {
      type: InsightType.HYDRATION_CONSISTENCY,
      category: InsightCategory.CELEBRATION,
      title: 'Daily Hydration Target Met',
      message: `You have logged ${todayWaterMl} ml of water today (${percentage}% of ${targetWaterMl} ml goal). Consistent hydration supports metabolic efficiency and cellular recovery.`,
      actionableTip: 'Maintain steady sips throughout the evening as needed.',
      periodAnalyzed: 'TODAY',
      metricData: {
        current: todayWaterMl,
        target: targetWaterMl,
        unit: 'ml',
        percentage,
      },
    };
  }

  if (percentage < 40) {
    return {
      type: InsightType.HYDRATION_CONSISTENCY,
      category: InsightCategory.RECOMMENDATION,
      title: 'Hydration Catch-Up Recommended',
      message: `You have logged ${todayWaterMl} ml of water today (${percentage}% of ${targetWaterMl} ml target), leaving ${remainingMl} ml remaining.`,
      actionableTip:
        'Drink a glass of water (approx. 250 ml) with your next meal or workout session.',
      periodAnalyzed: 'TODAY',
      metricData: {
        current: todayWaterMl,
        target: targetWaterMl,
        unit: 'ml',
        percentage,
        delta: remainingMl,
      },
    };
  }

  return {
    type: InsightType.HYDRATION_CONSISTENCY,
    category: InsightCategory.OBSERVATION,
    title: 'Hydration Progress',
    message: `You have consumed ${todayWaterMl} ml of water (${percentage}% of your ${targetWaterMl} ml baseline).`,
    actionableTip: `Keep a water bottle nearby to complete the remaining ${remainingMl} ml before the end of the day.`,
    periodAnalyzed: 'TODAY',
    metricData: {
      current: todayWaterMl,
      target: targetWaterMl,
      unit: 'ml',
      percentage,
      delta: remainingMl,
    },
  };
}

/**
 * Deterministically analyzes weight history. Strictly requires at least 2 distinct entries.
 */
export function calculateWeightTrajectoryInsight(
  recentWeights: { date: string; weightKg: number }[],
  targetWeightKg?: number | null,
): DeterministicInsight | null {
  if (!recentWeights || recentWeights.length < 2) {
    // Insufficient data to form reliable trends
    return null;
  }

  // Sorted earliest to latest
  const sorted = [...recentWeights].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  );
  const earliest = sorted[0]!;
  const latest = sorted[sorted.length - 1]!;

  const netDeltaKg = roundTo(latest.weightKg - earliest.weightKg, 2);
  const daysSpan = Math.max(
    1,
    Math.round(
      (new Date(latest.date).getTime() - new Date(earliest.date).getTime()) / (1000 * 60 * 60 * 24),
    ),
  );

  let message = `Over the past ${daysSpan} days, your weight has changed by ${netDeltaKg > 0 ? '+' : ''}${netDeltaKg} kg (${earliest.weightKg} kg to ${latest.weightKg} kg).`;

  if (targetWeightKg && Number.isFinite(targetWeightKg)) {
    const distanceToTarget = roundTo(Math.abs(latest.weightKg - targetWeightKg), 1);
    message += ` You are ${distanceToTarget} kg from your target of ${targetWeightKg} kg.`;
  }

  let category = InsightCategory.OBSERVATION;
  let title = 'Weight Trend Analysis';

  if (netDeltaKg < -0.3) {
    category = InsightCategory.CELEBRATION;
    title = 'Progressive Weight Reduction Trend';
  } else if (netDeltaKg > 0.3) {
    category = InsightCategory.OBSERVATION;
    title = 'Upward Weight Variation';
  } else {
    category = InsightCategory.OBSERVATION;
    title = 'Stable Weight Maintenance Trend';
  }

  return {
    type: InsightType.WEIGHT_TRAJECTORY,
    category,
    title,
    message,
    actionableTip:
      'Remember that day-to-day shifts of ±0.5–1.5 kg reflect fluid balance, sodium, and glycogen storage rather than pure body tissue change. Evaluate the moving weekly average.',
    periodAnalyzed: `PAST_${daysSpan}_DAYS`,
    metricData: {
      current: latest.weightKg,
      target: targetWeightKg ?? latest.weightKg,
      unit: 'kg',
      percentage: targetWeightKg ? roundTo((latest.weightKg / targetWeightKg) * 100, 1) : 100,
      delta: netDeltaKg,
    },
  };
}

/**
 * Deterministically analyzes physical exercise frequency and duration.
 */
export function calculateExerciseInsight(
  recentExerciseSessions?: { date: string; durationMinutes: number; category: string }[],
): DeterministicInsight | null {
  if (!recentExerciseSessions || recentExerciseSessions.length === 0) {
    return {
      type: InsightType.EXERCISE_HABIT,
      category: InsightCategory.RECOMMENDATION,
      title: 'Physical Activity Opportunity',
      message: 'No physical workouts or active walks were logged in this period.',
      actionableTip:
        'Aim for a 20-30 minute brisk walk or light stretching session to promote cardiovascular health and insulin sensitivity.',
      periodAnalyzed: 'LAST_7_DAYS',
      metricData: {
        current: 0,
        target: 150, // WHO recommended 150 mins/week moderate activity
        unit: 'mins',
        percentage: 0,
      },
    };
  }

  const totalMinutes = recentExerciseSessions.reduce((acc, s) => acc + s.durationMinutes, 0);
  const sessionCount = recentExerciseSessions.length;
  const targetWeeklyMinutes = 150;
  const percentage = roundTo((totalMinutes / targetWeeklyMinutes) * 100, 1);

  if (totalMinutes >= targetWeeklyMinutes) {
    return {
      type: InsightType.EXERCISE_HABIT,
      category: InsightCategory.CELEBRATION,
      title: 'Weekly Physical Activity Goal Met',
      message: `You completed ${sessionCount} workouts totaling ${totalMinutes} active minutes (${percentage}% of the 150-minute weekly aerobic baseline).`,
      actionableTip:
        'Prioritize adequate post-workout protein intake and 7-8 hours of sleep for optimal recovery.',
      periodAnalyzed: 'LAST_7_DAYS',
      metricData: {
        current: totalMinutes,
        target: targetWeeklyMinutes,
        unit: 'mins',
        percentage,
      },
    };
  }

  return {
    type: InsightType.EXERCISE_HABIT,
    category: InsightCategory.OBSERVATION,
    title: 'Weekly Activity Pacing',
    message: `You have logged ${sessionCount} workouts totaling ${totalMinutes} minutes toward your 150-minute weekly activity baseline.`,
    actionableTip: `A short 30-minute session will bring your weekly total closer to the 150-minute milestone.`,
    periodAnalyzed: 'LAST_7_DAYS',
    metricData: {
      current: totalMinutes,
      target: targetWeeklyMinutes,
      unit: 'mins',
      percentage,
      delta: Math.max(0, targetWeeklyMinutes - totalMinutes),
    },
  };
}

/**
 * Orchestrates the generation of all deterministic nutrition insights.
 */
export function generateDeterministicInsights(
  context: UserInsightsContext,
): DeterministicInsight[] {
  const insights: DeterministicInsight[] = [];

  // 1. Calorie Progress
  const calorieInsight = calculateDailyCalorieInsight(
    context.todayCaloriesConsumed,
    context.dailyCalorieTarget,
    context.loggedMealsCount,
  );
  if (calorieInsight) insights.push(calorieInsight);

  // 2. Protein Pacing
  const proteinInsight = calculateProteinPacingInsight(
    context.todayMacros.protein,
    context.macroTargets.protein,
    context.todayCaloriesConsumed,
    context.dailyCalorieTarget,
  );
  if (proteinInsight) insights.push(proteinInsight);

  // 3. Dietary Fiber
  const fiberInsight = calculateFiberInsight(
    context.todayMacros.fiber,
    context.macroTargets.fiber || 30,
    context.loggedMealsCount,
  );
  if (fiberInsight) insights.push(fiberInsight);

  // 4. Hydration
  const hydrationInsight = calculateHydrationInsight(
    context.todayWaterMl,
    context.dailyWaterTargetMl || 2500,
  );
  if (hydrationInsight) insights.push(hydrationInsight);

  // 5. Weight Trajectory (requires >= 2 points)
  if (context.recentWeightsKg && context.recentWeightsKg.length >= 2) {
    const weightInsight = calculateWeightTrajectoryInsight(
      context.recentWeightsKg,
      context.targetWeightKg,
    );
    if (weightInsight) insights.push(weightInsight);
  }

  // 6. Exercise Activity
  const exerciseInsight = calculateExerciseInsight(context.recentExerciseSessions);
  if (exerciseInsight) insights.push(exerciseInsight);

  // Sort order: Celebration and Cautions first, then Recommendations, then Observations
  const categoryPriority: Record<InsightCategory, number> = {
    [InsightCategory.CELEBRATION]: 1,
    [InsightCategory.CAUTION]: 2,
    [InsightCategory.RECOMMENDATION]: 3,
    [InsightCategory.OBSERVATION]: 4,
  };

  return insights.sort((a, b) => categoryPriority[a.category] - categoryPriority[b.category]);
}
