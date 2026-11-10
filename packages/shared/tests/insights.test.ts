import { describe, it, expect } from 'vitest';
import {
  calculateDailyCalorieInsight,
  calculateProteinPacingInsight,
  calculateFiberInsight,
  calculateHydrationInsight,
  calculateWeightTrajectoryInsight,
  calculateExerciseInsight,
  generateDeterministicInsights,
  InsightType,
  InsightCategory,
  type UserInsightsContext,
} from '../src/index.js';

describe('Deterministic Nutrition Insights Engine', () => {
  describe('calculateDailyCalorieInsight', () => {
    it('returns observation when no meals are logged', () => {
      const insight = calculateDailyCalorieInsight(0, 2000, 0);
      expect(insight).not.toBeNull();
      expect(insight?.category).toBe(InsightCategory.OBSERVATION);
      expect(insight?.type).toBe(InsightType.CALORIE_PROGRESS);
      expect(insight?.message).toContain('haven’t logged any meals yet today');
    });

    it('returns celebration when user is in optimal balance (85-110%)', () => {
      const insight = calculateDailyCalorieInsight(1900, 2000, 3);
      expect(insight).not.toBeNull();
      expect(insight?.category).toBe(InsightCategory.CELEBRATION);
      expect(insight?.metricData.percentage).toBe(95);
    });

    it('returns caution when user exceeds target by > 15%', () => {
      const insight = calculateDailyCalorieInsight(2400, 2000, 4);
      expect(insight).not.toBeNull();
      expect(insight?.category).toBe(InsightCategory.CAUTION);
      expect(insight?.metricData.delta).toBe(400);
      expect(insight?.message).toContain('occasional surplus is completely normal');
    });

    it('returns pacing recommendation when user has budget remaining', () => {
      const insight = calculateDailyCalorieInsight(1200, 2000, 2);
      expect(insight).not.toBeNull();
      expect(insight?.category).toBe(InsightCategory.RECOMMENDATION);
      expect(insight?.metricData.delta).toBe(800);
    });
  });

  describe('calculateProteinPacingInsight', () => {
    it('celebrates when protein target is >= 90% achieved', () => {
      const insight = calculateProteinPacingInsight(140, 150, 1800, 2000);
      expect(insight).not.toBeNull();
      expect(insight?.category).toBe(InsightCategory.CELEBRATION);
      expect(insight?.metricData.percentage).toBeGreaterThanOrEqual(90);
    });

    it('flags protein density opportunity when high calories consumed but low protein', () => {
      // 1600 of 2000 kcal (80%) but only 40g of 150g protein (26.7%)
      const insight = calculateProteinPacingInsight(40, 150, 1600, 2000);
      expect(insight).not.toBeNull();
      expect(insight?.category).toBe(InsightCategory.RECOMMENDATION);
      expect(insight?.title).toBe('Protein Density Opportunity');
      expect(insight?.actionableTip).toContain('Incorporate a lean protein source');
    });
  });

  describe('calculateFiberInsight', () => {
    it('returns null if no meals are logged', () => {
      const insight = calculateFiberInsight(0, 30, 0);
      expect(insight).toBeNull();
    });

    it('celebrates high fiber adherence', () => {
      const insight = calculateFiberInsight(28, 30, 3);
      expect(insight).not.toBeNull();
      expect(insight?.category).toBe(InsightCategory.CELEBRATION);
    });

    it('recommends fiber boost when low after multiple meals', () => {
      const insight = calculateFiberInsight(8, 30, 3);
      expect(insight).not.toBeNull();
      expect(insight?.category).toBe(InsightCategory.RECOMMENDATION);
    });
  });

  describe('calculateHydrationInsight', () => {
    it('celebrates when daily water target is met', () => {
      const insight = calculateHydrationInsight(2600, 2500);
      expect(insight).not.toBeNull();
      expect(insight?.category).toBe(InsightCategory.CELEBRATION);
    });

    it('recommends water catch-up when low intake', () => {
      const insight = calculateHydrationInsight(750, 2500);
      expect(insight).not.toBeNull();
      expect(insight?.category).toBe(InsightCategory.RECOMMENDATION);
      expect(insight?.metricData.delta).toBe(1750);
    });
  });

  describe('calculateWeightTrajectoryInsight', () => {
    it('strictly returns null if less than 2 readings exist (sufficient data requirement)', () => {
      const oneReading = [{ date: '2026-11-10', weightKg: 80.0 }];
      expect(calculateWeightTrajectoryInsight(oneReading, 75.0)).toBeNull();
      expect(calculateWeightTrajectoryInsight([], 75.0)).toBeNull();
    });

    it('analyzes downward weight trajectory with multiple readings', () => {
      const readings = [
        { date: '2026-10-15', weightKg: 82.5 },
        { date: '2026-11-01', weightKg: 81.2 },
        { date: '2026-11-10', weightKg: 80.0 },
      ];
      const insight = calculateWeightTrajectoryInsight(readings, 75.0);
      expect(insight).not.toBeNull();
      expect(insight?.category).toBe(InsightCategory.CELEBRATION);
      expect(insight?.metricData.delta).toBe(-2.5);
      expect(insight?.message).toContain('82.5 kg to 80 kg');
    });
  });

  describe('calculateExerciseInsight', () => {
    it('encourages light activity when no sessions logged in 7 days', () => {
      const insight = calculateExerciseInsight([]);
      expect(insight).not.toBeNull();
      expect(insight?.category).toBe(InsightCategory.RECOMMENDATION);
      expect(insight?.actionableTip).toContain('brisk walk');
    });

    it('celebrates meeting the 150-minute weekly aerobic baseline', () => {
      const sessions = [
        { date: '2026-11-05', durationMinutes: 45, category: 'RUNNING' },
        { date: '2026-11-07', durationMinutes: 60, category: 'CYCLING' },
        { date: '2026-11-09', durationMinutes: 50, category: 'GYM_WORKOUT' },
      ];
      const insight = calculateExerciseInsight(sessions);
      expect(insight).not.toBeNull();
      expect(insight?.category).toBe(InsightCategory.CELEBRATION);
      expect(insight?.metricData.current).toBe(155);
    });
  });

  describe('generateDeterministicInsights orchestrator', () => {
    it('assembles multi-category insights sorted by priority', () => {
      const context: UserInsightsContext = {
        todayCaloriesConsumed: 1850,
        dailyCalorieTarget: 2000,
        todayMacros: { protein: 140, carbs: 190, fat: 55, fiber: 28 },
        macroTargets: { protein: 150, carbs: 220, fat: 65, fiber: 30 },
        todayWaterMl: 2600,
        dailyWaterTargetMl: 2500,
        loggedMealsCount: 3,
        recentWeightsKg: [
          { date: '2026-11-01', weightKg: 82.0 },
          { date: '2026-11-10', weightKg: 80.5 },
        ],
        targetWeightKg: 75.0,
        recentExerciseSessions: [{ date: '2026-11-08', durationMinutes: 40, category: 'RUNNING' }],
      };

      const insights = generateDeterministicInsights(context);
      expect(insights.length).toBeGreaterThanOrEqual(4);
      // First insights should be Celebration
      expect(insights[0]?.category).toBe(InsightCategory.CELEBRATION);
    });
  });
});
