import { describe, it, expect } from 'vitest';
import {
  calculateExerciseCalories,
  ExerciseCategory,
  ExerciseIntensity,
  CalorieEstimateSource,
  mlToLiters,
  litersToMl,
} from '../src/index.js';

describe('Exercise Calorie & Water Calculations', () => {
  describe('calculateExerciseCalories', () => {
    it('calculates calories burned for moderate running accurately', () => {
      // 70 kg person running moderate (MET 9.8) for 30 minutes
      // 9.8 * 70 * (30 / 60) = 343.0 kcal
      const result = calculateExerciseCalories({
        category: ExerciseCategory.RUNNING,
        durationMinutes: 30,
        weightKg: 70,
        intensity: ExerciseIntensity.MODERATE,
      });

      expect(result.caloriesBurned).toBe(343.0);
      expect(result.metValue).toBe(9.8);
      expect(result.source).toBe(CalorieEstimateSource.MET_FORMULA);
      expect(result.disclaimers.length).toBeGreaterThan(0);
      expect(result.disclaimers.some(d => d.includes('NOT automatically added'))).toBe(true);
    });

    it('calculates calories burned for vigorous strength training', () => {
      // 80 kg person, vigorous strength training (MET 6.0) for 45 minutes
      // 6.0 * 80 * 0.75 = 360.0 kcal
      const result = calculateExerciseCalories({
        category: ExerciseCategory.STRENGTH_TRAINING,
        durationMinutes: 45,
        weightKg: 80,
        intensity: ExerciseIntensity.VIGOROUS,
      });

      expect(result.caloriesBurned).toBe(360.0);
      expect(result.metValue).toBe(6.0);
    });

    it('supports custom MET overrides', () => {
      // 75 kg person with custom MET of 8.5 for 60 minutes
      // 8.5 * 75 * 1.0 = 637.5 kcal
      const result = calculateExerciseCalories({
        category: ExerciseCategory.OTHER,
        durationMinutes: 60,
        weightKg: 75,
        customMet: 8.5,
      });

      expect(result.caloriesBurned).toBe(637.5);
      expect(result.metValue).toBe(8.5);
      expect(result.source).toBe(CalorieEstimateSource.MANUAL_ENTRY);
    });

    it('rejects invalid or non-positive duration', () => {
      expect(() =>
        calculateExerciseCalories({
          category: ExerciseCategory.WALKING,
          durationMinutes: 0,
          weightKg: 70,
        }),
      ).toThrowError(/duration must be a positive number/i);

      expect(() =>
        calculateExerciseCalories({
          category: ExerciseCategory.WALKING,
          durationMinutes: 2000, // exceeds 1440
          weightKg: 70,
        }),
      ).toThrowError(/between 1 and 1,440 minutes/i);
    });

    it('rejects out-of-bounds body weights', () => {
      expect(() =>
        calculateExerciseCalories({
          category: ExerciseCategory.SWIMMING,
          durationMinutes: 45,
          weightKg: 20, // below 30
        }),
      ).toThrowError(/between 30 kg and 350 kg/i);

      expect(() =>
        calculateExerciseCalories({
          category: ExerciseCategory.SWIMMING,
          durationMinutes: 45,
          weightKg: 400, // above 350
        }),
      ).toThrowError(/between 30 kg and 350 kg/i);
    });
  });

  describe('Water volume conversions', () => {
    it('converts milliliters to liters with 3 decimal precision', () => {
      expect(mlToLiters(1500)).toBe(1.5);
      expect(mlToLiters(250)).toBe(0.25);
      expect(mlToLiters(750)).toBe(0.75);
    });

    it('converts liters to milliliters', () => {
      expect(litersToMl(1.5)).toBe(1500);
      expect(litersToMl(2.25)).toBe(2250);
      expect(litersToMl(0.5)).toBe(500);
    });
  });
});
