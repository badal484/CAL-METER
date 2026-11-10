import type {
  SendCoachMessageDto,
  CoachMessageResponseDto,
  CoachConversationHistoryDto,
  InsightsResponseDto,
  MealRecommendationsResponseDto,
  GetMealRecommendationsQueryDto,
} from '@calmeter/contracts';

export interface CoachApiClientConfig {
  baseUrl?: string;
  getAuthToken?: () => Promise<string | null>;
}

export class CoachApiClient {
  private baseUrl: string;
  private getAuthToken?: () => Promise<string | null>;

  constructor(config?: CoachApiClientConfig) {
    this.baseUrl = config?.baseUrl || 'http://localhost:3000/api/v1';
    this.getAuthToken = config?.getAuthToken;
  }

  private async buildHeaders(tokenOverride?: string): Promise<Record<string, string>> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };

    const token = tokenOverride || (this.getAuthToken ? await this.getAuthToken() : null);
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    return headers;
  }

  private async handleResponse<T>(res: Response, fallbackErrorMessage: string): Promise<T> {
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as any;
      const message =
        err.error?.message ||
        (Array.isArray(err.error?.details) && err.error.details.length > 0
          ? err.error.details.map((d: any) => d.message || d.issue).join('; ')
          : `${fallbackErrorMessage} (status ${res.status})`);
      throw new Error(message);
    }

    const json = (await res.json()) as any;
    return json.data !== undefined ? json.data : json;
  }

  /**
   * Send a question or prompt to the AI Nutrition Coach.
   */
  async sendMessage(message: string, tokenOverride?: string): Promise<CoachMessageResponseDto> {
    const headers = await this.buildHeaders(tokenOverride);
    const body: SendCoachMessageDto = { message };
    const res = await fetch(`${this.baseUrl}/coach/message`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
    return this.handleResponse<CoachMessageResponseDto>(res, 'Failed to receive coach response.');
  }

  /**
   * Fetch recent conversation history with the AI Coach.
   */
  async getHistory(limit = 50, tokenOverride?: string): Promise<CoachConversationHistoryDto> {
    const headers = await this.buildHeaders(tokenOverride);
    const res = await fetch(`${this.baseUrl}/coach/history?limit=${limit}`, {
      method: 'GET',
      headers,
    });
    return this.handleResponse<CoachConversationHistoryDto>(
      res,
      'Failed to retrieve coach conversation history.',
    );
  }

  /**
   * Clear user conversation history with the AI Coach.
   */
  async clearHistory(tokenOverride?: string): Promise<{ success: boolean; message: string }> {
    const headers = await this.buildHeaders(tokenOverride);
    const res = await fetch(`${this.baseUrl}/coach/history`, {
      method: 'DELETE',
      headers,
    });
    return this.handleResponse<{ success: boolean; message: string }>(
      res,
      'Failed to clear conversation history.',
    );
  }

  /**
   * Fetch deterministic personalized insights based on authentic logs.
   */
  async getInsights(forceRefresh = false, tokenOverride?: string): Promise<InsightsResponseDto> {
    const headers = await this.buildHeaders(tokenOverride);
    const url = `${this.baseUrl}/coach/insights${forceRefresh ? '?forceRefresh=true' : ''}`;
    const res = await fetch(url, {
      method: 'GET',
      headers,
    });
    return this.handleResponse<InsightsResponseDto>(
      res,
      'Failed to retrieve personalized insights.',
    );
  }

  /**
   * Fetch tailored meal recommendations matching remaining budget and preferences.
   */
  async getMealRecommendations(
    query?: GetMealRecommendationsQueryDto,
    tokenOverride?: string,
  ): Promise<MealRecommendationsResponseDto> {
    const headers = await this.buildHeaders(tokenOverride);
    const params = new URLSearchParams();
    if (query?.mealType) params.append('mealType', query.mealType);
    if (query?.date) params.append('date', query.date);

    const queryString = params.toString() ? `?${params.toString()}` : '';
    const res = await fetch(`${this.baseUrl}/coach/recommendations${queryString}`, {
      method: 'GET',
      headers,
    });
    return this.handleResponse<MealRecommendationsResponseDto>(
      res,
      'Failed to retrieve meal recommendations.',
    );
  }
}

export const defaultCoachApiClient = new CoachApiClient();
