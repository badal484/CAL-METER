import { ICoachAiProvider, CoachChatRequest, CoachChatResponse } from './types.js';

export class MockCoachAiProvider implements ICoachAiProvider {
  public readonly providerName = 'mock';
  public readonly defaultModel = 'mock-coach-v1';

  async chat(request: CoachChatRequest): Promise<CoachChatResponse> {
    const startTime = Date.now();
    const query = request.userMessage.toLowerCase().trim();
    const { context } = request;

    // Safety checks for dangerous eating patterns or clinical medical advice
    const isStarvationOrPurging =
      query.includes('starve') ||
      query.includes('vomit') ||
      query.includes('purge') ||
      query.includes('laxative') ||
      query.includes('200 calorie') ||
      query.includes('300 calorie') ||
      query.includes('500 calorie') ||
      query.includes('starvation') ||
      query.includes('lose 10 kg in 3 days') ||
      query.includes('water fast for 14 days');

    const isMedicalPrescription =
      query.includes('prescribe') ||
      query.includes('diagnose') ||
      query.includes('cure diabetes') ||
      query.includes('cure cancer') ||
      query.includes('medication') ||
      query.includes('chest pain');

    if (isStarvationOrPurging) {
      return {
        reply:
          'CAL METER strongly discourages extreme calorie restriction, purging, or unmonitored prolonged fasting. Sustained health and metabolic performance require adequate energy, essential fatty acids, and micronutrients. If you are experiencing distress regarding food intake or body image, please reach out to a trusted healthcare provider or an eating disorder support specialist.',
        suggestedPrompts: [
          'What is a safe, sustainable weekly weight-loss pace?',
          'How can I structure balanced, nourishing meals?',
        ],
        disclaimers: [
          'CAL METER provides lifestyle guidance and does not support dangerous energy restriction below physiological minimums.',
        ],
        safetyTriggered: true,
        latencyMs: Date.now() - startTime,
        model: this.defaultModel,
        provider: this.providerName,
      };
    }

    if (isMedicalPrescription) {
      return {
        reply:
          'I cannot diagnose medical conditions or prescribe therapeutic diets or medications. Please discuss symptoms and clinical interventions with a licensed physician or registered dietitian.',
        suggestedPrompts: [
          'What are general guidelines for whole-food nutrition?',
          'How does dietary fiber support general wellness?',
        ],
        disclaimers: [
          'CAL METER is an educational wellness tool and cannot provide clinical diagnosis or prescription.',
        ],
        safetyTriggered: true,
        latencyMs: Date.now() - startTime,
        model: this.defaultModel,
        provider: this.providerName,
      };
    }

    // Contextual responses based on user query
    let reply = '';
    const suggestedPrompts: string[] = [];

    if (query.includes('protein')) {
      const remainingProtein = Math.max(
        0,
        context.macroTargets.protein - context.todayMacros.protein,
      );
      reply = `You have consumed ${context.todayMacros.protein}g of protein today toward your ${context.macroTargets.protein}g target (${remainingProtein}g remaining). `;

      if (context.dietPreference === 'VEGETARIAN' || context.dietPreference === 'JAIN') {
        reply +=
          'To boost your protein intake without meat, consider incorporating paneer, Greek yogurt, sprouted moong, dal/chana, tofu, or a quality plant protein shake into your next meal.';
      } else {
        reply +=
          'Consider incorporating protein-dense options such as chicken breast, eggs, Greek yogurt, paneer, fish, or lentils to hit your target efficiently.';
      }

      suggestedPrompts.push(
        'What are high-protein snack options?',
        'Suggest a protein-rich dinner',
      );
    } else if (query.includes('dinner') || query.includes('what should i eat')) {
      const remainingCals = Math.round(context.remainingCalories);
      reply = `You have approximately ${remainingCals} kcal remaining in your daily budget. `;

      if (context.dietPreference === 'VEGETARIAN') {
        reply += `A balanced option would be 1-2 whole wheat phulkas with a katori of Moong Dal Tadka and a cucumber tomato salad. This provides sustained complex carbohydrates, plant-based protein, and fiber while keeping you within your calorie target.`;
      } else {
        reply += `A balanced option would be grilled chicken breast or paneer tikka with steamed vegetables and a small portion of brown rice or sweet potato. This delivers high protein and essential micronutrients.`;
      }

      suggestedPrompts.push(
        'How is my macronutrient balance today?',
        'Show me vegetarian dinner ideas',
      );
    } else if (
      query.includes('how am i doing') ||
      query.includes('progress') ||
      query.includes('today')
    ) {
      const pct = Math.round((context.todayCaloriesConsumed / context.dailyCalorieTarget) * 100);
      reply = `You have logged ${context.todayCaloriesConsumed} kcal out of your ${context.dailyCalorieTarget} kcal target (${pct}%). `;

      if (pct > 115) {
        reply += `You are slightly over your daily target today. Remember that individual days balance out over the week; focus on consistent hydration and whole foods tomorrow rather than extreme cuts.`;
      } else if (pct >= 85) {
        reply += `You are pacing well within your daily caloric target with balanced distribution.`;
      } else {
        reply += `You have ${Math.round(context.remainingCalories)} kcal remaining for the rest of the day.`;
      }

      suggestedPrompts.push(
        'How can I reach my protein target?',
        'Suggest a balanced meal with my remaining calories',
      );
    } else {
      reply = `Based on your diary today, you have consumed ${context.todayCaloriesConsumed} kcal (${Math.round(context.remainingCalories)} kcal remaining) with ${context.todayMacros.protein}g protein, ${context.todayMacros.carbs}g carbs, and ${context.todayMacros.fat}g fat. How can I assist you with your nutrition or meal planning today?`;
      suggestedPrompts.push(
        'How am I doing with my nutrition today?',
        'What should I eat for dinner?',
        'How can I reach my protein target?',
      );
    }

    return {
      reply,
      suggestedPrompts,
      disclaimers: [
        'Nutritional suggestions are educational references based on your logged records and do not replace personalized clinical advice.',
        'Always verify portion weights and ingredients for personal dietary requirements.',
      ],
      safetyTriggered: false,
      latencyMs: Date.now() - startTime,
      model: this.defaultModel,
      provider: this.providerName,
    };
  }
}
