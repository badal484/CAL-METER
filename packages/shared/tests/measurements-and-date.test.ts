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
  roundTo
} from '../src/utils/measurements.js';
import {
  formatDateToIso,
  parseIsoDate,
  isValidIsoDate,
  addDays,
  getDaysDifference
} from '../src/utils/date.js';

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

  it('rejects invalid date formats or impossible dates', () => {
    expect(isValidIsoDate('2026/11/10')).toBe(false);
    expect(isValidIsoDate('invalid-date')).toBe(false);
    expect(isValidIsoDate('2026-02-30')).toBe(false); // Feb 30 does not exist
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
});

