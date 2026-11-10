import { describe, it, expect } from 'vitest';
import { calculateTdee } from '../src/formulas/tdee.js';
import { ActivityLevel } from '../src/constants/enums.js';
import { DomainValidationError } from '../src/errors/index.js';

describe('TDEE Calculation', () => {
  const bmr = 1800;

  it('calculates Sedentary TDEE (1.2x)', () => {
    const result = calculateTdee({ bmr, activityLevel: ActivityLevel.SEDENTARY });
    expect(result.tdee).toBe(2160);
    expect(result.activityMultiplier).toBe(1.2);
  });

  it('calculates Lightly Active TDEE (1.375x)', () => {
    const result = calculateTdee({ bmr, activityLevel: ActivityLevel.LIGHTLY_ACTIVE });
    expect(result.tdee).toBe(2475);
    expect(result.activityMultiplier).toBe(1.375);
  });

  it('calculates Moderately Active TDEE (1.55x)', () => {
    const result = calculateTdee({ bmr, activityLevel: ActivityLevel.MODERATELY_ACTIVE });
    expect(result.tdee).toBe(2790);
    expect(result.activityMultiplier).toBe(1.55);
  });

  it('calculates Very Active TDEE (1.725x)', () => {
    const result = calculateTdee({ bmr, activityLevel: ActivityLevel.VERY_ACTIVE });
    expect(result.tdee).toBe(3105);
    expect(result.activityMultiplier).toBe(1.725);
  });

  it('calculates Extra Active TDEE (1.9x)', () => {
    const result = calculateTdee({ bmr, activityLevel: ActivityLevel.EXTRA_ACTIVE });
    expect(result.tdee).toBe(3420);
    expect(result.activityMultiplier).toBe(1.9);
  });

  it('rejects physiologically implausible, negative, and non-finite BMR values', () => {
    expect(() => calculateTdee({ bmr: 200, activityLevel: ActivityLevel.SEDENTARY })).toThrow(
      DomainValidationError,
    );

    expect(() => calculateTdee({ bmr: 6000, activityLevel: ActivityLevel.SEDENTARY })).toThrow(
      DomainValidationError,
    );

    expect(() => calculateTdee({ bmr: -1500, activityLevel: ActivityLevel.SEDENTARY })).toThrow(
      DomainValidationError,
    );

    expect(() => calculateTdee({ bmr: NaN, activityLevel: ActivityLevel.SEDENTARY })).toThrow(
      DomainValidationError,
    );

    expect(() => calculateTdee({ bmr: Infinity, activityLevel: ActivityLevel.SEDENTARY })).toThrow(
      DomainValidationError,
    );
  });
});
