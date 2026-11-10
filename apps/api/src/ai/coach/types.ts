export interface CoachUserContext {
  userId: string;
  biologicalSex?: string;
  heightCm?: number;
  currentWeightKg?: number;
  targetWeightKg?: number | null;
  primaryGoal?: string;
  dietPreference?: string;
  todayCaloriesConsumed: number;
  dailyCalorieTarget: number;
  remainingCalories: number;
  todayMacros: {
    protein: number;
    carbs: number;
    fat: number;
    fiber: number;
  };
  macroTargets: {
    protein: number;
    carbs: number;
    fat: number;
    fiber: number;
  };
  todayMeals: Array<{
    mealType: string;
    items: Array<{
      name: string;
      calories: number;
      protein: number;
      portion: string;
      isVerified?: boolean;
    }>;
  }>;
  recentWeightTrend?: string;
  recentWaterSummary?: string;
  recentExerciseSummary?: string;
}

export interface CoachChatRequest {
  userMessage: string;
  conversationHistory: Array<{
    role: 'user' | 'assistant';
    content: string;
  }>;
  context: CoachUserContext;
}

export interface CoachChatResponse {
  reply: string;
  suggestedPrompts?: string[];
  disclaimers: string[];
  safetyTriggered?: boolean;
  latencyMs: number;
  model: string;
  provider: string;
}

export interface ICoachAiProvider {
  readonly providerName: string;
  readonly defaultModel: string;
  chat(request: CoachChatRequest): Promise<CoachChatResponse>;
}

export class CoachAiError extends Error {
  constructor(
    message: string,
    public readonly code: string = 'COACH_AI_ERROR',
    public readonly retryable: boolean = false,
  ) {
    super(message);
    this.name = 'CoachAiError';
  }
}

export class CoachAiTimeoutError extends CoachAiError {
  constructor(message = 'The AI nutrition coach request timed out. Please try again.') {
    super(message, 'COACH_AI_TIMEOUT', true);
    this.name = 'CoachAiTimeoutError';
  }
}

export class CoachAiRateLimitError extends CoachAiError {
  constructor(
    message = 'AI coach rate limit reached. Please wait a moment before sending another message.',
  ) {
    super(message, 'COACH_AI_RATE_LIMIT', true);
    this.name = 'CoachAiRateLimitError';
  }
}

export class CoachAiUnavailableError extends CoachAiError {
  constructor(
    message = 'The AI nutrition service is currently unavailable. Please try again shortly.',
  ) {
    super(message, 'COACH_AI_UNAVAILABLE', true);
    this.name = 'CoachAiUnavailableError';
  }
}

export class CoachAiSafetyError extends CoachAiError {
  constructor(
    message = 'The requested query involves medical diagnosis or unsafe dietary practices that CAL METER cannot provide.',
  ) {
    super(message, 'COACH_AI_SAFETY_VIOLATION', false);
    this.name = 'CoachAiSafetyError';
  }
}
