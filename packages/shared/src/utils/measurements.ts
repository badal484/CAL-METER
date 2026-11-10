import { DomainValidationError } from '../errors/index.js';

/**
 * Pure measurement conversion utilities between Metric and Imperial systems.
 * All functions enforce finite numeric validation.
 */

function assertFiniteNumber(value: number, label: string): void {
  if (!Number.isFinite(value)) {
    throw new DomainValidationError(`${label} must be a finite number (received: ${value}).`);
  }
}

export function kgToLbs(kg: number): number {
  assertFiniteNumber(kg, 'Weight in kg');
  return roundTo(kg * 2.2046226218, 2);
}

export function lbsToKg(lbs: number): number {
  assertFiniteNumber(lbs, 'Weight in lbs');
  return roundTo(lbs / 2.2046226218, 2);
}

export function cmToInches(cm: number): number {
  assertFiniteNumber(cm, 'Height in cm');
  return roundTo(cm / 2.54, 2);
}

export function inchesToCm(inches: number): number {
  assertFiniteNumber(inches, 'Height in inches');
  return roundTo(inches * 2.54, 2);
}

export function feetInchesToCm(feet: number, inches: number): number {
  assertFiniteNumber(feet, 'Feet');
  assertFiniteNumber(inches, 'Inches');
  if (feet < 0 || inches < 0) {
    throw new DomainValidationError('Height measurements cannot be negative.');
  }
  const totalInches = feet * 12 + inches;
  return roundTo(totalInches * 2.54, 2);
}

export function cmToFeetInches(cm: number): { feet: number; inches: number } {
  assertFiniteNumber(cm, 'Height in cm');
  if (cm < 0) {
    throw new DomainValidationError('Height in cm cannot be negative.');
  }
  const totalInches = cm / 2.54;
  const feet = Math.floor(totalInches / 12);
  const inches = roundTo(totalInches % 12, 1);
  return { feet, inches };
}

export function mlToFlOz(ml: number): number {
  assertFiniteNumber(ml, 'Volume in ml');
  return roundTo(ml * 0.033814, 2);
}

export function flOzToMl(flOz: number): number {
  assertFiniteNumber(flOz, 'Volume in fl oz');
  return roundTo(flOz / 0.033814, 2);
}

export function roundTo(value: number, decimals: number = 2): number {
  if (!Number.isFinite(value)) {
    throw new DomainValidationError(`Value to round must be a finite number (received: ${value}).`);
  }
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 10) {
    throw new DomainValidationError(
      `Decimals must be an integer between 0 and 10 (received: ${decimals}).`,
    );
  }
  const factor = Math.pow(10, decimals);
  return Math.round((value + Number.EPSILON) * factor) / factor;
}
