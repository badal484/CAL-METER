import type {
  LogWeightDto,
  UpdateWeightLogDto,
  WeightLogDto,
  WeightProgressSummaryDto,
  LogWaterDto,
  UpdateWaterLogDto,
  WaterLogDto,
  DailyWaterSummaryDto,
  LogExerciseDto,
  UpdateExerciseLogDto,
  ExerciseLogDto,
  ProgressQueryDto,
  ProgressReportDto,
} from '@calmeter/contracts';

export interface TrackingApiClientConfig {
  baseUrl?: string;
  getAuthToken?: () => Promise<string | null>;
}

export class TrackingApiClient {
  private baseUrl: string;
  private getAuthToken?: () => Promise<string | null>;

  constructor(config?: TrackingApiClientConfig) {
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

  // ============================================================================
  // WEIGHT TRACKING
  // ============================================================================

  async logWeight(data: LogWeightDto, token?: string): Promise<WeightLogDto> {
    const headers = await this.buildHeaders(token);
    const res = await fetch(`${this.baseUrl}/tracking/weight`, {
      method: 'POST',
      headers,
      body: JSON.stringify(data),
    });
    return this.handleResponse<WeightLogDto>(res, 'Failed to log weight');
  }

  async getWeightHistory(
    options?: { startDate?: string; endDate?: string; limit?: number },
    token?: string,
  ): Promise<WeightLogDto[]> {
    const headers = await this.buildHeaders(token);
    const params = new URLSearchParams();
    if (options?.startDate) params.set('startDate', options.startDate);
    if (options?.endDate) params.set('endDate', options.endDate);
    if (options?.limit) params.set('limit', String(options.limit));

    const qs = params.toString() ? `?${params.toString()}` : '';
    const res = await fetch(`${this.baseUrl}/tracking/weight${qs}`, {
      method: 'GET',
      headers,
    });
    return this.handleResponse<WeightLogDto[]>(res, 'Failed to fetch weight history');
  }

  async getWeightSummary(
    options?: { startDate?: string; endDate?: string },
    token?: string,
  ): Promise<WeightProgressSummaryDto> {
    const headers = await this.buildHeaders(token);
    const params = new URLSearchParams();
    if (options?.startDate) params.set('startDate', options.startDate);
    if (options?.endDate) params.set('endDate', options.endDate);

    const qs = params.toString() ? `?${params.toString()}` : '';
    const res = await fetch(`${this.baseUrl}/tracking/weight/summary${qs}`, {
      method: 'GET',
      headers,
    });
    return this.handleResponse<WeightProgressSummaryDto>(res, 'Failed to fetch weight summary');
  }

  async updateWeightLog(
    id: string,
    data: UpdateWeightLogDto,
    token?: string,
  ): Promise<WeightLogDto> {
    const headers = await this.buildHeaders(token);
    const res = await fetch(`${this.baseUrl}/tracking/weight/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(data),
    });
    return this.handleResponse<WeightLogDto>(res, 'Failed to update weight entry');
  }

  async deleteWeightLog(
    id: string,
    token?: string,
  ): Promise<{ success: boolean; message: string }> {
    const headers = await this.buildHeaders(token);
    const res = await fetch(`${this.baseUrl}/tracking/weight/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers,
    });
    return this.handleResponse<{ success: boolean; message: string }>(
      res,
      'Failed to delete weight entry',
    );
  }

  // ============================================================================
  // WATER TRACKING
  // ============================================================================

  async logWater(data: LogWaterDto, token?: string): Promise<WaterLogDto> {
    const headers = await this.buildHeaders(token);
    const res = await fetch(`${this.baseUrl}/tracking/water`, {
      method: 'POST',
      headers,
      body: JSON.stringify(data),
    });
    return this.handleResponse<WaterLogDto>(res, 'Failed to log water intake');
  }

  async getWaterSummaryForDate(date: string, token?: string): Promise<DailyWaterSummaryDto> {
    const headers = await this.buildHeaders(token);
    const res = await fetch(`${this.baseUrl}/tracking/water/summary/${encodeURIComponent(date)}`, {
      method: 'GET',
      headers,
    });
    return this.handleResponse<DailyWaterSummaryDto>(res, 'Failed to fetch daily water summary');
  }

  async getWaterEntriesForDate(date: string, token?: string): Promise<WaterLogDto[]> {
    const headers = await this.buildHeaders(token);
    const res = await fetch(`${this.baseUrl}/tracking/water/${encodeURIComponent(date)}`, {
      method: 'GET',
      headers,
    });
    return this.handleResponse<WaterLogDto[]>(res, 'Failed to fetch water entries');
  }

  async updateWaterLog(id: string, data: UpdateWaterLogDto, token?: string): Promise<WaterLogDto> {
    const headers = await this.buildHeaders(token);
    const res = await fetch(`${this.baseUrl}/tracking/water/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(data),
    });
    return this.handleResponse<WaterLogDto>(res, 'Failed to update water entry');
  }

  async deleteWaterLog(id: string, token?: string): Promise<{ success: boolean; message: string }> {
    const headers = await this.buildHeaders(token);
    const res = await fetch(`${this.baseUrl}/tracking/water/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers,
    });
    return this.handleResponse<{ success: boolean; message: string }>(
      res,
      'Failed to delete water entry',
    );
  }

  // ============================================================================
  // EXERCISE TRACKING
  // ============================================================================

  async logExercise(data: LogExerciseDto, token?: string): Promise<ExerciseLogDto> {
    const headers = await this.buildHeaders(token);
    const res = await fetch(`${this.baseUrl}/tracking/exercise`, {
      method: 'POST',
      headers,
      body: JSON.stringify(data),
    });
    return this.handleResponse<ExerciseLogDto>(res, 'Failed to log exercise activity');
  }

  async getExercises(
    options?: { date?: string; startDate?: string; endDate?: string; limit?: number },
    token?: string,
  ): Promise<ExerciseLogDto[]> {
    const headers = await this.buildHeaders(token);
    const params = new URLSearchParams();
    if (options?.date) params.set('date', options.date);
    if (options?.startDate) params.set('startDate', options.startDate);
    if (options?.endDate) params.set('endDate', options.endDate);
    if (options?.limit) params.set('limit', String(options.limit));

    const qs = params.toString() ? `?${params.toString()}` : '';
    const res = await fetch(`${this.baseUrl}/tracking/exercise${qs}`, {
      method: 'GET',
      headers,
    });
    return this.handleResponse<ExerciseLogDto[]>(res, 'Failed to fetch exercise activities');
  }

  async updateExerciseLog(
    id: string,
    data: UpdateExerciseLogDto,
    token?: string,
  ): Promise<ExerciseLogDto> {
    const headers = await this.buildHeaders(token);
    const res = await fetch(`${this.baseUrl}/tracking/exercise/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(data),
    });
    return this.handleResponse<ExerciseLogDto>(res, 'Failed to update exercise activity');
  }

  async deleteExerciseLog(
    id: string,
    token?: string,
  ): Promise<{ success: boolean; message: string }> {
    const headers = await this.buildHeaders(token);
    const res = await fetch(`${this.baseUrl}/tracking/exercise/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers,
    });
    return this.handleResponse<{ success: boolean; message: string }>(
      res,
      'Failed to delete exercise activity',
    );
  }

  // ============================================================================
  // PROGRESS REPORT
  // ============================================================================

  async getProgressReport(query?: ProgressQueryDto, token?: string): Promise<ProgressReportDto> {
    const headers = await this.buildHeaders(token);
    const params = new URLSearchParams();
    if (query?.startDate) params.set('startDate', query.startDate);
    if (query?.endDate) params.set('endDate', query.endDate);
    if (query?.days) params.set('days', String(query.days));

    const qs = params.toString() ? `?${params.toString()}` : '';
    const res = await fetch(`${this.baseUrl}/tracking/progress${qs}`, {
      method: 'GET',
      headers,
    });
    return this.handleResponse<ProgressReportDto>(res, 'Failed to fetch progress report');
  }
}

export const defaultTrackingApiClient = new TrackingApiClient();
