import type { PrismaClient } from '@prisma/client';
import { getPrismaClient } from '../lib/prisma.js';
import { NotFoundError, ValidationError } from '../lib/errors.js';
import {
  calculateAgeFromDob,
  calculateBmr,
  calculateTdee,
  calculateCalorieTarget,
  calculateMacronutrients,
  formatDateToIso,
  parseIsoDate,
  BiologicalSex,
  Gender,
  ActivityLevel,
  PrimaryGoal,
  DietPreference,
  UnitSystem,
  GoalStatus,
} from '@calmeter/shared';
import type {
  UserProfileDto,
  UpdateUserProfile,
  OnboardingData,
  NutritionCalculationsDto,
  NutritionGoalDto,
} from '@calmeter/contracts';

export class ProfileService {
  constructor(private prisma: PrismaClient = getPrismaClient()) {}

  private mapProfileToDto(profile: any, userName?: string | null): UserProfileDto {
    return {
      id: profile.id,
      userId: profile.userId,
      name: userName !== undefined ? userName : (profile.user?.name ?? null),
      gender: profile.gender as Gender,
      biologicalSex: (profile.biologicalSex as BiologicalSex) ?? null,
      dob: profile.dob ? formatDateToIso(profile.dob) : null,
      heightCm: Number(profile.heightCm),
      currentWeightKg: Number(profile.currentWeightKg),
      targetWeightKg: Number(profile.targetWeightKg),
      activityLevel: profile.activityLevel as ActivityLevel,
      dietPreference: profile.dietPreference as DietPreference,
      primaryGoal: profile.primaryGoal as PrimaryGoal,
      paceKgPerWeek: Number(profile.paceKgPerWeek),
      timezone: profile.timezone,
      preferredUnits: profile.preferredUnits as UnitSystem,
      createdAt: profile.createdAt.toISOString(),
      updatedAt: profile.updatedAt.toISOString(),
    };
  }

  private mapGoalToDto(goal: any): NutritionGoalDto {
    return {
      id: goal.id,
      userId: goal.userId,
      dailyCalories: goal.dailyCalories,
      proteinGrams: Number(goal.proteinGrams),
      carbsGrams: Number(goal.carbsGrams),
      fatGrams: Number(goal.fatGrams),
      fiberGrams: Number(goal.fiberGrams),
      waterMl: goal.waterMl,
      effectiveDate: formatDateToIso(goal.effectiveDate),
      status: (goal.status as GoalStatus) || GoalStatus.ACTIVE,
      primaryGoal: (goal.primaryGoal as PrimaryGoal) ?? null,
      targetWeightKg: goal.targetWeightKg ? Number(goal.targetWeightKg) : null,
      createdAt: goal.createdAt.toISOString(),
      updatedAt: goal.updatedAt ? goal.updatedAt.toISOString() : undefined,
    };
  }

  /**
   * Retrieves user profile and associated display name.
   */
  async getProfile(userId: string): Promise<UserProfileDto> {
    const profile = await this.prisma.userProfile.findUnique({
      where: { userId },
      include: { user: { select: { name: true } } },
    });

    if (!profile) {
      throw new NotFoundError('User profile not found. Onboarding may be pending.');
    }

    return this.mapProfileToDto(profile);
  }

  /**
   * Partially updates user profile, body stats, and optionally display name.
   * If current weight changes, automatically logs a measurement record in WeightLog.
   */
  async updateProfile(userId: string, data: UpdateUserProfile): Promise<UserProfileDto> {
    const existing = await this.prisma.userProfile.findUnique({
      where: { userId },
      include: { user: { select: { name: true } } },
    });

    if (!existing) {
      throw new NotFoundError('User profile not found.');
    }

    const updated = await this.prisma.$transaction(async tx => {
      // 1. Update user display name if provided
      if (data.name !== undefined) {
        await tx.user.update({
          where: { id: userId },
          data: { name: data.name },
        });
      }

      // 2. Track weight history if currentWeightKg changed
      if (
        data.currentWeightKg !== undefined &&
        Number(existing.currentWeightKg) !== data.currentWeightKg
      ) {
        await tx.weightLog.create({
          data: {
            userId,
            weightKg: data.currentWeightKg,
            notes: 'Profile body measurement update',
          },
        });
      }

      // 3. Update UserProfile
      const profileUpdateData: any = {};
      if (data.gender !== undefined) profileUpdateData.gender = data.gender;
      if (data.biologicalSex !== undefined) profileUpdateData.biologicalSex = data.biologicalSex;
      if (data.dob !== undefined) profileUpdateData.dob = parseIsoDate(data.dob);
      if (data.heightCm !== undefined) profileUpdateData.heightCm = data.heightCm;
      if (data.currentWeightKg !== undefined)
        profileUpdateData.currentWeightKg = data.currentWeightKg;
      if (data.targetWeightKg !== undefined) profileUpdateData.targetWeightKg = data.targetWeightKg;
      if (data.activityLevel !== undefined) profileUpdateData.activityLevel = data.activityLevel;
      if (data.dietPreference !== undefined) profileUpdateData.dietPreference = data.dietPreference;
      if (data.primaryGoal !== undefined) profileUpdateData.primaryGoal = data.primaryGoal;
      if (data.paceKgPerWeek !== undefined) profileUpdateData.paceKgPerWeek = data.paceKgPerWeek;
      if (data.timezone !== undefined) profileUpdateData.timezone = data.timezone;
      if (data.preferredUnits !== undefined) profileUpdateData.preferredUnits = data.preferredUnits;

      const res = await tx.userProfile.update({
        where: { userId },
        data: profileUpdateData,
        include: { user: { select: { name: true } } },
      });

      return res;
    });

    return this.mapProfileToDto(updated);
  }

  /**
   * Idempotently completes the multi-step onboarding process.
   * Validates biometrics, calculates personalized BMR/TDEE/Calories/Macros,
   * creates/updates UserProfile, persists initial NutritionGoal, and logs baseline weight.
   */
  async completeOnboarding(
    userId: string,
    data: OnboardingData,
  ): Promise<{
    profile: UserProfileDto;
    goal: NutritionGoalDto;
    calculations: NutritionCalculationsDto;
  }> {
    // 1. Calculate age from date of birth
    const ageYears = calculateAgeFromDob(data.dob);

    // 2. Calculate BMR via validated Mifflin-St Jeor equation
    const bmrResult = calculateBmr({
      weightKg: data.currentWeightKg,
      heightCm: data.heightCm,
      ageYears,
      biologicalSex: data.biologicalSex,
      gender: data.gender,
    });

    if (bmrResult.status === 'UNSUPPORTED') {
      throw new ValidationError(
        bmrResult.message ||
          'Supplied biometrics are unsupported for energy expenditure calculation.',
      );
    }

    // 3. Calculate TDEE via Physical Activity Level coefficients
    const tdeeResult = calculateTdee({
      bmr: bmrResult.bmr,
      activityLevel: data.activityLevel,
    });

    // 4. Calculate daily calorie target
    const calorieTargetResult = calculateCalorieTarget({
      tdee: tdeeResult.tdee,
      bmr: bmrResult.bmr,
      primaryGoal: data.primaryGoal,
      paceKgPerWeek: data.paceKgPerWeek,
      customCalorieOverride: data.customDailyCalories,
    });

    // 5. Calculate macronutrient targets
    const macroResult = calculateMacronutrients({
      dailyCalories: calorieTargetResult.dailyCalories,
      customProteinGrams: data.customProteinGrams,
      customCarbsGrams: data.customCarbsGrams,
      customFatGrams: data.customFatGrams,
      customFiberGrams: data.customFiberGrams,
    });

    // Aggregate all safety warnings and limitations disclaimers
    const warnings = [
      ...(bmrResult.notes || []),
      ...(calorieTargetResult.warnings || []),
      ...(macroResult.warnings || []),
    ];

    const disclaimers = [
      'BMR and TDEE are mathematical estimates based on population equations, not clinical measurements.',
      'Calorie targets are starting reference baselines; adjust intake every 2-4 weeks based on real-world weight trends.',
      ...(bmrResult.disclaimers || []),
      ...(calorieTargetResult.disclaimers || []),
    ];

    const calculationsDto: NutritionCalculationsDto = {
      bmr: bmrResult.bmr,
      tdee: tdeeResult.tdee,
      dailyCalories: calorieTargetResult.dailyCalories,
      proteinGrams: macroResult.proteinGrams,
      carbsGrams: macroResult.carbsGrams,
      fatGrams: macroResult.fatGrams,
      fiberGrams: macroResult.fiberGrams,
      dailyDeficitOrSurplus: calorieTargetResult.dailyDeficitOrSurplus,
      paceKgPerWeek: calorieTargetResult.paceKgPerWeek,
      isBelowBmr: calorieTargetResult.isBelowBmr,
      warnings,
      disclaimers,
    };

    const targetDate = parseIsoDate(formatDateToIso(new Date()));

    // 6. Execute atomic database persistence
    const { profileRecord, goalRecord } = await this.prisma.$transaction(async tx => {
      // Update user display name if provided
      if (data.name) {
        await tx.user.update({
          where: { id: userId },
          data: { name: data.name },
        });
      }

      // Upsert UserProfile
      const profileRecord = await tx.userProfile.upsert({
        where: { userId },
        create: {
          userId,
          gender: data.gender,
          biologicalSex: data.biologicalSex,
          dob: parseIsoDate(data.dob),
          heightCm: data.heightCm,
          currentWeightKg: data.currentWeightKg,
          targetWeightKg: data.targetWeightKg ?? data.currentWeightKg,
          activityLevel: data.activityLevel,
          dietPreference: data.dietPreference,
          primaryGoal: data.primaryGoal,
          paceKgPerWeek: data.paceKgPerWeek ?? 0.5,
          timezone: data.timezone,
          preferredUnits: data.preferredUnits,
        },
        update: {
          gender: data.gender,
          biologicalSex: data.biologicalSex,
          dob: parseIsoDate(data.dob),
          heightCm: data.heightCm,
          currentWeightKg: data.currentWeightKg,
          targetWeightKg: data.targetWeightKg ?? data.currentWeightKg,
          activityLevel: data.activityLevel,
          dietPreference: data.dietPreference,
          primaryGoal: data.primaryGoal,
          paceKgPerWeek: data.paceKgPerWeek ?? 0.5,
          timezone: data.timezone,
          preferredUnits: data.preferredUnits,
        },
        include: { user: { select: { name: true } } },
      });

      // Log baseline weight measurement
      await tx.weightLog.create({
        data: {
          userId,
          weightKg: data.currentWeightKg,
          notes: 'Baseline measurement from onboarding',
        },
      });

      // Mark any prior active goals as SUPERSEDED to maintain clean goal history
      await tx.nutritionGoal.updateMany({
        where: {
          userId,
          status: GoalStatus.ACTIVE,
        },
        data: {
          status: GoalStatus.SUPERSEDED,
        },
      });

      // Create new active NutritionGoal
      const goalRecord = await tx.nutritionGoal.create({
        data: {
          userId,
          dailyCalories: calorieTargetResult.dailyCalories,
          proteinGrams: macroResult.proteinGrams,
          carbsGrams: macroResult.carbsGrams,
          fatGrams: macroResult.fatGrams,
          fiberGrams: macroResult.fiberGrams,
          waterMl: 2500,
          effectiveDate: targetDate,
          status: GoalStatus.ACTIVE,
          primaryGoal: data.primaryGoal,
          targetWeightKg: data.targetWeightKg ?? data.currentWeightKg,
        },
      });

      return { profileRecord, goalRecord };
    });

    return {
      profile: this.mapProfileToDto(profileRecord, data.name),
      goal: this.mapGoalToDto(goalRecord),
      calculations: calculationsDto,
    };
  }
}
