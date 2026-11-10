import type {
  DiaryDetailResponse,
  DailyNutritionSummary,
  CreateDiaryEntryRequest,
  UpdateMealFoodItemRequest,
  MealFoodItemDto,
  MealEntryDto,
} from '@calmeter/contracts';

export interface DiaryApiClientConfig {
  baseUrl?: string;
  getAuthToken?: () => Promise<string | null>;
}

export class DiaryApiClient {
  private baseUrl: string;
  private getAuthToken?: () => Promise<string | null>;

  constructor(config?: DiaryApiClientConfig) {
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
   * Fetches the complete daily food diary for a specified date (YYYY-MM-DD).
   */
  async getDailyDiary(date: string, token?: string): Promise<DiaryDetailResponse> {
    const headers = await this.buildHeaders(token);
    const url = `${this.baseUrl}/diary/${encodeURIComponent(date)}`;

    const res = await fetch(url, { method: 'GET', headers });
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as any;
      throw new Error(err.error?.message || `Failed to fetch diary with status ${res.status}`);
    }

    const json = (await res.json()) as any;
    return json.data as DiaryDetailResponse;
  }

  /**
   * Fetches the daily nutrition summary and progress against targets for a specified date.
   */
  async getDailySummary(date: string, token?: string): Promise<DailyNutritionSummary> {
    const headers = await this.buildHeaders(token);
    const url = `${this.baseUrl}/diary/summary/${encodeURIComponent(date)}`;

    const res = await fetch(url, { method: 'GET', headers });
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as any;
      throw new Error(
        err.error?.message || `Failed to fetch daily summary with status ${res.status}`,
      );
    }

    const json = (await res.json()) as any;
    return json.data as DailyNutritionSummary;
  }

  /**
   * Logs food items into a meal entry for a specified date.
   */
  async createDiaryEntry(
    data: CreateDiaryEntryRequest,
    token?: string,
  ): Promise<{ mealEntry: MealEntryDto; createdItems: MealFoodItemDto[] }> {
    const headers = await this.buildHeaders(token);
    const url = `${this.baseUrl}/diary/entries`;

    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as any;
      throw new Error(err.error?.message || `Failed to log meal entry with status ${res.status}`);
    }

    const json = (await res.json()) as any;
    return json.data;
  }

  /**
   * Fetches details of a specific logged food item by id.
   */
  async getDiaryEntry(id: string, token?: string): Promise<MealFoodItemDto> {
    const headers = await this.buildHeaders(token);
    const url = `${this.baseUrl}/diary/entries/${encodeURIComponent(id)}`;

    const res = await fetch(url, { method: 'GET', headers });
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as any;
      throw new Error(err.error?.message || `Failed to fetch food entry with status ${res.status}`);
    }

    const json = (await res.json()) as any;
    return json.data as MealFoodItemDto;
  }

  /**
   * Updates an existing logged food item (portion, unit, food selection).
   */
  async updateDiaryEntry(
    id: string,
    data: UpdateMealFoodItemRequest,
    token?: string,
  ): Promise<{ updatedItem: MealFoodItemDto; mealEntry: MealEntryDto }> {
    const headers = await this.buildHeaders(token);
    const url = `${this.baseUrl}/diary/entries/${encodeURIComponent(id)}`;

    const res = await fetch(url, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as any;
      throw new Error(
        err.error?.message || `Failed to update food entry with status ${res.status}`,
      );
    }

    const json = (await res.json()) as any;
    return json.data;
  }

  /**
   * Deletes a logged food item and re-computes meal totals.
   */
  async deleteDiaryEntry(
    id: string,
    token?: string,
  ): Promise<{ success: boolean; message: string; mealEntryId: string }> {
    const headers = await this.buildHeaders(token);
    const url = `${this.baseUrl}/diary/entries/${encodeURIComponent(id)}`;

    const res = await fetch(url, { method: 'DELETE', headers });
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as any;
      throw new Error(
        err.error?.message || `Failed to delete food entry with status ${res.status}`,
      );
    }

    const json = (await res.json()) as any;
    return json.data;
  }
}

export const defaultDiaryApiClient = new DiaryApiClient();
