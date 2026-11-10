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
  GoalStatus,
  PrimaryGoal,
  BiologicalSex,
  Gender,
  ActivityLevel,
} from '@calmeter/shared';
import type {
  NutritionGoalDto,
  CreateNutritionGoalRequest,
  UpdateNutritionGoal,
  RecalculateGoalsRequest,
  RecalculateGoalsResponse,
} from '@calmeter/contracts';

export class GoalService {
  constructor(private prisma: PrismaClient = getPrismaClient()) {}

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
   * Retrieves the active nutrition goal effective on a specified date (or today).
   */
  async getCurrentGoal(userId: string, dateStr?: string): Promise<NutritionGoalDto | null> {
    const targetDate = dateStr ? parseIsoDate(dateStr) : parseIsoDate(formatDateToIso(new Date()));

    const goal = await this.prisma.nutritionGoal.findFirst({
      where: {
        userId,
        effectiveDate: { lte: targetDate },
      },
      orderBy: [{ effectiveDate: 'desc' }, { createdAt: 'desc' }],
    });

    if (!goal) {
      return null;
    }

    return this.mapGoalToDto(goal);
  }

  /**
   * Retrieves the complete historical timeline of user nutrition goals.
   */
  async getGoalHistory(userId: string): Promise<NutritionGoalDto[]> {
    const goals = await this.prisma.nutritionGoal.findMany({
      where: { userId },
      orderBy: [{ effectiveDate: 'desc' }, { createdAt: 'desc' }],
    });

    return goals.map(g => this.mapGoalToDto(g));
  }

  /**
   * Creates a new personalized nutrition goal with an effective date.
   * Does not rewrite past historical diary records.
   */
  async createGoal(userId: string, data: CreateNutritionGoalRequest): Promise<NutritionGoalDto> {
    // Validate macro energy consistency
    const macroResult = calculateMacronutrients({
      dailyCalories: data.dailyCalories,
      customProteinGrams: data.proteinGrams,
      customCarbsGrams: data.carbsGrams,
      customFatGrams: data.fatGrams,
      customFiberGrams: data.fiberGrams,
    });

    const targetEffectiveDate = data.effectiveDate
      ? parseIsoDate(data.effectiveDate)
      : parseIsoDate(formatDateToIso(new Date()));

    const created = await this.prisma.$transaction(async tx => {
      // Mark any active goals starting on or after this effective date as SUPERSEDED
      await tx.nutritionGoal.updateMany({
        where: {
          userId,
          status: GoalStatus.ACTIVE,
          effectiveDate: { gte: targetEffectiveDate },
        },
        data: {
          status: GoalStatus.SUPERSEDED,
        },
      });

      return tx.nutritionGoal.create({
        data: {
          userId,
          dailyCalories: data.dailyCalories,
          proteinGrams: macroResult.proteinGrams,
          carbsGrams: macroResult.carbsGrams,
          fatGrams: macroResult.fatGrams,
          fiberGrams: macroResult.fiberGrams,
          waterMl: data.waterMl ?? 2500,
          effectiveDate: targetEffectiveDate,
          status: GoalStatus.ACTIVE,
          primaryGoal: data.primaryGoal,
          targetWeightKg: data.targetWeightKg,
        },
      });
    });

    return this.mapGoalToDto(created);
  }

  /**
   * Updates an existing specific nutrition goal.
   * Enforces multi-tenant ownership: returns 404 if goal does not belong to user.
   */
  async updateGoal(
    userId: string,
    goalId: string,
    data: UpdateNutritionGoal,
  ): Promise<NutritionGoalDto> {
    const existing = await this.prisma.nutritionGoal.findFirst({
      where: { id: goalId, userId },
    });

    if (!existing) {
      throw new NotFoundError('Nutrition goal not found.');
    }

    const dailyCalories = data.dailyCalories ?? existing.dailyCalories;
    const proteinGrams = data.proteinGrams ?? Number(existing.proteinGrams);
    const carbsGrams = data.carbsGrams ?? Number(existing.carbsGrams);
    const fatGrams = data.fatGrams ?? Number(existing.fatGrams);
    const fiberGrams = data.fiberGrams ?? Number(existing.fiberGrams);

    const macroResult = calculateMacronutrients({
      dailyCalories,
      customProteinGrams: proteinGrams,
      customCarbsGrams: carbsGrams,
      customFatGrams: fatGrams,
      customFiberGrams: fiberGrams,
    });

    const updatePayload: any = {
      dailyCalories,
      proteinGrams: macroResult.proteinGrams,
      carbsGrams: macroResult.carbsGrams,
      fatGrams: macroResult.fatGrams,
      fiberGrams: macroResult.fiberGrams,
    };

    if (data.waterMl !== undefined) updatePayload.waterMl = data.waterMl;
    if (data.status !== undefined) updatePayload.status = data.status;
    if (data.primaryGoal !== undefined) updatePayload.primaryGoal = data.primaryGoal;
    if (data.targetWeightKg !== undefined) updatePayload.targetWeightKg = data.targetWeightKg;

    const updated = await this.prisma.nutritionGoal.update({
      where: { id: goalId },
      data: updatePayload,
    });

    return this.mapGoalToDto(updated);
  }

  /**
   * Recalculates suggested BMR, TDEE, Calorie target, and Macros using shared formulas.
   * Does not mutate database records; returns calculation preview for user review.
   */
  async recalculateGoals(
    userId: string,
    req?: RecalculateGoalsRequest,
  ): Promise<RecalculateGoalsResponse['data']> {
    const profile = await this.prisma.userProfile.findUnique({
      where: { userId },
    });

    const heightCm = req?.heightCm ?? (profile ? Number(profile.heightCm) : undefined);
    const currentWeightKg =
      req?.currentWeightKg ?? (profile ? Number(profile.currentWeightKg) : undefined);
    const dob = req?.dob ?? (profile?.dob ? formatDateToIso(profile.dob) : undefined);
    const biologicalSex =
      req?.biologicalSex ?? ((profile?.biologicalSex as BiologicalSex) || undefined);
    const gender = req?.gender ?? ((profile?.gender as Gender) || undefined);
    const activityLevel =
      req?.activityLevel ??
      ((profile?.activityLevel as ActivityLevel) || ActivityLevel.MODERATELY_ACTIVE);
    const primaryGoal =
      req?.primaryGoal ?? ((profile?.primaryGoal as PrimaryGoal) || PrimaryGoal.MAINTAIN_WEIGHT);
    const paceKgPerWeek = req?.paceKgPerWeek ?? (profile ? Number(profile.paceKgPerWeek) : 0.5);

    if (!heightCm || !currentWeightKg || !dob) {
      throw new ValidationError(
        'Missing required biometric inputs for goal recalculation (height, weight, or date of birth).',
      );
    }

    const ageYears = calculateAgeFromDob(dob);

    const bmrResult = calculateBmr({
      weightKg: currentWeightKg,
      heightCm,
      ageYears,
      biologicalSex,
      gender,
    });

    if (bmrResult.status === 'UNSUPPORTED') {
      throw new ValidationError(
        bmrResult.message || 'Supplied biometrics are unsupported for energy calculation.',
      );
    }

    const tdeeResult = calculateTdee({
      bmr: bmrResult.bmr,
      activityLevel,
    });

    const calorieTargetResult = calculateCalorieTarget({
      tdee: tdeeResult.tdee,
      bmr: bmrResult.bmr,
      primaryGoal,
      paceKgPerWeek,
      customCalorieOverride: req?.customCalorieOverride,
    });

    const macroResult = calculateMacronutrients({
      dailyCalories: calorieTargetResult.dailyCalories,
      customProteinGrams: req?.customProteinGrams,
      customCarbsGrams: req?.customCarbsGrams,
      customFatGrams: req?.customFatGrams,
      customFiberGrams: req?.customFiberGrams,
    });

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

    return {
      bmr: bmrResult.bmr,
      tdee: tdeeResult.tdee,
      suggestedCalories: calorieTargetResult.dailyCalories,
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
  }
}
