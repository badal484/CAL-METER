import type { PrismaClient } from '@prisma/client';
import { getPrismaClient } from '../lib/prisma.js';
import { getCoachAiProvider } from '../ai/coach/factory.js';
import type { ICoachAiProvider, CoachUserContext } from '../ai/coach/types.js';
import {
  generateDeterministicInsights,
  formatDateToIso,
  parseIsoDate,
  roundTo,
  MealType,
  CoachRole,
} from '@calmeter/shared';
import type {
  CoachMessageResponseDto,
  CoachConversationHistoryDto,
  InsightsResponseDto,
  MealRecommendationsResponseDto,
} from '@calmeter/contracts';
import { MealRecommendationService } from './mealRecommendation.service.js';

export interface CoachServiceOptions {
  prisma?: PrismaClient;
  coachProvider?: ICoachAiProvider;
  mealRecommendationService?: MealRecommendationService;
}

export class CoachService {
  private prisma: PrismaClient;
  private coachProvider: ICoachAiProvider;
  private mealRecommendationService: MealRecommendationService;

  constructor(options?: CoachServiceOptions) {
    this.prisma = options?.prisma || getPrismaClient();
    this.coachProvider = options?.coachProvider || getCoachAiProvider();
    this.mealRecommendationService =
      options?.mealRecommendationService || new MealRecommendationService(this.prisma);
  }

  /**
   * Dispatches a user query to the AI Nutrition Coach with anonymized, minimized user context.
   */
  async sendMessage(userId: string, userMessageText: string): Promise<CoachMessageResponseDto> {
    const todayStr = formatDateToIso(new Date());
    const todayDate = parseIsoDate(todayStr);

    // 1. Gather context: Profile, Goals, Today's Diary, Hydration, Activity
    const [profile, activeGoal, todayMeals, todayWaterLogs, recentWeights, recentExercises] =
      await Promise.all([
        this.prisma.userProfile.findUnique({
          where: { userId },
          select: {
            biologicalSex: true,
            heightCm: true,
            currentWeightKg: true,
            targetWeightKg: true,
            primaryGoal: true,
            dietPreference: true,
          },
        }),
        this.prisma.nutritionGoal.findFirst({
          where: { userId, effectiveDate: { lte: todayDate } },
          orderBy: [{ effectiveDate: 'desc' }, { createdAt: 'desc' }],
        }),
        this.prisma.mealEntry.findMany({
          where: { userId, date: todayDate },
          include: { items: true },
        }),
        this.prisma.waterLog.findMany({
          where: { userId, date: todayDate },
        }),
        this.prisma.weightLog.findMany({
          where: { userId },
          orderBy: { loggedAt: 'desc' },
          take: 2,
        }),
        this.prisma.exerciseLog.findMany({
          where: {
            userId,
            performedAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
          },
          orderBy: { performedAt: 'desc' },
          take: 5,
        }),
      ]);

    // Compute totals
    let consumedCalories = 0;
    let consumedProtein = 0;
    let consumedCarbs = 0;
    let consumedFat = 0;
    let consumedFiber = 0;

    const mealsStructured: CoachUserContext['todayMeals'] = [];

    for (const meal of todayMeals) {
      consumedCalories += Number(meal.totalCalories);
      consumedProtein += Number(meal.totalProtein);
      consumedCarbs += Number(meal.totalCarbs);
      consumedFat += Number(meal.totalFat);

      const items = meal.items.map(item => {
        consumedFiber += Number(item.fiber);
        return {
          name: item.foodName,
          calories: Math.round(Number(item.calories)),
          protein: roundTo(Number(item.protein), 1),
          portion: `${item.portionAmount} ${item.servingUnit}`,
          isVerified: item.foodItemId !== null,
        };
      });

      mealsStructured.push({
        mealType: meal.mealType,
        items,
      });
    }

    const targetCalories = activeGoal?.dailyCalories ?? 2000;
    const targetProtein = activeGoal?.proteinGrams ? Number(activeGoal.proteinGrams) : 120;
    const targetCarbs = activeGoal?.carbsGrams ? Number(activeGoal.carbsGrams) : 220;
    const targetFat = activeGoal?.fatGrams ? Number(activeGoal.fatGrams) : 60;
    const targetFiber = activeGoal?.fiberGrams ? Number(activeGoal.fiberGrams) : 30;

    const remainingCalories = Math.max(0, targetCalories - consumedCalories);

    const todayWaterMl = todayWaterLogs.reduce((sum, w) => sum + w.amountMl, 0);

    let recentWeightTrend: string | undefined;
    if (recentWeights.length >= 2) {
      const delta = roundTo(
        Number(recentWeights[0]!.weightKg) - Number(recentWeights[1]!.weightKg),
        2,
      );
      recentWeightTrend = `${Number(recentWeights[0]!.weightKg)} kg (${delta > 0 ? '+' : ''}${delta} kg vs previous)`;
    } else if (recentWeights[0]) {
      recentWeightTrend = `${Number(recentWeights[0].weightKg)} kg`;
    }

    let recentExerciseSummary: string | undefined;
    if (recentExercises.length > 0) {
      const totalMinutes = recentExercises.reduce((sum, e) => sum + e.durationMinutes, 0);
      recentExerciseSummary = `${recentExercises.length} sessions in last 7 days (${totalMinutes} mins)`;
    }

    const userContext: CoachUserContext = {
      userId,
      biologicalSex: profile?.biologicalSex ?? undefined,
      heightCm: profile?.heightCm ? Number(profile.heightCm) : undefined,
      currentWeightKg: profile?.currentWeightKg ? Number(profile.currentWeightKg) : undefined,
      targetWeightKg: profile?.targetWeightKg ? Number(profile.targetWeightKg) : null,
      primaryGoal: profile?.primaryGoal ?? undefined,
      dietPreference: profile?.dietPreference ?? undefined,
      todayCaloriesConsumed: Math.round(consumedCalories),
      dailyCalorieTarget: targetCalories,
      remainingCalories,
      todayMacros: {
        protein: roundTo(consumedProtein, 1),
        carbs: roundTo(consumedCarbs, 1),
        fat: roundTo(consumedFat, 1),
        fiber: roundTo(consumedFiber, 1),
      },
      macroTargets: {
        protein: targetProtein,
        carbs: targetCarbs,
        fat: targetFat,
        fiber: targetFiber,
      },
      todayMeals: mealsStructured,
      recentWeightTrend,
      recentWaterSummary: `${todayWaterMl} ml logged today (target: ${activeGoal?.waterMl ?? 2500} ml)`,
      recentExerciseSummary,
    };

    // 2. Fetch recent conversation history (last 6 messages)
    const recentHistory = await this.prisma.coachMessage.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 6,
    });
    const historyFormatted = recentHistory.reverse().map(m => ({
      role: m.role.toLowerCase() as 'user' | 'assistant',
      content: m.content,
    }));

    // 3. Persist user message in database
    await this.prisma.coachMessage.create({
      data: {
        userId,
        role: CoachRole.USER,
        content: userMessageText.trim(),
      },
    });

    // 4. Request response from AI coach provider
    const aiResponse = await this.coachProvider.chat({
      userMessage: userMessageText.trim(),
      conversationHistory: historyFormatted,
      context: userContext,
    });

    // 5. Persist assistant reply in database
    const assistantMessageRecord = await this.prisma.coachMessage.create({
      data: {
        userId,
        role: CoachRole.ASSISTANT,
        content: aiResponse.reply,
        metadata: {
          suggestedPrompts: aiResponse.suggestedPrompts,
          disclaimers: aiResponse.disclaimers,
          model: aiResponse.model,
          provider: aiResponse.provider,
          safetyTriggered: aiResponse.safetyTriggered,
        },
      },
    });

    return {
      reply: aiResponse.reply,
      messageId: assistantMessageRecord.id,
      suggestedPrompts: aiResponse.suggestedPrompts,
      disclaimers: aiResponse.disclaimers,
    };
  }

  /**
   * Retrieves conversation history for the authenticated user.
   */
  async getConversationHistory(userId: string, limit = 50): Promise<CoachConversationHistoryDto> {
    const messages = await this.prisma.coachMessage.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
      take: Math.min(limit, 100),
    });

    const totalCount = await this.prisma.coachMessage.count({ where: { userId } });

    return {
      messages: messages.map(m => ({
        id: m.id,
        userId: m.userId,
        role: m.role as CoachRole,
        content: m.content,
        metadata: (m.metadata as Record<string, unknown>) ?? null,
        createdAt: m.createdAt.toISOString(),
      })),
      totalCount,
    };
  }

  /**
   * Clears conversation history for the authenticated user.
   */
  async clearConversationHistory(userId: string): Promise<{ success: boolean; message: string }> {
    await this.prisma.coachMessage.deleteMany({ where: { userId } });
    return { success: true, message: 'Coach conversation history cleared.' };
  }

  /**
   * Evaluates deterministic nutrition insights over actual user logs.
   */
  async getPersonalizedInsights(
    userId: string,
    _forceRefresh = false,
  ): Promise<InsightsResponseDto> {
    const todayStr = formatDateToIso(new Date());
    const todayDate = parseIsoDate(todayStr);

    const [activeGoal, profile, todayMeals, todayWater, recentWeights, recentExercises] =
      await Promise.all([
        this.prisma.nutritionGoal.findFirst({
          where: { userId, effectiveDate: { lte: todayDate } },
          orderBy: [{ effectiveDate: 'desc' }, { createdAt: 'desc' }],
        }),
        this.prisma.userProfile.findUnique({
          where: { userId },
          select: { targetWeightKg: true },
        }),
        this.prisma.mealEntry.findMany({
          where: { userId, date: todayDate },
          include: { items: true },
        }),
        this.prisma.waterLog.findMany({
          where: { userId, date: todayDate },
        }),
        this.prisma.weightLog.findMany({
          where: { userId },
          orderBy: { loggedAt: 'desc' },
          take: 5,
        }),
        this.prisma.exerciseLog.findMany({
          where: {
            userId,
            performedAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
          },
          orderBy: { performedAt: 'desc' },
        }),
      ]);

    let todayCalories = 0;
    let todayProtein = 0;
    let todayCarbs = 0;
    let todayFat = 0;
    let todayFiber = 0;

    for (const meal of todayMeals) {
      todayCalories += Number(meal.totalCalories);
      todayProtein += Number(meal.totalProtein);
      todayCarbs += Number(meal.totalCarbs);
      todayFat += Number(meal.totalFat);
      for (const item of meal.items) {
        todayFiber += Number(item.fiber);
      }
    }

    const todayWaterMl = todayWater.reduce((sum, w) => sum + w.amountMl, 0);

    const weightsFormatted = recentWeights.map(w => ({
      date: formatDateToIso(w.loggedAt),
      weightKg: Number(w.weightKg),
    }));

    const exercisesFormatted = recentExercises.map(e => ({
      date: formatDateToIso(e.date),
      durationMinutes: e.durationMinutes,
      category: e.category,
    }));

    const deterministicInsights = generateDeterministicInsights({
      todayCaloriesConsumed: Math.round(todayCalories),
      dailyCalorieTarget: activeGoal?.dailyCalories ?? 2000,
      todayMacros: {
        protein: roundTo(todayProtein, 1),
        carbs: roundTo(todayCarbs, 1),
        fat: roundTo(todayFat, 1),
        fiber: roundTo(todayFiber, 1),
      },
      macroTargets: {
        protein: activeGoal?.proteinGrams ? Number(activeGoal.proteinGrams) : 120,
        carbs: activeGoal?.carbsGrams ? Number(activeGoal.carbsGrams) : 220,
        fat: activeGoal?.fatGrams ? Number(activeGoal.fatGrams) : 60,
        fiber: activeGoal?.fiberGrams ? Number(activeGoal.fiberGrams) : 30,
      },
      todayWaterMl,
      dailyWaterTargetMl: activeGoal?.waterMl ?? 2500,
      loggedMealsCount: todayMeals.length,
      recentWeightsKg: weightsFormatted,
      targetWeightKg: profile?.targetWeightKg ? Number(profile.targetWeightKg) : null,
      recentExerciseSessions: exercisesFormatted,
    });

    return {
      date: todayStr,
      insights: deterministicInsights.map(i => ({
        type: i.type,
        category: i.category,
        title: i.title,
        message: i.message,
        actionableTip: i.actionableTip,
        periodAnalyzed: i.periodAnalyzed,
        metricData: i.metricData,
        generatedAt: new Date().toISOString(),
      })),
      disclaimer:
        'Personalized insights are derived deterministically from your actual logged food and tracking data. They are designed for educational habit guidance and do not constitute clinical diagnosis.',
    };
  }

  /**
   * Generates tailored meal recommendations.
   */
  async getMealRecommendations(
    userId: string,
    mealType?: MealType,
    date?: string,
  ): Promise<MealRecommendationsResponseDto> {
    return this.mealRecommendationService.getMealRecommendations({
      userId,
      mealType,
      date,
    });
  }
}
