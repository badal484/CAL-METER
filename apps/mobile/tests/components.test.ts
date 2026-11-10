import { describe, it, expect } from 'vitest';

describe('Component Math & Logic', () => {
  it('correctly clamps progress calculation between 0 and 100', () => {
    const calculateClampedProgress = (value: number, max: number): number => {
      if (max <= 0) return 0;
      const pct = (value / max) * 100;
      return Math.min(100, Math.max(0, pct));
    };

    expect(calculateClampedProgress(0, 100)).toBe(0);
    expect(calculateClampedProgress(50, 100)).toBe(50);
    expect(calculateClampedProgress(150, 100)).toBe(100);
    expect(calculateClampedProgress(-20, 100)).toBe(0);
    expect(calculateClampedProgress(50, 0)).toBe(0);
  });

  it('correctly computes macro distribution percentages', () => {
    const computeMacroPercent = (consumed: number, target: number): number => {
      if (target <= 0) return 0;
      return Math.round((consumed / target) * 100);
    };

    expect(computeMacroPercent(120, 160)).toBe(75);
    expect(computeMacroPercent(200, 220)).toBe(91);
    expect(computeMacroPercent(55, 65)).toBe(85);
    expect(computeMacroPercent(0, 100)).toBe(0);
    expect(computeMacroPercent(100, 0)).toBe(0);
  });

  it('formats remaining calories correctly', () => {
    const formatCalorieBalance = (budget: number, consumed: number) => {
      const remaining = budget - consumed;
      return {
        remaining: Math.max(0, remaining),
        overBudget: remaining < 0,
        difference: Math.abs(remaining),
      };
    };

    expect(formatCalorieBalance(2000, 1500)).toEqual({
      remaining: 500,
      overBudget: false,
      difference: 500,
    });

    expect(formatCalorieBalance(2000, 2200)).toEqual({
      remaining: 0,
      overBudget: true,
      difference: 200,
    });
  });
});
