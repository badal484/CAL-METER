/**
 * Pure measurement conversion utilities between Metric and Imperial systems.
 */

export function kgToLbs(kg: number): number {
  return roundTo(kg * 2.2046226218, 2);
}

export function lbsToKg(lbs: number): number {
  return roundTo(lbs / 2.2046226218, 2);
}

export function cmToInches(cm: number): number {
  return roundTo(cm / 2.54, 2);
}

export function inchesToCm(inches: number): number {
  return roundTo(inches * 2.54, 2);
}

export function feetInchesToCm(feet: number, inches: number): number {
  const totalInches = feet * 12 + inches;
  return roundTo(totalInches * 2.54, 2);
}

export function cmToFeetInches(cm: number): { feet: number; inches: number } {
  const totalInches = cm / 2.54;
  const feet = Math.floor(totalInches / 12);
  const inches = roundTo(totalInches % 12, 1);
  return { feet, inches };
}

export function mlToFlOz(ml: number): number {
  return roundTo(ml * 0.033814, 2);
}

export function flOzToMl(flOz: number): number {
  return roundTo(flOz / 0.033814, 2);
}

export function roundTo(value: number, decimals: number = 2): number {
  const factor = Math.pow(10, decimals);
  return Math.round((value + Number.EPSILON) * factor) / factor;
}
