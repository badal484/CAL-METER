import { describe, it, expect } from 'vitest';
import { calculateMacronutrients } from '../src/formulas/macros.js';
import { DomainValidationError } from '../src/errors/index.js';
import { MACRO_PERCENTAGE_TOLERANCE } from '../src/constants/macro-ratios.js';

describe('Macronutrient Calculation', () => {
  it('calculates standard 30/40/30 distribution for 2,000 kcal', () => {
    // 2,000 kcal:
    // Protein (30%): 600 kcal / 4 = 150g
    // Carbs (40%): 800 kcal / 4 = 200g
    // Fat (30%): 600 kcal / 9 = 66.7g
    // Fiber: (2000 / 1000) * 14 = 28g
    const result = calculateMacronutrients({
      dailyCalories: 2000,
      proteinPercentage: 0.3,
      carbsPercentage: 0.4,
      fatPercentage: 0.3,
    });

    expect(result.dailyCalories).toBe(2000);
    expect(result.macroDerivedCalories).toBe(2000);
    expect(result.calorieDelta).toBe(0);
    expect(result.isEnergyConsistent).toBe(true);
    expect(result.proteinGrams).toBe(150);
    expect(result.carbsGrams).toBe(200);
    expect(result.fatGrams).toBe(66.7);
    expect(result.fiberGrams).toBe(28);
    expect(result.proteinCalories).toBe(600);
    expect(result.carbsCalories).toBe(800);
    expect(result.fatCalories).toBe(600);
    expect(result.warnings).toHaveLength(0);
  });

  describe('Fiber Calculation (No Artificial Floor)', () => {
    it('calculates fiber strictly from 14g / 1,000 kcal without an arbitrary 15g minimum', () => {
      // 500 kcal input -> 500 / 1000 * 14 = 7.0g fiber (previously clamped to 15g)
      const lowCalResult = calculateMacronutrients({
        dailyCalories: 500,
        proteinPercentage: 0.3,
        carbsPercentage: 0.4,
        fatPercentage: 0.3,
      });
      expect(lowCalResult.fiberGrams).toBe(7.0);

      // 1,000 kcal input -> 14.0g fiber
      const thousandCalResult = calculateMacronutrients({
        dailyCalories: 1000,
        proteinPercentage: 0.3,
        carbsPercentage: 0.4,
        fatPercentage: 0.3,
      });
      expect(thousandCalResult.fiberGrams).toBe(14.0);

      // 3,500 kcal input -> 3500 / 1000 * 14 = 49.0g fiber
      const highCalResult = calculateMacronutrients({
        dailyCalories: 3500,
        proteinPercentage: 0.3,
        carbsPercentage: 0.4,
        fatPercentage: 0.3,
      });
      expect(highCalResult.fiberGrams).toBe(49.0);
    });

    it('supports custom fiber override when explicitly provided', () => {
      const result = calculateMacronutrients({
        dailyCalories: 2000,
        customFiberGrams: 38.5,
      });
      expect(result.fiberGrams).toBe(38.5);
    });

    it('rejects negative or non-finite custom fiber inputs', () => {
      expect(() =>
        calculateMacronutrients({
          dailyCalories: 2000,
          customFiberGrams: -5,
        }),
      ).toThrow(DomainValidationError);

      expect(() =>
        calculateMacronutrients({
          dailyCalories: 2000,
          customFiberGrams: NaN,
        }),
      ).toThrow(DomainValidationError);
    });
  });

  describe('Macro Percentage Tolerance (0.001 / 0.1%)', () => {
    it('verifies MACRO_PERCENTAGE_TOLERANCE constant is 0.001', () => {
      expect(MACRO_PERCENTAGE_TOLERANCE).toBe(0.001);
    });

    it('accepts percentage splits immediately inside the 0.001 tolerance', () => {
      // Sum = 0.3004 + 0.4005 + 0.3000 = 1.0009 (diff = +0.0009 <= 0.001)
      const justUnderUpper = calculateMacronutrients({
        dailyCalories: 2000,
        proteinPercentage: 0.3004,
        carbsPercentage: 0.4005,
        fatPercentage: 0.3,
      });
      expect(justUnderUpper.dailyCalories).toBe(2000);

      // Sum = 0.2998 + 0.3998 + 0.3000 = 0.9996 (diff = -0.0004 <= 0.001)
      const justOverLower = calculateMacronutrients({
        dailyCalories: 2000,
        proteinPercentage: 0.2998,
        carbsPercentage: 0.3998,
        fatPercentage: 0.3,
      });
      expect(justOverLower.dailyCalories).toBe(2000);
    });

    it('rejects percentage splits immediately outside the 0.001 tolerance', () => {
      // Sum = 0.3005 + 0.4010 + 0.3000 = 1.0015 (diff = +0.0015 > 0.001)
      expect(() =>
        calculateMacronutrients({
          dailyCalories: 2000,
          proteinPercentage: 0.3005,
          carbsPercentage: 0.401,
          fatPercentage: 0.3,
        }),
      ).toThrow(DomainValidationError);

      // Sum = 0.2995 + 0.3990 + 0.3000 = 0.9985 (diff = -0.0015 > 0.001)
      expect(() =>
        calculateMacronutrients({
          dailyCalories: 2000,
          proteinPercentage: 0.2995,
          carbsPercentage: 0.399,
          fatPercentage: 0.3,
        }),
      ).toThrow(DomainValidationError);
    });
  });

  describe('Custom Macro Energy Consistency & Explicit Modeling', () => {
    it('models macroDerivedCalories separately and preserves consistent custom grams', () => {
      // 160g P * 4 = 640 kcal
      // 220g C * 4 = 880 kcal
      // 65g F * 9 = 585 kcal
      // Total macro energy = 2,105 kcal vs dailyCalories = 2,100 kcal (delta: +5 kcal, 0.2%)
      const result = calculateMacronutrients({
        dailyCalories: 2100,
        customProteinGrams: 160,
        customCarbsGrams: 220,
        customFatGrams: 65,
      });

      expect(result.dailyCalories).toBe(2100);
      expect(result.macroDerivedCalories).toBe(2105);
      expect(result.calorieDelta).toBe(5);
      expect(result.calorieVariancePercentage).toBe(0.2);
      expect(result.isEnergyConsistent).toBe(true);
      expect(result.warnings).toHaveLength(0);

      // Verify custom grams are strictly preserved and not silently altered
      expect(result.proteinGrams).toBe(160);
      expect(result.carbsGrams).toBe(220);
      expect(result.fatGrams).toBe(65);
      expect(result.proteinCalories).toBe(640);
      expect(result.carbsCalories).toBe(880);
      expect(result.fatCalories).toBe(585);
    });

    it('flags inconsistent custom macros with explicit warnings without altering values', () => {
      // User sets 2000 kcal target, but specifies custom macros yielding only 490 kcal:
      // 50g P * 4 = 200 kcal
      // 50g C * 4 = 200 kcal
      // 10g F * 9 = 90 kcal
      // Total macro energy = 490 kcal (delta: -1,510 kcal, 75.5% variance)
      const result = calculateMacronutrients({
        dailyCalories: 2000,
        customProteinGrams: 50,
        customCarbsGrams: 50,
        customFatGrams: 10,
      });

      expect(result.dailyCalories).toBe(2000);
      expect(result.macroDerivedCalories).toBe(490);
      expect(result.calorieDelta).toBe(-1510);
      expect(result.calorieVariancePercentage).toBe(75.5);
      expect(result.isEnergyConsistent).toBe(false);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0]).toContain('deviates from your requested daily target');

      // Crucial: values are not silently mutated
      expect(result.proteinGrams).toBe(50);
      expect(result.carbsGrams).toBe(50);
      expect(result.fatGrams).toBe(10);
    });

    describe('Energy Consistency 5.0% Threshold Precision Boundary Tests', () => {
      // dailyCalories = 3000 kcal. Here 5.0% = 150 kcal (> 100 kcal absolute limit).
      // Case 1: Just below 5.0% threshold (delta = +149 kcal, raw variance = 4.9667%)
      it('treats custom macros just below 5.0% threshold as consistent', () => {
        // P: 200g (800 kcal) + C: 441g (1764 kcal) + F: 65g (585 kcal) = 3,149 kcal
        // Delta = +149 kcal (> 100 kcal), but raw variance = 4.9667% <= 5.0%
        const result = calculateMacronutrients({
          dailyCalories: 3000,
          customProteinGrams: 200,
          customCarbsGrams: 441,
          customFatGrams: 65,
        });

        expect(result.macroDerivedCalories).toBe(3149);
        expect(result.calorieDelta).toBe(149);
        expect(result.isEnergyConsistent).toBe(true);
        expect(result.warnings).toHaveLength(0);
        // Displayed/stored percentage is rounded only after the decision
        expect(result.calorieVariancePercentage).toBe(5.0);
      });

      // Case 2: Just above 5.0% threshold (delta = +151 kcal, raw variance = 5.0333%)
      it('treats custom macros just above 5.0% threshold as inconsistent', () => {
        // P: 200g (800 kcal) + C: 437g (1748 kcal) + F: 67g (603 kcal) = 3,151 kcal
        // Delta = +151 kcal (> 100 kcal) AND raw variance = 5.0333% > 5.0%
        const result = calculateMacronutrients({
          dailyCalories: 3000,
          customProteinGrams: 200,
          customCarbsGrams: 437,
          customFatGrams: 67,
        });

        expect(result.macroDerivedCalories).toBe(3151);
        expect(result.calorieDelta).toBe(151);
        expect(result.isEnergyConsistent).toBe(false);
        expect(result.warnings).toHaveLength(1);
        expect(result.calorieVariancePercentage).toBe(5.0);
      });

      // Case 3: Absolute difference <= 100 kcal remains consistent even if variance > 5%
      it('treats custom macros with absolute difference <= 100 kcal as consistent even if percentage exceeds 5%', () => {
        // dailyCalories = 1000, macros = 1070 kcal (delta = +70 kcal <= 100 kcal, but variance = 7.0%)
        // P: 70g (280 kcal) + C: 120g (480 kcal) + F: 34.444g -> 310 kcal -> total 1070
        // P: 70g (280) + C: 130g (520) + F: 30g (270) = 1070 kcal
        const result = calculateMacronutrients({
          dailyCalories: 1000,
          customProteinGrams: 70,
          customCarbsGrams: 130,
          customFatGrams: 30,
        });

        expect(result.macroDerivedCalories).toBe(1070);
        expect(result.calorieDelta).toBe(70);
        expect(result.isEnergyConsistent).toBe(true);
        expect(result.warnings).toHaveLength(0);
        expect(result.calorieVariancePercentage).toBe(7.0);
      });
    });
  });

  describe('Partial Custom Macro Rejection', () => {
    it('rejects partial custom inputs when only 1 or 2 macro grams are provided', () => {
      expect(() =>
        calculateMacronutrients({
          dailyCalories: 2000,
          customProteinGrams: 150,
          customCarbsGrams: 200,
        }),
      ).toThrow(DomainValidationError);

      expect(() =>
        calculateMacronutrients({
          dailyCalories: 2000,
          customProteinGrams: 150,
        }),
      ).toThrow(DomainValidationError);

      expect(() =>
        calculateMacronutrients({
          dailyCalories: 2000,
          customCarbsGrams: 200,
          customFatGrams: 60,
        }),
      ).toThrow(DomainValidationError);
    });
  });

  describe('Numeric Validation & Error Handling', () => {
    it('rejects individual percentages > 1.0 or < 0.0', () => {
      expect(() =>
        calculateMacronutrients({
          dailyCalories: 2000,
          proteinPercentage: 1.5,
          carbsPercentage: -0.2,
          fatPercentage: -0.3,
        }),
      ).toThrow(DomainValidationError);
    });

    it('rejects non-finite percentage inputs (NaN, Infinity)', () => {
      expect(() =>
        calculateMacronutrients({
          dailyCalories: 2000,
          proteinPercentage: NaN,
          carbsPercentage: 0.5,
          fatPercentage: 0.5,
        }),
      ).toThrow(DomainValidationError);
    });

    it('rejects non-finite, zero, and negative dailyCalories', () => {
      expect(() => calculateMacronutrients({ dailyCalories: 0 })).toThrow(DomainValidationError);
      expect(() => calculateMacronutrients({ dailyCalories: -2000 })).toThrow(
        DomainValidationError,
      );
      expect(() => calculateMacronutrients({ dailyCalories: NaN })).toThrow(DomainValidationError);
      expect(() => calculateMacronutrients({ dailyCalories: Infinity })).toThrow(
        DomainValidationError,
      );
    });

    it('rejects non-finite and negative custom grams', () => {
      expect(() =>
        calculateMacronutrients({
          dailyCalories: 2000,
          customProteinGrams: -10,
          customCarbsGrams: 200,
          customFatGrams: 60,
        }),
      ).toThrow(DomainValidationError);

      expect(() =>
        calculateMacronutrients({
          dailyCalories: 2000,
          customProteinGrams: NaN,
          customCarbsGrams: 200,
          customFatGrams: 60,
        }),
      ).toThrow(DomainValidationError);
    });
  });
});
