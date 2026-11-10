import { PrismaClient, MealType, LoggedMethod, Prisma } from '@prisma/client';
import { getPrismaClient } from '../lib/prisma.js';
import { NotFoundError, ValidationError } from '../lib/errors.js';
import {
  parseIsoDate,
  formatDateToIso,
  roundTo,
  scaleNutrients,
  convertServingToGrams,
  aggregateNutrients,
  NutrientProfile,
  DomainValidationError,
  ServingProvenance,
} from '@calmeter/shared';
import {
  CreateDiaryEntryRequest,
  UpdateMealFoodItemRequest,
  MealFoodItemDto,
  MealEntryDto,
  DailyNutritionSummary,
  DiaryDetailResponse,
  DailyNutrientTotals,
} from '@calmeter/contracts';

export interface DiaryServiceOptions {
  prisma?: PrismaClient;
}

export class DiaryService {
  private prisma: PrismaClient;

  constructor(options?: DiaryServiceOptions) {
    this.prisma = options?.prisma || getPrismaClient();
  }

  /**
   * Retrieves the daily diary details for a specific date, including all meals,
   * logged food items, meal-level totals, and daily aggregated nutrient totals.
   */
  async getDailyDiary(userId: string, dateStr: string): Promise<DiaryDetailResponse> {
    const targetDate = parseIsoDate(dateStr);

    const mealEntries = await this.prisma.mealEntry.findMany({
      where: {
        userId,
        date: targetDate,
      },
      include: {
        items: {
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { mealType: 'asc' },
    });

    const standardMealTypes: MealType[] = [
      MealType.BREAKFAST,
      MealType.LUNCH,
      MealType.DINNER,
      MealType.SNACK,
    ];

    const mealEntryMap = new Map<MealType, (typeof mealEntries)[0]>();
    for (const entry of mealEntries) {
      mealEntryMap.set(entry.mealType, entry);
    }

    const formattedMeals: MealEntryDto[] = [];
    const allProfiles: NutrientProfile[] = [];

    let totalFiberSum = 0;
    let totalSugarSum = 0;
    let totalSodiumSum = 0;
    let hasAnyFiber = false;
    let hasAnySugar = false;
    let hasAnySodium = false;

    for (const mealType of standardMealTypes) {
      const entry = mealEntryMap.get(mealType);
      if (entry) {
        const formattedItems: MealFoodItemDto[] = entry.items.map(item => {
          const calories = Number(item.calories);
          const protein = Number(item.protein);
          const carbs = Number(item.carbs);
          const fat = Number(item.fat);
          const fiber = item.fiber !== null ? Number(item.fiber) : undefined;
          const sugar = item.sugar !== null ? Number(item.sugar) : undefined;
          const sodium = item.sodium !== null ? Number(item.sodium) : undefined;

          allProfiles.push({
            calories,
            proteinGrams: protein,
            carbsGrams: carbs,
            fatGrams: fat,
            fiberGrams: fiber,
          });

          if (fiber !== undefined) {
            hasAnyFiber = true;
            totalFiberSum += fiber;
          }
          if (sugar !== undefined) {
            hasAnySugar = true;
            totalSugarSum += sugar;
          }
          if (sodium !== undefined) {
            hasAnySodium = true;
            totalSodiumSum += sodium;
          }

          return {
            id: item.id,
            mealEntryId: item.mealEntryId,
            foodItemId: item.foodItemId,
            foodName: item.foodName,
            portionAmount: Number(item.portionAmount),
            servingUnit: item.servingUnit,
            gramWeight: Number(item.gramWeight),
            calories,
            protein,
            carbs,
            fat,
            fiber: item.fiber !== null ? Number(item.fiber) : null,
            sugar: item.sugar !== null ? Number(item.sugar) : null,
            sodium: item.sodium !== null ? Number(item.sodium) : null,
            micronutrients: (item.micronutrients as Record<string, number>) || null,
            scanId: item.scanId,
            notes: item.notes,
            confidenceScore: item.confidenceScore ? Number(item.confidenceScore) : null,
            loggedMethod: item.loggedMethod as any,
            createdAt: item.createdAt.toISOString(),
            updatedAt: item.updatedAt.toISOString(),
          };
        });

        formattedMeals.push({
          id: entry.id,
          userId: entry.userId,
          date: formatDateToIso(entry.date),
          mealType: entry.mealType as any,
          loggedAt: entry.loggedAt.toISOString(),
          notes: entry.notes,
          totalCalories: roundTo(Number(entry.totalCalories), 1),
          totalProtein: roundTo(Number(entry.totalProtein), 1),
          totalCarbs: roundTo(Number(entry.totalCarbs), 1),
          totalFat: roundTo(Number(entry.totalFat), 1),
          totalFiber: entry.totalFiber !== null ? roundTo(Number(entry.totalFiber), 1) : null,
          totalSugar: entry.totalSugar !== null ? roundTo(Number(entry.totalSugar), 1) : null,
          totalSodium: entry.totalSodium !== null ? roundTo(Number(entry.totalSodium), 1) : null,
          items: formattedItems,
        });
      }
    }

    let dailyAggregated: NutrientProfile;
    if (allProfiles.length > 0) {
      dailyAggregated = aggregateNutrients(allProfiles);
    } else {
      dailyAggregated = {
        calories: 0,
        proteinGrams: 0,
        carbsGrams: 0,
        fatGrams: 0,
      };
    }

    const dailyTotals: DailyNutrientTotals = {
      calories: roundTo(dailyAggregated.calories, 1),
      protein: roundTo(dailyAggregated.proteinGrams, 1),
      carbs: roundTo(dailyAggregated.carbsGrams, 1),
      fat: roundTo(dailyAggregated.fatGrams, 1),
      fiber: hasAnyFiber ? roundTo(totalFiberSum, 1) : null,
      sugar: hasAnySugar ? roundTo(totalSugarSum, 1) : null,
      sodium: hasAnySodium ? roundTo(totalSodiumSum, 1) : null,
    };

    return {
      date: dateStr,
      meals: formattedMeals,
      totals: dailyTotals,
    };
  }

  /**
   * Retrieves the high-level nutrition summary for a date, calculating calories
   * and macronutrients consumed against the user's active nutrition goals.
   */
  async getDailySummary(userId: string, dateStr: string): Promise<DailyNutritionSummary> {
    const targetDate = parseIsoDate(dateStr);

    // Retrieve the active nutrition goal effective on or before the target date
    const goal = await this.prisma.nutritionGoal.findFirst({
      where: {
        userId,
        effectiveDate: { lte: targetDate },
      },
      orderBy: [{ effectiveDate: 'desc' }, { createdAt: 'desc' }],
    });

    const calorieGoal = goal ? goal.dailyCalories : 2000;
    const proteinTarget = goal ? Number(goal.proteinGrams) : 150;
    const carbsTarget = goal ? Number(goal.carbsGrams) : 220;
    const fatTarget = goal ? Number(goal.fatGrams) : 65;
    const fiberTarget = goal ? Number(goal.fiberGrams) : 30;

    const dailyDiary = await this.getDailyDiary(userId, dateStr);

    const caloriesConsumed = dailyDiary.totals.calories;
    const caloriesRemaining = roundTo(calorieGoal - caloriesConsumed, 1);

    const proteinConsumed = dailyDiary.totals.protein;
    const carbsConsumed = dailyDiary.totals.carbs;
    const fatConsumed = dailyDiary.totals.fat;
    const fiberConsumed = dailyDiary.totals.fiber ?? 0;

    return {
      date: dateStr,
      calorieGoal,
      caloriesConsumed,
      caloriesRemaining,
      macros: {
        protein: {
          consumed: proteinConsumed,
          target: proteinTarget,
          remaining: roundTo(proteinTarget - proteinConsumed, 1),
        },
        carbs: {
          consumed: carbsConsumed,
          target: carbsTarget,
          remaining: roundTo(carbsTarget - carbsConsumed, 1),
        },
        fat: {
          consumed: fatConsumed,
          target: fatTarget,
          remaining: roundTo(fatTarget - fatConsumed, 1),
        },
        fiber: {
          consumed: fiberConsumed,
          target: fiberTarget,
          remaining: roundTo(fiberTarget - fiberConsumed, 1),
        },
      },
      totals: dailyDiary.totals,
      meals: dailyDiary.meals,
    };
  }

  /**
   * Logs one or multiple food items into a meal entry for a specified date and meal type.
   * Performs deterministic nutrient scaling and creates an immutable nutrient snapshot.
   */
  async createDiaryEntry(
    userId: string,
    request: CreateDiaryEntryRequest,
  ): Promise<{ mealEntry: MealEntryDto; createdItems: MealFoodItemDto[] }> {
    const targetDate = parseIsoDate(request.date);
    const mealType = request.mealType as MealType;

    const result = await this.prisma.$transaction(async tx => {
      // Find or create the canonical MealEntry for (userId, date, mealType)
      let mealEntry = await tx.mealEntry.findUnique({
        where: {
          userId_date_mealType: {
            userId,
            date: targetDate,
            mealType,
          },
        },
      });

      if (!mealEntry) {
        mealEntry = await tx.mealEntry.create({
          data: {
            userId,
            date: targetDate,
            mealType,
            notes: request.notes || null,
          },
        });
      } else if (request.notes && !mealEntry.notes) {
        mealEntry = await tx.mealEntry.update({
          where: { id: mealEntry.id },
          data: { notes: request.notes },
        });
      }

      const createdItems: MealFoodItemDto[] = [];

      for (const itemReq of request.items) {
        let gramWeight = itemReq.gramWeight;
        let calories = itemReq.calories;
        let protein = itemReq.protein;
        let carbs = itemReq.carbs;
        let fat = itemReq.fat;
        let fiber = itemReq.fiber !== undefined ? itemReq.fiber : null;
        let sugar = itemReq.sugar !== undefined ? itemReq.sugar : null;
        let sodium = itemReq.sodium !== undefined ? itemReq.sodium : null;
        let micronutrients = itemReq.micronutrients || {};

        if (itemReq.foodItemId) {
          // Fetch food item with nutrient profile and conversions
          const food = await tx.foodItem.findFirst({
            where: {
              id: itemReq.foodItemId,
              isArchived: false,
              OR: [{ isCustom: false }, { isCustom: true, createdByUserId: userId }],
            },
            include: {
              nutrientProfile: true,
              servingConversions: true,
            },
          });

          if (!food) {
            throw new NotFoundError(
              `Food item with id '${itemReq.foodItemId}' was not found or is unavailable.`,
            );
          }

          // Resolve gram weight
          if (gramWeight === undefined || gramWeight <= 0) {
            const conversionList = food.servingConversions.map((c: any) => ({
              unit: c.unitName,
              gramWeight: Number(c.gramWeight),
              volumeMl: c.mlVolume ? Number(c.mlVolume) : undefined,
              provenance: (c.provenance as any) || ServingProvenance.USER_CONFIGURED,
            }));

            const conv = convertServingToGrams(
              conversionList,
              itemReq.servingUnit,
              itemReq.portionAmount,
            );

            if (!conv.success) {
              throw new DomainValidationError(
                `Unable to determine gram weight for food '${food.name}' with serving '${itemReq.portionAmount} ${itemReq.servingUnit}': ${conv.message}`,
              );
            }
            gramWeight = conv.gramWeight;
          }

          // Compute deterministic nutrition if profile or base nutrients exist
          const profile = food.nutrientProfile;
          if (profile) {
            const baseNutrientProfile: NutrientProfile = {
              calories: Number(profile.calories),
              proteinGrams: Number(profile.protein),
              carbsGrams: Number(profile.carbs),
              fatGrams: Number(profile.fat),
              fiberGrams: profile.fiber !== null ? Number(profile.fiber) : undefined,
            };

            const scaled = scaleNutrients(baseNutrientProfile, gramWeight);
            calories = roundTo(scaled.calories, 1);
            protein = roundTo(scaled.proteinGrams, 1);
            carbs = roundTo(scaled.carbsGrams, 1);
            fat = roundTo(scaled.fatGrams, 1);

            if (profile.fiber !== null) {
              fiber = roundTo((Number(profile.fiber) / 100) * gramWeight, 1);
            }
            if (profile.sugar !== null) {
              sugar = roundTo((Number(profile.sugar) / 100) * gramWeight, 1);
            }
            if (profile.sodium !== null) {
              sodium = roundTo((Number(profile.sodium) / 100) * gramWeight, 1);
            }

            if (profile.micronutrients && typeof profile.micronutrients === 'object') {
              const rawMicros = profile.micronutrients as Record<string, number>;
              const scaledMicros: Record<string, number> = {};
              for (const [k, v] of Object.entries(rawMicros)) {
                if (typeof v === 'number' && Number.isFinite(v)) {
                  scaledMicros[k] = roundTo((v / 100) * gramWeight, 2);
                }
              }
              micronutrients = scaledMicros;
            }
          } else {
            // Fallback to base food item nutrient fields
            const baseNutrientProfile: NutrientProfile = {
              calories: Number(food.calories),
              proteinGrams: Number(food.protein),
              carbsGrams: Number(food.carbs),
              fatGrams: Number(food.fat),
              fiberGrams: food.fiber !== null ? Number(food.fiber) : undefined,
            };

            const scaled = scaleNutrients(baseNutrientProfile, gramWeight);
            calories = roundTo(scaled.calories, 1);
            protein = roundTo(scaled.proteinGrams, 1);
            carbs = roundTo(scaled.carbsGrams, 1);
            fat = roundTo(scaled.fatGrams, 1);
            if (food.fiber !== null) {
              fiber = roundTo((Number(food.fiber) / 100) * gramWeight, 1);
            }
          }
        }

        // Final sanity checks on required numbers
        if (
          gramWeight === undefined ||
          calories === undefined ||
          protein === undefined ||
          carbs === undefined ||
          fat === undefined
        ) {
          throw new ValidationError(
            `Incomplete nutrient details for logged food '${itemReq.foodName}'. Calories and macros must be deterministically calculable or explicitly supplied.`,
          );
        }

        const createdItem = await tx.mealFoodItem.create({
          data: {
            mealEntryId: mealEntry.id,
            foodItemId: itemReq.foodItemId || null,
            foodName: itemReq.foodName,
            portionAmount: itemReq.portionAmount,
            servingUnit: itemReq.servingUnit,
            gramWeight,
            calories,
            protein,
            carbs,
            fat,
            fiber: fiber !== null ? fiber : null,
            sugar: sugar !== null ? sugar : null,
            sodium: sodium !== null ? sodium : null,
            micronutrients: micronutrients as Prisma.JsonObject,
            scanId: itemReq.scanId || null,
            notes: itemReq.notes || null,
            confidenceScore: itemReq.confidenceScore || null,
            loggedMethod: (itemReq.loggedMethod as LoggedMethod) || LoggedMethod.SEARCH,
          },
        });

        createdItems.push({
          id: createdItem.id,
          mealEntryId: createdItem.mealEntryId,
          foodItemId: createdItem.foodItemId,
          foodName: createdItem.foodName,
          portionAmount: Number(createdItem.portionAmount),
          servingUnit: createdItem.servingUnit,
          gramWeight: Number(createdItem.gramWeight),
          calories: Number(createdItem.calories),
          protein: Number(createdItem.protein),
          carbs: Number(createdItem.carbs),
          fat: Number(createdItem.fat),
          fiber: createdItem.fiber !== null ? Number(createdItem.fiber) : null,
          sugar: createdItem.sugar !== null ? Number(createdItem.sugar) : null,
          sodium: createdItem.sodium !== null ? Number(createdItem.sodium) : null,
          micronutrients: (createdItem.micronutrients as Record<string, number>) || null,
          scanId: createdItem.scanId,
          notes: createdItem.notes,
          confidenceScore: createdItem.confidenceScore ? Number(createdItem.confidenceScore) : null,
          loggedMethod: createdItem.loggedMethod as any,
          createdAt: createdItem.createdAt.toISOString(),
          updatedAt: createdItem.updatedAt.toISOString(),
        });
      }

      // Recalculate MealEntry totals from all items belonging to this meal
      const allMealItems = await tx.mealFoodItem.findMany({
        where: { mealEntryId: mealEntry.id },
      });

      let mealCalories = 0;
      let mealProtein = 0;
      let mealCarbs = 0;
      let mealFat = 0;
      let mealFiber: number | null = null;
      let mealSugar: number | null = null;
      let mealSodium: number | null = null;

      for (const item of allMealItems) {
        mealCalories += Number(item.calories);
        mealProtein += Number(item.protein);
        mealCarbs += Number(item.carbs);
        mealFat += Number(item.fat);
        if (item.fiber !== null) {
          mealFiber = (mealFiber ?? 0) + Number(item.fiber);
        }
        if (item.sugar !== null) {
          mealSugar = (mealSugar ?? 0) + Number(item.sugar);
        }
        if (item.sodium !== null) {
          mealSodium = (mealSodium ?? 0) + Number(item.sodium);
        }
      }

      const updatedMealEntry = await tx.mealEntry.update({
        where: { id: mealEntry.id },
        data: {
          totalCalories: roundTo(mealCalories, 1),
          totalProtein: roundTo(mealProtein, 1),
          totalCarbs: roundTo(mealCarbs, 1),
          totalFat: roundTo(mealFat, 1),
          totalFiber: mealFiber !== null ? roundTo(mealFiber, 1) : null,
          totalSugar: mealSugar !== null ? roundTo(mealSugar, 1) : null,
          totalSodium: mealSodium !== null ? roundTo(mealSodium, 1) : null,
        },
        include: {
          items: {
            orderBy: { createdAt: 'asc' },
          },
        },
      });

      const formattedMealEntry: MealEntryDto = {
        id: updatedMealEntry.id,
        userId: updatedMealEntry.userId,
        date: formatDateToIso(updatedMealEntry.date),
        mealType: updatedMealEntry.mealType as any,
        loggedAt: updatedMealEntry.loggedAt.toISOString(),
        notes: updatedMealEntry.notes,
        totalCalories: roundTo(Number(updatedMealEntry.totalCalories), 1),
        totalProtein: roundTo(Number(updatedMealEntry.totalProtein), 1),
        totalCarbs: roundTo(Number(updatedMealEntry.totalCarbs), 1),
        totalFat: roundTo(Number(updatedMealEntry.totalFat), 1),
        totalFiber:
          updatedMealEntry.totalFiber !== null
            ? roundTo(Number(updatedMealEntry.totalFiber), 1)
            : null,
        totalSugar:
          updatedMealEntry.totalSugar !== null
            ? roundTo(Number(updatedMealEntry.totalSugar), 1)
            : null,
        totalSodium:
          updatedMealEntry.totalSodium !== null
            ? roundTo(Number(updatedMealEntry.totalSodium), 1)
            : null,
        items: updatedMealEntry.items.map(it => ({
          id: it.id,
          mealEntryId: it.mealEntryId,
          foodItemId: it.foodItemId,
          foodName: it.foodName,
          portionAmount: Number(it.portionAmount),
          servingUnit: it.servingUnit,
          gramWeight: Number(it.gramWeight),
          calories: Number(it.calories),
          protein: Number(it.protein),
          carbs: Number(it.carbs),
          fat: Number(it.fat),
          fiber: it.fiber !== null ? Number(it.fiber) : null,
          sugar: it.sugar !== null ? Number(it.sugar) : null,
          sodium: it.sodium !== null ? Number(it.sodium) : null,
          micronutrients: (it.micronutrients as Record<string, number>) || null,
          scanId: it.scanId,
          notes: it.notes,
          confidenceScore: it.confidenceScore ? Number(it.confidenceScore) : null,
          loggedMethod: it.loggedMethod as any,
          createdAt: it.createdAt.toISOString(),
          updatedAt: it.updatedAt.toISOString(),
        })),
      };

      return {
        mealEntry: formattedMealEntry,
        createdItems,
      };
    });

    return result;
  }

  /**
   * Retrieves a single logged food item by id, enforcing tenant ownership validation.
   */
  async getMealFoodItem(userId: string, itemId: string): Promise<MealFoodItemDto> {
    const item = await this.prisma.mealFoodItem.findFirst({
      where: {
        id: itemId,
        mealEntry: {
          userId,
        },
      },
      include: {
        mealEntry: true,
      },
    });

    if (!item) {
      throw new NotFoundError('Diary food item not found.');
    }

    return {
      id: item.id,
      mealEntryId: item.mealEntryId,
      foodItemId: item.foodItemId,
      foodName: item.foodName,
      portionAmount: Number(item.portionAmount),
      servingUnit: item.servingUnit,
      gramWeight: Number(item.gramWeight),
      calories: Number(item.calories),
      protein: Number(item.protein),
      carbs: Number(item.carbs),
      fat: Number(item.fat),
      fiber: item.fiber !== null ? Number(item.fiber) : null,
      sugar: item.sugar !== null ? Number(item.sugar) : null,
      sodium: item.sodium !== null ? Number(item.sodium) : null,
      micronutrients: (item.micronutrients as Record<string, number>) || null,
      scanId: item.scanId,
      notes: item.notes,
      confidenceScore: item.confidenceScore ? Number(item.confidenceScore) : null,
      loggedMethod: item.loggedMethod as any,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    };
  }

  /**
   * Updates an existing logged food item (portion, serving unit, or food substitution).
   * Recalculates nutrition deterministically and updates parent meal entry totals atomically.
   */
  async updateMealFoodItem(
    userId: string,
    itemId: string,
    update: UpdateMealFoodItemRequest,
  ): Promise<{ updatedItem: MealFoodItemDto; mealEntry: MealEntryDto }> {
    const result = await this.prisma.$transaction(async tx => {
      const existingItem = await tx.mealFoodItem.findFirst({
        where: {
          id: itemId,
          mealEntry: { userId },
        },
        include: {
          mealEntry: true,
        },
      });

      if (!existingItem) {
        throw new NotFoundError('Diary food item not found.');
      }

      let newMealEntryId = existingItem.mealEntryId;
      const targetDate = update.date ? parseIsoDate(update.date) : existingItem.mealEntry.date;
      const targetMealType = (update.mealType as MealType) || existingItem.mealEntry.mealType;

      // Handle relocation if date or mealType is changing
      if (update.date || (update.mealType && update.mealType !== existingItem.mealEntry.mealType)) {
        let destMealEntry = await tx.mealEntry.findUnique({
          where: {
            userId_date_mealType: {
              userId,
              date: targetDate,
              mealType: targetMealType,
            },
          },
        });

        if (!destMealEntry) {
          destMealEntry = await tx.mealEntry.create({
            data: {
              userId,
              date: targetDate,
              mealType: targetMealType,
            },
          });
        }
        newMealEntryId = destMealEntry.id;
      }

      const effectiveFoodItemId =
        update.foodItemId !== undefined ? update.foodItemId : existingItem.foodItemId;
      const effectivePortion =
        update.portionAmount !== undefined
          ? update.portionAmount
          : Number(existingItem.portionAmount);
      const effectiveUnit =
        update.servingUnit !== undefined ? update.servingUnit : existingItem.servingUnit;
      const effectiveFoodName =
        update.foodName !== undefined ? update.foodName : existingItem.foodName;

      let newGramWeight =
        update.gramWeight !== undefined ? update.gramWeight : Number(existingItem.gramWeight);
      let newCalories = Number(existingItem.calories);
      let newProtein = Number(existingItem.protein);
      let newCarbs = Number(existingItem.carbs);
      let newFat = Number(existingItem.fat);
      let newFiber = existingItem.fiber !== null ? Number(existingItem.fiber) : null;
      let newSugar = existingItem.sugar !== null ? Number(existingItem.sugar) : null;
      let newSodium = existingItem.sodium !== null ? Number(existingItem.sodium) : null;
      let newMicros = (existingItem.micronutrients as Record<string, number>) || {};

      if (effectiveFoodItemId) {
        // Food item reference exists: recalculate based on food item's verified 100g profile
        const food = await tx.foodItem.findFirst({
          where: {
            id: effectiveFoodItemId,
            isArchived: false,
            OR: [{ isCustom: false }, { isCustom: true, createdByUserId: userId }],
          },
          include: {
            nutrientProfile: true,
            servingConversions: true,
          },
        });

        if (!food) {
          throw new NotFoundError(
            `Food item with id '${effectiveFoodItemId}' was not found or is unavailable.`,
          );
        }

        if (
          update.portionAmount !== undefined ||
          update.servingUnit !== undefined ||
          update.foodItemId !== undefined
        ) {
          if (update.gramWeight === undefined) {
            const conversionList = food.servingConversions.map((c: any) => ({
              unit: c.unitName,
              gramWeight: Number(c.gramWeight),
              volumeMl: c.mlVolume ? Number(c.mlVolume) : undefined,
              provenance: (c.provenance as any) || ServingProvenance.USER_CONFIGURED,
            }));

            const conv = convertServingToGrams(conversionList, effectiveUnit, effectivePortion);
            if (!conv.success) {
              throw new DomainValidationError(
                `Unable to determine gram weight for food '${food.name}' with serving '${effectivePortion} ${effectiveUnit}': ${conv.message}`,
              );
            }
            newGramWeight = conv.gramWeight;
          }
        }

        const profile = food.nutrientProfile;
        if (profile) {
          const baseProfile: NutrientProfile = {
            calories: Number(profile.calories),
            proteinGrams: Number(profile.protein),
            carbsGrams: Number(profile.carbs),
            fatGrams: Number(profile.fat),
            fiberGrams: profile.fiber !== null ? Number(profile.fiber) : undefined,
          };

          const scaled = scaleNutrients(baseProfile, newGramWeight);
          newCalories = roundTo(scaled.calories, 1);
          newProtein = roundTo(scaled.proteinGrams, 1);
          newCarbs = roundTo(scaled.carbsGrams, 1);
          newFat = roundTo(scaled.fatGrams, 1);

          if (profile.fiber !== null) {
            newFiber = roundTo((Number(profile.fiber) / 100) * newGramWeight, 1);
          }
          if (profile.sugar !== null) {
            newSugar = roundTo((Number(profile.sugar) / 100) * newGramWeight, 1);
          }
          if (profile.sodium !== null) {
            newSodium = roundTo((Number(profile.sodium) / 100) * newGramWeight, 1);
          }

          if (profile.micronutrients && typeof profile.micronutrients === 'object') {
            const rawMicros = profile.micronutrients as Record<string, number>;
            const scaledMicros: Record<string, number> = {};
            for (const [k, v] of Object.entries(rawMicros)) {
              if (typeof v === 'number' && Number.isFinite(v)) {
                scaledMicros[k] = roundTo((v / 100) * newGramWeight, 2);
              }
            }
            newMicros = scaledMicros;
          }
        } else {
          const baseProfile: NutrientProfile = {
            calories: Number(food.calories),
            proteinGrams: Number(food.protein),
            carbsGrams: Number(food.carbs),
            fatGrams: Number(food.fat),
            fiberGrams: food.fiber !== null ? Number(food.fiber) : undefined,
          };

          const scaled = scaleNutrients(baseProfile, newGramWeight);
          newCalories = roundTo(scaled.calories, 1);
          newProtein = roundTo(scaled.proteinGrams, 1);
          newCarbs = roundTo(scaled.carbsGrams, 1);
          newFat = roundTo(scaled.fatGrams, 1);
          if (food.fiber !== null) {
            newFiber = roundTo((Number(food.fiber) / 100) * newGramWeight, 1);
          }
        }
      } else if (update.portionAmount !== undefined && Number(existingItem.portionAmount) > 0) {
        // No food item reference (manual entry): scale proportionally by portion change
        const ratio = update.portionAmount / Number(existingItem.portionAmount);
        newCalories = roundTo(newCalories * ratio, 1);
        newProtein = roundTo(newProtein * ratio, 1);
        newCarbs = roundTo(newCarbs * ratio, 1);
        newFat = roundTo(newFat * ratio, 1);
        if (newFiber !== null) newFiber = roundTo(newFiber * ratio, 1);
        if (newSugar !== null) newSugar = roundTo(newSugar * ratio, 1);
        if (newSodium !== null) newSodium = roundTo(newSodium * ratio, 1);
        newGramWeight = roundTo(newGramWeight * ratio, 1);
      }

      const updatedItem = await tx.mealFoodItem.update({
        where: { id: itemId },
        data: {
          mealEntryId: newMealEntryId,
          foodItemId: effectiveFoodItemId || null,
          foodName: effectiveFoodName,
          portionAmount: effectivePortion,
          servingUnit: effectiveUnit,
          gramWeight: newGramWeight,
          calories: newCalories,
          protein: newProtein,
          carbs: newCarbs,
          fat: newFat,
          fiber: newFiber,
          sugar: newSugar,
          sodium: newSodium,
          micronutrients: newMicros as Prisma.JsonObject,
          notes: update.notes !== undefined ? update.notes : existingItem.notes,
        },
      });

      // Recalculate totals for destination meal entry
      await this.recalculateMealEntryTotals(tx, newMealEntryId);

      // If item was moved to a different meal, recalculate original meal entry as well
      if (newMealEntryId !== existingItem.mealEntryId) {
        await this.recalculateMealEntryTotals(tx, existingItem.mealEntryId);
      }

      const finalMealEntry = await tx.mealEntry.findUniqueOrThrow({
        where: { id: newMealEntryId },
        include: {
          items: {
            orderBy: { createdAt: 'asc' },
          },
        },
      });

      const formattedItem: MealFoodItemDto = {
        id: updatedItem.id,
        mealEntryId: updatedItem.mealEntryId,
        foodItemId: updatedItem.foodItemId,
        foodName: updatedItem.foodName,
        portionAmount: Number(updatedItem.portionAmount),
        servingUnit: updatedItem.servingUnit,
        gramWeight: Number(updatedItem.gramWeight),
        calories: Number(updatedItem.calories),
        protein: Number(updatedItem.protein),
        carbs: Number(updatedItem.carbs),
        fat: Number(updatedItem.fat),
        fiber: updatedItem.fiber !== null ? Number(updatedItem.fiber) : null,
        sugar: updatedItem.sugar !== null ? Number(updatedItem.sugar) : null,
        sodium: updatedItem.sodium !== null ? Number(updatedItem.sodium) : null,
        micronutrients: (updatedItem.micronutrients as Record<string, number>) || null,
        scanId: updatedItem.scanId,
        notes: updatedItem.notes,
        confidenceScore: updatedItem.confidenceScore ? Number(updatedItem.confidenceScore) : null,
        loggedMethod: updatedItem.loggedMethod as any,
        createdAt: updatedItem.createdAt.toISOString(),
        updatedAt: updatedItem.updatedAt.toISOString(),
      };

      const formattedMealEntry: MealEntryDto = {
        id: finalMealEntry.id,
        userId: finalMealEntry.userId,
        date: formatDateToIso(finalMealEntry.date),
        mealType: finalMealEntry.mealType as any,
        loggedAt: finalMealEntry.loggedAt.toISOString(),
        notes: finalMealEntry.notes,
        totalCalories: roundTo(Number(finalMealEntry.totalCalories), 1),
        totalProtein: roundTo(Number(finalMealEntry.totalProtein), 1),
        totalCarbs: roundTo(Number(finalMealEntry.totalCarbs), 1),
        totalFat: roundTo(Number(finalMealEntry.totalFat), 1),
        totalFiber:
          finalMealEntry.totalFiber !== null ? roundTo(Number(finalMealEntry.totalFiber), 1) : null,
        totalSugar:
          finalMealEntry.totalSugar !== null ? roundTo(Number(finalMealEntry.totalSugar), 1) : null,
        totalSodium:
          finalMealEntry.totalSodium !== null
            ? roundTo(Number(finalMealEntry.totalSodium), 1)
            : null,
        items: finalMealEntry.items.map(it => ({
          id: it.id,
          mealEntryId: it.mealEntryId,
          foodItemId: it.foodItemId,
          foodName: it.foodName,
          portionAmount: Number(it.portionAmount),
          servingUnit: it.servingUnit,
          gramWeight: Number(it.gramWeight),
          calories: Number(it.calories),
          protein: Number(it.protein),
          carbs: Number(it.carbs),
          fat: Number(it.fat),
          fiber: it.fiber !== null ? Number(it.fiber) : null,
          sugar: it.sugar !== null ? Number(it.sugar) : null,
          sodium: it.sodium !== null ? Number(it.sodium) : null,
          micronutrients: (it.micronutrients as Record<string, number>) || null,
          scanId: it.scanId,
          notes: it.notes,
          confidenceScore: it.confidenceScore ? Number(it.confidenceScore) : null,
          loggedMethod: it.loggedMethod as any,
          createdAt: it.createdAt.toISOString(),
          updatedAt: it.updatedAt.toISOString(),
        })),
      };

      return {
        updatedItem: formattedItem,
        mealEntry: formattedMealEntry,
      };
    });

    return result;
  }

  /**
   * Deletes a logged food item and recalculates the parent meal entry totals atomically.
   */
  async deleteMealFoodItem(
    userId: string,
    itemId: string,
  ): Promise<{ success: boolean; message: string; mealEntryId: string }> {
    const result = await this.prisma.$transaction(async tx => {
      const existingItem = await tx.mealFoodItem.findFirst({
        where: {
          id: itemId,
          mealEntry: { userId },
        },
        include: { mealEntry: true },
      });

      if (!existingItem) {
        throw new NotFoundError('Diary food item not found.');
      }

      const mealEntryId = existingItem.mealEntryId;

      await tx.mealFoodItem.delete({
        where: { id: itemId },
      });

      await this.recalculateMealEntryTotals(tx, mealEntryId);

      return {
        success: true,
        message: 'Diary entry deleted successfully.',
        mealEntryId,
      };
    });

    return result;
  }

  /**
   * Internal helper to recalculate MealEntry totals from all currently present items.
   */
  private async recalculateMealEntryTotals(
    tx: Prisma.TransactionClient,
    mealEntryId: string,
  ): Promise<void> {
    const allItems = await tx.mealFoodItem.findMany({
      where: { mealEntryId },
    });

    let mealCalories = 0;
    let mealProtein = 0;
    let mealCarbs = 0;
    let mealFat = 0;
    let mealFiber: number | null = null;
    let mealSugar: number | null = null;
    let mealSodium: number | null = null;

    for (const item of allItems) {
      mealCalories += Number(item.calories);
      mealProtein += Number(item.protein);
      mealCarbs += Number(item.carbs);
      mealFat += Number(item.fat);
      if (item.fiber !== null) {
        mealFiber = (mealFiber ?? 0) + Number(item.fiber);
      }
      if (item.sugar !== null) {
        mealSugar = (mealSugar ?? 0) + Number(item.sugar);
      }
      if (item.sodium !== null) {
        mealSodium = (mealSodium ?? 0) + Number(item.sodium);
      }
    }

    await tx.mealEntry.update({
      where: { id: mealEntryId },
      data: {
        totalCalories: roundTo(mealCalories, 1),
        totalProtein: roundTo(mealProtein, 1),
        totalCarbs: roundTo(mealCarbs, 1),
        totalFat: roundTo(mealFat, 1),
        totalFiber: mealFiber !== null ? roundTo(mealFiber, 1) : null,
        totalSugar: mealSugar !== null ? roundTo(mealSugar, 1) : null,
        totalSodium: mealSodium !== null ? roundTo(mealSodium, 1) : null,
      },
    });
  }
}
