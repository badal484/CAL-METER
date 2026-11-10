import { z } from 'zod';
import {
  Gender,
  ActivityLevel,
  PrimaryGoal,
  DietPreference,
  UnitSystem,
  BiologicalSex,
  calculateAgeFromDob,
} from '@calmeter/shared';
import { UuidSchema, IsoDateStringSchema } from './common.contract.js';

export const BiologicalSexSchema = z.nativeEnum(BiologicalSex);
export const GenderSchema = z.nativeEnum(Gender);
export const ActivityLevelSchema = z.nativeEnum(ActivityLevel);
export const PrimaryGoalSchema = z.nativeEnum(PrimaryGoal);
export const DietPreferenceSchema = z.nativeEnum(DietPreference);
export const UnitSystemSchema = z.nativeEnum(UnitSystem);

export const BodyMeasurementsSchema = z.object({
  heightCm: z
    .number()
    .finite()
    .min(100)
    .max(250, { message: 'Height must be between 100 cm and 250 cm.' }),
  currentWeightKg: z
    .number()
    .finite()
    .min(30)
    .max(350, { message: 'Current weight must be between 30 kg and 350 kg.' }),
  targetWeightKg: z
    .number()
    .finite()
    .min(30)
    .max(350, { message: 'Target weight must be between 30 kg and 350 kg.' }),
});

export const BaseOnboardingDataSchema = BodyMeasurementsSchema.extend({
  gender: GenderSchema.default(Gender.PREFER_NOT_TO_SAY),
  biologicalSex: BiologicalSexSchema.optional(),
  dob: IsoDateStringSchema,
  activityLevel: ActivityLevelSchema,
  dietPreference: DietPreferenceSchema.default(DietPreference.ANY),
  primaryGoal: PrimaryGoalSchema,
  paceKgPerWeek: z.number().finite().positive().max(2.0).default(0.5),
  timezone: z.string().min(1).default('Asia/Kolkata'),
  preferredUnits: UnitSystemSchema.default(UnitSystem.METRIC),
});

export const OnboardingDataSchema = BaseOnboardingDataSchema.refine(
  data => {
    try {
      const age = calculateAgeFromDob(data.dob);
      return age >= 0 && age <= 120;
    } catch {
      return false;
    }
  },
  {
    message:
      'Date of birth must correspond to a valid age (0-120 years) and cannot be in the future.',
    path: ['dob'],
  },
);

export const UserProfileSchema = BodyMeasurementsSchema.extend({
  id: UuidSchema,
  userId: UuidSchema,
  gender: GenderSchema,
  biologicalSex: BiologicalSexSchema.optional(),
  dob: IsoDateStringSchema,
  activityLevel: ActivityLevelSchema,
  dietPreference: DietPreferenceSchema,
  primaryGoal: PrimaryGoalSchema,
  paceKgPerWeek: z.number().finite().positive().max(2.0),
  timezone: z.string().min(1),
  preferredUnits: UnitSystemSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const UpdateUserProfileSchema = BaseOnboardingDataSchema.partial();

export type BodyMeasurements = z.infer<typeof BodyMeasurementsSchema>;
export type OnboardingData = z.infer<typeof OnboardingDataSchema>;
export type UserProfile = z.infer<typeof UserProfileSchema>;
export type UpdateUserProfile = z.infer<typeof UpdateUserProfileSchema>;
