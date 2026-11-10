import { DomainValidationError } from '../errors/index.js';

/**
 * Deterministic date, calendar, and age derivation utilities.
 */

export function formatDateToIso(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Parses an ISO date string (YYYY-MM-DD) into a UTC Date object.
 * Strictly validates that the calendar date actually exists (e.g. rejects 2026-02-30, 2026-13-01).
 */
export function parseIsoDate(isoDateString: string): Date {
  const regex = /^(\d{4})-(\d{2})-(\d{2})$/;
  const match = regex.exec(isoDateString);
  if (!match || !match[1] || !match[2] || !match[3]) {
    throw new DomainValidationError(
      `Invalid ISO date format: ${isoDateString}. Expected YYYY-MM-DD.`,
    );
  }

  const year = Number(match[1]);
  const monthNum = Number(match[2]);
  const dayNum = Number(match[3]);

  if (monthNum < 1 || monthNum > 12) {
    throw new DomainValidationError(
      `Invalid calendar month: ${monthNum}. Month must be between 01 and 12.`,
    );
  }

  if (dayNum < 1 || dayNum > 31) {
    throw new DomainValidationError(
      `Invalid calendar day: ${dayNum}. Day must be between 01 and 31.`,
    );
  }

  const parsed = new Date(Date.UTC(year, monthNum - 1, dayNum));

  // Verify that JavaScript Date did not roll over (e.g. Feb 30 -> March 2)
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== monthNum - 1 ||
    parsed.getUTCDate() !== dayNum
  ) {
    throw new DomainValidationError(`Impossible calendar date: ${isoDateString}.`);
  }

  return parsed;
}

export function isValidIsoDate(isoDateString: string): boolean {
  try {
    parseIsoDate(isoDateString);
    return true;
  } catch {
    return false;
  }
}

/**
 * Maximum physiologically supported age in years for nutritional and metabolic calculations.
 * Documented boundary: 120 years (human supercentenarian threshold).
 * Consistent across calculateAgeFromDob, calculateBmr, and OnboardingDataSchema.
 */
export const MAXIMUM_SUPPORTED_AGE_YEARS = 120;

/**
 * Derives age in whole completed years from Date of Birth against a UTC reference date.
 * Does not rely on untrusted client-supplied age values.
 *
 * Age Boundary Policy:
 * - Minimum age: 0 (born on reference date)
 * - Maximum age: 120 years (MAXIMUM_SUPPORTED_AGE_YEARS)
 * - Dates in the future or ages exceeding 120 years throw DomainValidationError.
 */
export function calculateAgeFromDob(dobString: string, referenceDate: Date = new Date()): number {
  const birthDate = parseIsoDate(dobString);

  const refYear = referenceDate.getUTCFullYear();
  const refMonth = referenceDate.getUTCMonth();
  const refDay = referenceDate.getUTCDate();

  const birthYear = birthDate.getUTCFullYear();
  const birthMonth = birthDate.getUTCMonth();
  const birthDay = birthDate.getUTCDate();

  if (birthDate.getTime() > referenceDate.getTime()) {
    throw new DomainValidationError(`Date of birth (${dobString}) cannot be in the future.`);
  }

  let age = refYear - birthYear;
  if (refMonth < birthMonth || (refMonth === birthMonth && refDay < birthDay)) {
    age--;
  }

  if (age < 0 || age > MAXIMUM_SUPPORTED_AGE_YEARS) {
    throw new DomainValidationError(
      `Derived age (${age} years) is outside plausible physiological boundaries (0-${MAXIMUM_SUPPORTED_AGE_YEARS} years).`,
    );
  }

  return age;
}

export function addDays(date: Date, days: number): Date {
  const result = new Date(date.getTime());
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

export function getDaysDifference(dateA: Date, dateB: Date): number {
  const utcA = Date.UTC(dateA.getUTCFullYear(), dateA.getUTCMonth(), dateA.getUTCDate());
  const utcB = Date.UTC(dateB.getUTCFullYear(), dateB.getUTCMonth(), dateB.getUTCDate());
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.round((utcB - utcA) / msPerDay);
}
