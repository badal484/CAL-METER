import type {
  NutritionGoalDto,
  CreateNutritionGoalRequest,
  UpdateNutritionGoal,
  RecalculateGoalsRequest,
  RecalculateGoalsResponse,
} from '@calmeter/contracts';

export interface GoalApiClientConfig {
  baseUrl?: string;
  getAuthToken?: () => Promise<string | null>;
}

export class GoalApiClient {
  private baseUrl: string;
  private getAuthToken?: () => Promise<string | null>;

  constructor(config?: GoalApiClientConfig) {
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

  /**
   * Retrieves the active nutrition goal effective on the given date (default today).
   */
  async getCurrentGoal(date?: string, token?: string): Promise<NutritionGoalDto | null> {
    const headers = await this.buildHeaders(token);
    const query = date ? `?date=${encodeURIComponent(date)}` : '';
    const url = `${this.baseUrl}/goals/current${query}`;

    const res = await fetch(url, { method: 'GET', headers });
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as any;
      throw new Error(err.error?.message || `Failed to fetch current goal (status ${res.status})`);
    }

    const json = (await res.json()) as any;
    return json.data as NutritionGoalDto | null;
  }

  /**
   * Retrieves the historical timeline of nutrition goals.
   */
  async getGoalHistory(token?: string): Promise<NutritionGoalDto[]> {
    const headers = await this.buildHeaders(token);
    const url = `${this.baseUrl}/goals`;

    const res = await fetch(url, { method: 'GET', headers });
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as any;
      throw new Error(err.error?.message || `Failed to fetch goal history (status ${res.status})`);
    }

    const json = (await res.json()) as any;
    return json.data as NutritionGoalDto[];
  }

  /**
   * Creates a new nutrition goal with an effective date.
   */
  async createGoal(data: CreateNutritionGoalRequest, token?: string): Promise<NutritionGoalDto> {
    const headers = await this.buildHeaders(token);
    const url = `${this.baseUrl}/goals`;

    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as any;
      throw new Error(err.error?.message || `Failed to create goal (status ${res.status})`);
    }

    const json = (await res.json()) as any;
    return json.data as NutritionGoalDto;
  }

  /**
   * Updates an existing nutrition goal by ID.
   */
  async updateGoal(
    id: string,
    data: UpdateNutritionGoal,
    token?: string,
  ): Promise<NutritionGoalDto> {
    const headers = await this.buildHeaders(token);
    const url = `${this.baseUrl}/goals/${encodeURIComponent(id)}`;

    const res = await fetch(url, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as any;
      throw new Error(err.error?.message || `Failed to update goal (status ${res.status})`);
    }

    const json = (await res.json()) as any;
    return json.data as NutritionGoalDto;
  }

  /**
   * Recalculates suggested nutrition targets without saving to database.
   */
  async recalculateGoals(
    data: RecalculateGoalsRequest,
    token?: string,
  ): Promise<RecalculateGoalsResponse['data']> {
    const headers = await this.buildHeaders(token);
    const url = `${this.baseUrl}/goals/recalculate`;

    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as any;
      throw new Error(err.error?.message || `Failed to recalculate goals (status ${res.status})`);
    }

    const json = (await res.json()) as any;
    return json.data as RecalculateGoalsResponse['data'];
  }
}
