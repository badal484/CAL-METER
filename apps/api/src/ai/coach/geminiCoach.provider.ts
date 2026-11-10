import {
  ICoachAiProvider,
  CoachChatRequest,
  CoachChatResponse,
  CoachAiError,
  CoachAiTimeoutError,
  CoachAiRateLimitError,
  CoachAiUnavailableError,
} from './types.js';

export interface GeminiCoachProviderConfig {
  apiKey?: string;
  model?: string;
  timeoutMs?: number;
  baseUrl?: string;
}

export class GeminiCoachAiProvider implements ICoachAiProvider {
  public readonly providerName = 'gemini';
  public readonly defaultModel: string;

  private apiKey: string | undefined;
  private timeoutMs: number;
  private baseUrl: string;

  constructor(config?: GeminiCoachProviderConfig) {
    this.apiKey = config?.apiKey || process.env.GEMINI_API_KEY;
    this.defaultModel = config?.model || process.env.COACH_AI_MODEL || 'gemini-2.0-flash';
    this.timeoutMs = config?.timeoutMs || 15000;
    this.baseUrl = config?.baseUrl || 'https://generativelanguage.googleapis.com/v1beta/models';
  }

  async chat(request: CoachChatRequest): Promise<CoachChatResponse> {
    if (!this.apiKey) {
      throw new CoachAiError(
        'GEMINI_API_KEY is not configured on the server.',
        'PROVIDER_NOT_CONFIGURED',
        false,
      );
    }

    const startTime = Date.now();
    const model = this.defaultModel;
    const url = `${this.baseUrl}/${model}:generateContent?key=${this.apiKey}`;

    const systemPrompt = `You are CAL METER's AI Nutrition Coach, an empathetic, evidence-based nutrition science communicator.
Your role is to help users understand their food diary, discover nutritious meals fitting their targets, and build sustainable eating habits.

CORE NUTRITION & CLINICAL GUARDRAILS:
1. NON-CLINICAL ROLE: You are an educational wellness coach, NOT a medical doctor. Never diagnose illnesses, prescribe medication, or prescribe therapeutic clinical diets for conditions like kidney failure or diabetes.
2. DANGEROUS DIETARY PATTERNS: NEVER recommend or validate extreme starvation diets, purging, laxatives, water fasting over 24 hours, or intakes under the user's Basal Metabolic Rate (BMR). If a user asks about dangerous restriction, kindly direct them toward safe, sustainable habits and professional medical support.
3. DATA INTEGRITY: The user's actual diary data is provided in the prompt context. NEVER fabricate food logs, calories, or weight numbers that do not exist. Always clearly distinguish between verified food catalog data, user manual logs, and your suggestions.
4. CULTURAL & CULINARY EXPERTISE: Provide practical, culturally attuned meal suggestions for Indian cuisine (e.g. dal, roti, sabzi, curd, idli, paneer, biryani, poha) and international cuisine adhering to user's dietary preferences (Vegetarian, Vegan, Jain, Eggetarian, Halal).

RESPONSE FORMAT:
Return a JSON object adhering to this schema:
{
  "reply": "string (your conversational coaching response)",
  "suggestedPrompts": ["string (2-3 follow-up prompts the user could ask)"]
}`;

    const contextSummary = JSON.stringify({
      primaryGoal: request.context.primaryGoal,
      dietPreference: request.context.dietPreference,
      todayCalories: `${request.context.todayCaloriesConsumed} / ${request.context.dailyCalorieTarget} kcal (${Math.round(request.context.remainingCalories)} remaining)`,
      todayMacros: request.context.todayMacros,
      macroTargets: request.context.macroTargets,
      todayMealsLogged: request.context.todayMeals,
      recentWeightTrend: request.context.recentWeightTrend,
      recentWaterSummary: request.context.recentWaterSummary,
    });

    const userPrompt = `USER CONTEXT:
${contextSummary}

CONVERSATION HISTORY:
${request.conversationHistory.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n')}

USER QUESTION:
"${request.userMessage}"

Respond in the required JSON format.`;

    const controller = new AbortController();
    const timeoutHandle = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [{ parts: [{ text: userPrompt }] }],
          systemInstruction: { parts: [{ text: systemPrompt }] },
          generationConfig: {
            temperature: 0.3,
            responseMimeType: 'application/json',
          },
        }),
      });

      if (!response.ok) {
        if (response.status === 429) {
          throw new CoachAiRateLimitError('Gemini API rate limit exceeded.');
        }
        if (response.status >= 500) {
          throw new CoachAiUnavailableError(`Gemini upstream error: ${response.status}`);
        }
        const errorText = await response.text();
        throw new CoachAiError(`Gemini request failed: ${response.status} - ${errorText}`);
      }

      const json = (await response.json()) as any;
      const candidateText = json.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!candidateText) {
        throw new CoachAiError('Empty completion received from Gemini.', 'EMPTY_RESPONSE', true);
      }

      let parsed: { reply: string; suggestedPrompts?: string[] };
      try {
        parsed = JSON.parse(candidateText);
      } catch {
        parsed = { reply: candidateText.trim() };
      }

      return {
        reply: parsed.reply,
        suggestedPrompts: parsed.suggestedPrompts || [
          'How is my macronutrient balance today?',
          'Suggest a balanced meal for my remaining calories',
        ],
        disclaimers: [
          'Nutritional suggestions are educational references based on your logged records and do not replace personalized clinical advice.',
        ],
        safetyTriggered: false,
        latencyMs: Date.now() - startTime,
        model,
        provider: this.providerName,
      };
    } catch (err: any) {
      if (err.name === 'AbortError') {
        throw new CoachAiTimeoutError(`AI Coach request exceeded timeout of ${this.timeoutMs}ms.`);
      }
      throw err;
    } finally {
      clearTimeout(timeoutHandle);
    }
  }
}
