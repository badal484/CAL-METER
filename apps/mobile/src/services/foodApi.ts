import type {
  FoodSearchQuery,
  FoodSearchResponse,
  FoodItemDetailDto,
  CreateCustomFoodDto,
  UpdateCustomFoodDto,
} from '@calmeter/contracts';

export interface FoodApiClientConfig {
  baseUrl?: string;
  getAuthToken?: () => Promise<string | null>;
}

export class FoodApiClient {
  private baseUrl: string;
  private getAuthToken?: () => Promise<string | null>;

  constructor(config?: FoodApiClientConfig) {
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
   * Searches verified catalog foods and user's private custom foods.
   */
  async searchFoods(query: FoodSearchQuery, token?: string): Promise<FoodSearchResponse> {
    const params = new URLSearchParams();
    if (query.q) params.set('q', query.q);
    if (query.barcode) params.set('barcode', query.barcode);
    if (query.categoryId) params.set('categoryId', query.categoryId);
    if (query.cuisine) params.set('cuisine', query.cuisine);
    if (query.source) params.set('source', query.source);
    if (query.page) params.set('page', String(query.page));
    if (query.limit) params.set('limit', String(query.limit));
    if (query.sortBy) params.set('sortBy', query.sortBy);
    if (query.sortOrder) params.set('sortOrder', query.sortOrder);

    const headers = await this.buildHeaders(token);
    const url = `${this.baseUrl}/foods?${params.toString()}`;

    const res = await fetch(url, { method: 'GET', headers });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || `Search failed with status ${res.status}`);
    }

    const json = await res.json();
    return {
      items: json.data,
      total: json.meta?.total ?? json.data.length,
      page: json.meta?.page ?? 1,
      limit: json.meta?.limit ?? 20,
      totalPages: json.meta?.totalPages ?? 1,
    };
  }

  /**
   * Retrieves full food details including 100g nutrient profile and serving conversions.
   */
  async getFoodDetail(id: string, token?: string): Promise<FoodItemDetailDto> {
    const headers = await this.buildHeaders(token);
    const url = `${this.baseUrl}/foods/${id}`;

    const res = await fetch(url, { method: 'GET', headers });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || `Failed to fetch food details (${res.status})`);
    }

    const json = await res.json();
    return json.data;
  }

  /**
   * Creates a private custom food item for the authenticated user.
   */
  async createCustomFood(food: CreateCustomFoodDto, token?: string): Promise<FoodItemDetailDto> {
    const headers = await this.buildHeaders(token);
    const url = `${this.baseUrl}/foods`;

    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(food),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || `Failed to create custom food (${res.status})`);
    }

    const json = await res.json();
    return json.data;
  }

  /**
   * Updates an existing custom food item.
   */
  async updateCustomFood(
    id: string,
    update: UpdateCustomFoodDto,
    token?: string,
  ): Promise<FoodItemDetailDto> {
    const headers = await this.buildHeaders(token);
    const url = `${this.baseUrl}/foods/${id}`;

    const res = await fetch(url, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(update),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || `Failed to update custom food (${res.status})`);
    }

    const json = await res.json();
    return json.data;
  }

  /**
   * Deletes a custom food item.
   */
  async deleteCustomFood(id: string, token?: string): Promise<void> {
    const headers = await this.buildHeaders(token);
    const url = `${this.baseUrl}/foods/${id}`;

    const res = await fetch(url, { method: 'DELETE', headers });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || `Failed to delete custom food (${res.status})`);
    }
  }
}

export const defaultFoodApiClient = new FoodApiClient();
