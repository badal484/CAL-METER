import type { PrismaClient } from '@prisma/client';
import { getPrismaClient } from '../lib/prisma.js';
import {
  MealType,
  DietPreference,
  roundTo,
  scaleNutrients,
  type NutrientProfile,
} from '@calmeter/shared';
import type {
  MealRecommendationDto,
  MealRecommendationItemDto,
  MealRecommendationsResponseDto,
} from '@calmeter/contracts';

export interface GenerateMealRecommendationOptions {
  userId: string;
  mealType?: MealType;
  date?: string;
}

interface PresetMealTemplate {
  title: string;
  description: string;
  cuisine: string;
  dietPreference: DietPreference[];
  mealTypes: MealType[];
  items: Array<{
    foodSearchTerm: string;
    fallbackName: string;
    portionAmount: number;
    servingUnit: string;
    gramWeight: number;
    defaultNutrientsPer100g: {
      calories: number;
      protein: number;
      carbs: number;
      fat: number;
    };
  }>;
  dietaryTags: string[];
}

const PRESET_MEALS: PresetMealTemplate[] = [
  // --------------------------------------------------------------------------
  // BREAKFAST
  // --------------------------------------------------------------------------
  {
    title: 'Steamed Idli with Sambar & Coconut Chutney',
    description:
      'Fermented lentil and rice cakes with lentil vegetable stew. Low in fat, light on digestion.',
    cuisine: 'South Indian',
    dietPreference: [
      DietPreference.ANY,
      DietPreference.VEGETARIAN,
      DietPreference.VEGAN,
      DietPreference.HALAL,
    ],
    mealTypes: [MealType.BREAKFAST, MealType.SNACK],
    items: [
      {
        foodSearchTerm: 'Idli',
        fallbackName: 'Steamed Rice & Urad Dal Idli',
        portionAmount: 3,
        servingUnit: 'piece',
        gramWeight: 120,
        defaultNutrientsPer100g: { calories: 132, protein: 4.8, carbs: 26.5, fat: 0.8 },
      },
      {
        foodSearchTerm: 'Sambar',
        fallbackName: 'Mixed Vegetable Sambar',
        portionAmount: 1,
        servingUnit: 'katori',
        gramWeight: 150,
        defaultNutrientsPer100g: { calories: 75, protein: 3.2, carbs: 12.0, fat: 1.5 },
      },
    ],
    dietaryTags: ['VEGETARIAN', 'FERMENTED', 'LOW_FAT'],
  },
  {
    title: 'Warm Vegetable Poha with Peanuts',
    description:
      'Flattened rice tempered with turmeric, mustard seeds, curry leaves, and crunchy peanuts.',
    cuisine: 'Western Indian',
    dietPreference: [
      DietPreference.ANY,
      DietPreference.VEGETARIAN,
      DietPreference.VEGAN,
      DietPreference.JAIN,
      DietPreference.HALAL,
    ],
    mealTypes: [MealType.BREAKFAST, MealType.SNACK],
    items: [
      {
        foodSearchTerm: 'Poha',
        fallbackName: 'Batata Poha with Peanuts',
        portionAmount: 1,
        servingUnit: 'bowl',
        gramWeight: 200,
        defaultNutrientsPer100g: { calories: 168, protein: 4.2, carbs: 28.5, fat: 4.5 },
      },
    ],
    dietaryTags: ['VEGETARIAN', 'VEGAN', 'IRON_RICH'],
  },
  {
    title: 'High-Protein Boiled Eggs with Whole Wheat Toast',
    description:
      'Two boiled eggs with whole wheat sourdough toast. High in bioavailable protein and choline.',
    cuisine: 'Global / Continental',
    dietPreference: [DietPreference.ANY, DietPreference.EGGETARIAN, DietPreference.HALAL],
    mealTypes: [MealType.BREAKFAST],
    items: [
      {
        foodSearchTerm: 'Egg',
        fallbackName: 'Whole Boiled Egg',
        portionAmount: 2,
        servingUnit: 'large',
        gramWeight: 100,
        defaultNutrientsPer100g: { calories: 155, protein: 12.6, carbs: 1.1, fat: 10.6 },
      },
      {
        foodSearchTerm: 'Toast',
        fallbackName: 'Whole Wheat Toast',
        portionAmount: 2,
        servingUnit: 'slice',
        gramWeight: 60,
        defaultNutrientsPer100g: { calories: 247, protein: 9.0, carbs: 45.0, fat: 3.4 },
      },
    ],
    dietaryTags: ['HIGH_PROTEIN', 'EGGETARIAN'],
  },

  // --------------------------------------------------------------------------
  // LUNCH / DINNER (INDIAN VEGETARIAN)
  // --------------------------------------------------------------------------
  {
    title: 'Phulkas with Moong Dal Tadka & Salad',
    description:
      'Traditional home-cooked dinner with whole wheat flatbreads, yellow lentil soup, and fresh cucumber tomato salad.',
    cuisine: 'North Indian',
    dietPreference: [
      DietPreference.ANY,
      DietPreference.VEGETARIAN,
      DietPreference.VEGAN,
      DietPreference.HALAL,
    ],
    mealTypes: [MealType.LUNCH, MealType.DINNER],
    items: [
      {
        foodSearchTerm: 'Roti',
        fallbackName: 'Whole Wheat Roti / Phulka',
        portionAmount: 2,
        servingUnit: 'piece',
        gramWeight: 70,
        defaultNutrientsPer100g: { calories: 297, protein: 9.7, carbs: 62.8, fat: 1.1 },
      },
      {
        foodSearchTerm: 'Moong Dal',
        fallbackName: 'Yellow Moong Dal Tadka',
        portionAmount: 1,
        servingUnit: 'katori',
        gramWeight: 200,
        defaultNutrientsPer100g: { calories: 95, protein: 5.4, carbs: 14.5, fat: 2.1 },
      },
      {
        foodSearchTerm: 'Salad',
        fallbackName: 'Kachumber Cucumber Tomato Salad',
        portionAmount: 1,
        servingUnit: 'bowl',
        gramWeight: 100,
        defaultNutrientsPer100g: { calories: 24, protein: 1.0, carbs: 4.8, fat: 0.2 },
      },
    ],
    dietaryTags: ['VEGETARIAN', 'HIGH_FIBER', 'HOME_COOKED'],
  },
  {
    title: 'Paneer Bhurji with Whole Wheat Rotis',
    description:
      'Crumbled cottage cheese sautéed with tomatoes, green chillies, and cumin, served with warm rotis.',
    cuisine: 'North Indian',
    dietPreference: [
      DietPreference.ANY,
      DietPreference.VEGETARIAN,
      DietPreference.JAIN,
      DietPreference.HALAL,
    ],
    mealTypes: [MealType.LUNCH, MealType.DINNER],
    items: [
      {
        foodSearchTerm: 'Paneer',
        fallbackName: 'Spiced Paneer Bhurji',
        portionAmount: 1,
        servingUnit: 'katori',
        gramWeight: 150,
        defaultNutrientsPer100g: { calories: 210, protein: 14.5, carbs: 4.2, fat: 15.2 },
      },
      {
        foodSearchTerm: 'Roti',
        fallbackName: 'Whole Wheat Roti',
        portionAmount: 2,
        servingUnit: 'piece',
        gramWeight: 70,
        defaultNutrientsPer100g: { calories: 297, protein: 9.7, carbs: 62.8, fat: 1.1 },
      },
    ],
    dietaryTags: ['VEGETARIAN', 'HIGH_PROTEIN', 'CALCIUM_RICH'],
  },
  {
    title: 'Rajma Masala with Steamed Basmati Rice',
    description:
      'Slow-cooked kidney beans in an aromatic tomato-ginger gravy served over fragrant basmati rice.',
    cuisine: 'North Indian',
    dietPreference: [
      DietPreference.ANY,
      DietPreference.VEGETARIAN,
      DietPreference.VEGAN,
      DietPreference.HALAL,
    ],
    mealTypes: [MealType.LUNCH, MealType.DINNER],
    items: [
      {
        foodSearchTerm: 'Rajma',
        fallbackName: 'Punjabi Rajma Masala',
        portionAmount: 1,
        servingUnit: 'katori',
        gramWeight: 200,
        defaultNutrientsPer100g: { calories: 125, protein: 6.8, carbs: 19.5, fat: 2.5 },
      },
      {
        foodSearchTerm: 'Rice',
        fallbackName: 'Steamed Basmati Rice',
        portionAmount: 1,
        servingUnit: 'katori',
        gramWeight: 150,
        defaultNutrientsPer100g: { calories: 130, protein: 2.7, carbs: 28.2, fat: 0.3 },
      },
    ],
    dietaryTags: ['VEGETARIAN', 'VEGAN', 'HIGH_FIBER'],
  },

  // --------------------------------------------------------------------------
  // LUNCH / DINNER (NON-VEGETARIAN)
  // --------------------------------------------------------------------------
  {
    title: 'Tandoori Chicken Tikka with Steamed Rice & Salad',
    description:
      'Yogurt-marinated roasted chicken breast chunks with steamed basmati rice and fresh greens.',
    cuisine: 'North Indian / Global',
    dietPreference: [DietPreference.ANY, DietPreference.HALAL],
    mealTypes: [MealType.LUNCH, MealType.DINNER],
    items: [
      {
        foodSearchTerm: 'Chicken',
        fallbackName: 'Roasted Tandoori Chicken Tikka',
        portionAmount: 1,
        servingUnit: 'portion',
        gramWeight: 150,
        defaultNutrientsPer100g: { calories: 165, protein: 26.5, carbs: 2.5, fat: 5.5 },
      },
      {
        foodSearchTerm: 'Rice',
        fallbackName: 'Steamed White Rice',
        portionAmount: 1,
        servingUnit: 'katori',
        gramWeight: 150,
        defaultNutrientsPer100g: { calories: 130, protein: 2.7, carbs: 28.2, fat: 0.3 },
      },
      {
        foodSearchTerm: 'Salad',
        fallbackName: 'Garden Salad with Lemon Dressing',
        portionAmount: 1,
        servingUnit: 'bowl',
        gramWeight: 100,
        defaultNutrientsPer100g: { calories: 20, protein: 1.0, carbs: 4.0, fat: 0.2 },
      },
    ],
    dietaryTags: ['HIGH_PROTEIN', 'LEAN_MEAT'],
  },
];

export class MealRecommendationService {
  constructor(private prisma: PrismaClient = getPrismaClient()) {}

  /**
   * Generates tailored meal recommendations based on real food catalog data,
   * remaining daily calories, and user dietary preferences.
   */
  async getMealRecommendations(
    options: GenerateMealRecommendationOptions,
  ): Promise<MealRecommendationsResponseDto> {
    const { userId, mealType, date: dateStr } = options;
    const effectiveDateStr = dateStr || new Date().toISOString().split('T')[0]!;
    const effectiveDate = new Date(effectiveDateStr);

    // 1. Fetch user profile for dietary preference
    const profile = await this.prisma.userProfile.findUnique({
      where: { userId },
      select: { dietPreference: true },
    });
    const userDietPref = (profile?.dietPreference as DietPreference) || DietPreference.ANY;

    // 2. Fetch active nutrition goal on date
    const goal = await this.prisma.nutritionGoal.findFirst({
      where: { userId, effectiveDate: { lte: effectiveDate } },
      orderBy: [{ effectiveDate: 'desc' }, { createdAt: 'desc' }],
    });
    const targetCalories = goal?.dailyCalories ?? 2000;
    const targetProtein = goal?.proteinGrams ? Number(goal.proteinGrams) : 120;
    const targetCarbs = goal?.carbsGrams ? Number(goal.carbsGrams) : 220;
    const targetFat = goal?.fatGrams ? Number(goal.fatGrams) : 60;

    // 3. Compute consumed calories today from MealEntry
    const mealsToday = await this.prisma.mealEntry.findMany({
      where: { userId, date: effectiveDate },
      select: { totalCalories: true, totalProtein: true, totalCarbs: true, totalFat: true },
    });

    const consumedCalories = mealsToday.reduce((sum, m) => sum + Number(m.totalCalories), 0);
    const consumedProtein = mealsToday.reduce((sum, m) => sum + Number(m.totalProtein), 0);
    const consumedCarbs = mealsToday.reduce((sum, m) => sum + Number(m.totalCarbs), 0);
    const consumedFat = mealsToday.reduce((sum, m) => sum + Number(m.totalFat), 0);

    const remainingCalories = Math.max(0, targetCalories - consumedCalories);
    const remainingProtein = Math.max(0, roundTo(targetProtein - consumedProtein, 1));
    const remainingCarbs = Math.max(0, roundTo(targetCarbs - consumedCarbs, 1));
    const remainingFat = Math.max(0, roundTo(targetFat - consumedFat, 1));

    // 4. Resolve default meal type if not supplied based on time of day
    let resolvedMealType = mealType;
    if (!resolvedMealType) {
      const currentHour = new Date().getHours();
      if (currentHour < 11) resolvedMealType = MealType.BREAKFAST;
      else if (currentHour < 16) resolvedMealType = MealType.LUNCH;
      else if (currentHour < 19) resolvedMealType = MealType.SNACK;
      else resolvedMealType = MealType.DINNER;
    }

    // 5. Filter preset templates by user dietary preference and meal type
    const matchingTemplates = PRESET_MEALS.filter(t => {
      const matchesType = t.mealTypes.includes(resolvedMealType!);
      const matchesDiet =
        userDietPref === DietPreference.ANY ||
        t.dietPreference.includes(userDietPref) ||
        t.dietPreference.includes(DietPreference.ANY);
      return matchesType && matchesDiet;
    });

    const selectedTemplates = (
      matchingTemplates.length > 0 ? matchingTemplates : PRESET_MEALS
    ).slice(0, 3);

    // 6. Build recommendation DTOs referencing real database records
    const recommendations: MealRecommendationDto[] = [];

    for (let idx = 0; idx < selectedTemplates.length; idx++) {
      const template = selectedTemplates[idx]!;
      const items: MealRecommendationItemDto[] = [];
      let totalCals = 0;
      let totalProt = 0;
      let totalCarb = 0;
      let totalFt = 0;

      for (const itemPlan of template.items) {
        // Query database for matching food
        const dbFood = await this.prisma.foodItem.findFirst({
          where: {
            name: { contains: itemPlan.foodSearchTerm, mode: 'insensitive' },
            isArchived: false,
          },
          select: {
            id: true,
            name: true,
            calories: true,
            protein: true,
            carbs: true,
            fat: true,
            standardWeightGrams: true,
          },
        });

        const per100g: NutrientProfile = dbFood
          ? {
              calories: Number(dbFood.calories),
              proteinGrams: Number(dbFood.protein),
              carbsGrams: Number(dbFood.carbs),
              fatGrams: Number(dbFood.fat),
            }
          : {
              calories: itemPlan.defaultNutrientsPer100g.calories,
              proteinGrams: itemPlan.defaultNutrientsPer100g.protein,
              carbsGrams: itemPlan.defaultNutrientsPer100g.carbs,
              fatGrams: itemPlan.defaultNutrientsPer100g.fat,
            };

        const scaled = scaleNutrients(per100g, itemPlan.gramWeight);

        items.push({
          foodId: dbFood?.id,
          foodName: dbFood?.name || itemPlan.fallbackName,
          portionAmount: itemPlan.portionAmount,
          servingUnit: itemPlan.servingUnit,
          gramWeight: itemPlan.gramWeight,
          calories: Math.round(scaled.calories),
          protein: roundTo(scaled.proteinGrams, 1),
          carbs: roundTo(scaled.carbsGrams, 1),
          fat: roundTo(scaled.fatGrams, 1),
          isVerified: Boolean(dbFood),
        });

        totalCals += scaled.calories;
        totalProt += scaled.proteinGrams;
        totalCarb += scaled.carbsGrams;
        totalFt += scaled.fatGrams;
      }

      const fitsRemainingBudget =
        remainingCalories > 0 ? totalCals <= remainingCalories * 1.15 : true;

      recommendations.push({
        id: `rec-${idx + 1}`,
        mealType: resolvedMealType!,
        title: template.title,
        description: template.description,
        cuisine: template.cuisine,
        totalCalories: Math.round(totalCals),
        totalProtein: roundTo(totalProt, 1),
        totalCarbs: roundTo(totalCarb, 1),
        totalFat: roundTo(totalFt, 1),
        items,
        fitsRemainingBudget,
        dietaryTags: Array.from(
          new Set([
            ...template.dietaryTags,
            ...template.dietPreference.filter(p => p !== DietPreference.ANY),
          ]),
        ),
      });
    }

    return {
      date: effectiveDateStr,
      remainingCalories: Math.round(remainingCalories),
      remainingProtein,
      remainingCarbs,
      remainingFat,
      recommendations,
      disclaimer:
        'Meal recommendations are general dietary inspirations referencing real food database records. They do not constitute personalized clinical diets. Review and confirm ingredients before logging to your diary.',
    };
  }
}
