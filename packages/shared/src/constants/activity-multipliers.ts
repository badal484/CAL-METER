import { ActivityLevel } from './enums.js';

/**
 * Standard Physical Activity Level (PAL) multipliers documented in
 * clinical nutrition literature (FAO/WHO/UNU expert consultations).
 */
export const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  [ActivityLevel.SEDENTARY]: 1.2,
  [ActivityLevel.LIGHTLY_ACTIVE]: 1.375,
  [ActivityLevel.MODERATELY_ACTIVE]: 1.55,
  [ActivityLevel.VERY_ACTIVE]: 1.725,
  [ActivityLevel.EXTRA_ACTIVE]: 1.9,
} as const;
