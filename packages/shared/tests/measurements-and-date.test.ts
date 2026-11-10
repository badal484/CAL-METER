import { describe, it, expect } from 'vitest';
import {
  kgToLbs,
  lbsToKg,
  cmToInches,
  inchesToCm,
  feetInchesToCm,
  cmToFeetInches,
  mlToFlOz,
  flOzToMl,
  roundTo,
} from '../src/utils/measurements.js';
import {
  formatDateToIso,
  parseIsoDate,
  isValidIsoDate,
  calculateAgeFromDob,
  addDays,
  getDaysDifference,
} from '../src/utils/date.js';
import { DomainValidationError } from '../src/errors/index.js';

describe('Measurement Conversions', () => {
  it('converts kg to lbs and vice versa accurately', () => {
    expect(kgToLbs(70)).toBe(154.32);
    expect(lbsToKg(154.32)).toBe(70);
  });

  it('converts cm to inches and vice versa', () => {
    expect(cmToInches(178)).toBe(70.08);
    expect(inchesToCm(70.08)).toBe(178);
  });

  it('converts feet/inches to cm and back', () => {
    // 5 feet 10 inches = 70 inches * 2.54 = 177.8 cm
    expect(feetInchesToCm(5, 10)).toBe(177.8);
    const converted = cmToFeetInches(177.8);
    expect(converted.feet).toBe(5);
    expect(converted.inches).toBe(10);
  });

  it('converts ml to fl oz and back', () => {
    expect(mlToFlOz(250)).toBe(8.45);
    expect(flOzToMl(8.45)).toBe(249.9);
  });

  it('rounds accurately to specified decimals', () => {
    expect(roundTo(3.14159, 2)).toBe(3.14);
    expect(roundTo(3.14159, 4)).toBe(3.1416);
  });

  it('rejects non-finite inputs with DomainValidationError', () => {
    expect(() => kgToLbs(NaN)).toThrow(DomainValidationError);
    expect(() => kgToLbs(Infinity)).toThrow(DomainValidationError);
    expect(() => lbsToKg(-Infinity)).toThrow(DomainValidationError);
    expect(() => cmToInches(NaN)).toThrow(DomainValidationError);
    expect(() => inchesToCm(Infinity)).toThrow(DomainValidationError);
    expect(() => feetInchesToCm(NaN, 10)).toThrow(DomainValidationError);
    expect(() => feetInchesToCm(5, Infinity)).toThrow(DomainValidationError);
    expect(() => cmToFeetInches(NaN)).toThrow(DomainValidationError);
    expect(() => mlToFlOz(NaN)).toThrow(DomainValidationError);
    expect(() => flOzToMl(Infinity)).toThrow(DomainValidationError);
    expect(() => roundTo(NaN, 2)).toThrow(DomainValidationError);
    expect(() => roundTo(5, NaN)).toThrow(DomainValidationError);
  });

  it('rejects negative values for height measurements', () => {
    expect(() => feetInchesToCm(-5, 10)).toThrow(DomainValidationError);
    expect(() => feetInchesToCm(5, -2)).toThrow(DomainValidationError);
    expect(() => cmToFeetInches(-170)).toThrow(DomainValidationError);
  });
});

describe('Date Utilities', () => {
  it('formats Date to ISO YYYY-MM-DD string in UTC', () => {
    const d = new Date(Date.UTC(2026, 10, 10)); // Nov 10, 2026
    expect(formatDateToIso(d)).toBe('2026-11-10');
  });

  it('parses valid ISO date string correctly', () => {
    const parsed = parseIsoDate('2026-11-10');
    expect(parsed.getUTCFullYear()).toBe(2026);
    expect(parsed.getUTCMonth()).toBe(10); // 0-indexed November
    expect(parsed.getUTCDate()).toBe(10);
  });

  it('validates leap years and non-leap years accurately', () => {
    expect(isValidIsoDate('2024-02-29')).toBe(true); // 2024 is leap year
    expect(isValidIsoDate('2025-02-29')).toBe(false); // 2025 is not leap year
    expect(isValidIsoDate('2000-02-29')).toBe(true); // 2000 is leap year
    expect(isValidIsoDate('1900-02-29')).toBe(false); // 1900 is not leap year
  });

  it('rejects impossible calendar dates', () => {
    expect(isValidIsoDate('2026-02-30')).toBe(false); // Feb 30 does not exist
    expect(isValidIsoDate('2026-04-31')).toBe(false); // April has 30 days
    expect(isValidIsoDate('2026-06-31')).toBe(false); // June has 30 days
    expect(isValidIsoDate('2026-09-31')).toBe(false); // Sept has 30 days
    expect(isValidIsoDate('2026-11-31')).toBe(false); // Nov has 30 days
    expect(isValidIsoDate('2026-13-01')).toBe(false); // Month 13 does not exist
    expect(isValidIsoDate('2026-00-10')).toBe(false); // Month 0 does not exist
    expect(isValidIsoDate('2026-05-00')).toBe(false); // Day 0 does not exist
    expect(isValidIsoDate('2026-05-32')).toBe(false); // Day 32 does not exist
    expect(isValidIsoDate('2026/11/10')).toBe(false); // Slashes
    expect(isValidIsoDate('invalid-date')).toBe(false);
  });

  it('adds days correctly across month boundaries', () => {
    const base = parseIsoDate('2026-10-30');
    const advanced = addDays(base, 5);
    expect(formatDateToIso(advanced)).toBe('2026-11-04');
  });

  it('computes days difference accurately', () => {
    const d1 = parseIsoDate('2026-11-01');
    const d2 = parseIsoDate('2026-11-10');
    expect(getDaysDifference(d1, d2)).toBe(9);
  });

  describe('calculateAgeFromDob', () => {
    const refDate = new Date(Date.UTC(2026, 10, 10)); // Nov 10, 2026

    it('calculates age correctly when birthday has already occurred in the current year', () => {
      // DOB: June 15, 1995 -> 31 years old on Nov 10, 2026
      expect(calculateAgeFromDob('1995-06-15', refDate)).toBe(31);
    });

    it('calculates age correctly when birthday is exactly today', () => {
      // DOB: Nov 10, 1995 -> exactly 31 on Nov 10, 2026
      expect(calculateAgeFromDob('1995-11-10', refDate)).toBe(31);
    });

    it('calculates age correctly when birthday has not yet occurred in the current year', () => {
      // DOB: Dec 25, 1995 -> 30 years old on Nov 10, 2026
      expect(calculateAgeFromDob('1995-12-25', refDate)).toBe(30);
      // DOB: Nov 11, 1995 -> 30 years old on Nov 10, 2026 (tomorrow is birthday)
      expect(calculateAgeFromDob('1995-11-11', refDate)).toBe(30);
    });

    it('calculates age for leap day birthdays', () => {
      // Born Feb 29, 2004
      expect(calculateAgeFromDob('2004-02-29', refDate)).toBe(22);
    });

    it('rejects future date of birth with DomainValidationError', () => {
      expect(() => calculateAgeFromDob('2026-11-11', refDate)).toThrow(DomainValidationError);
      expect(() => calculateAgeFromDob('2030-01-01', refDate)).toThrow(DomainValidationError);
    });

    it('rejects invalid or impossible date strings with DomainValidationError', () => {
      expect(() => calculateAgeFromDob('2026-02-30', refDate)).toThrow(DomainValidationError);
      expect(() => calculateAgeFromDob('not-a-date', refDate)).toThrow(DomainValidationError);
    });
  });
});
