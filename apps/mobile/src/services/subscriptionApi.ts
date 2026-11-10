import type { SubscriptionStatusResponseDto, FeatureAccessResponseDto } from '@calmeter/contracts';
import { FeatureKey } from '@calmeter/shared';

export interface SubscriptionApiClientConfig {
  baseUrl?: string;
  getAuthToken?: () => Promise<string | null>;
}

export class SubscriptionApiClient {
  private baseUrl: string;
  private getAuthToken?: () => Promise<string | null>;

  constructor(config?: SubscriptionApiClientConfig) {
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
   * Retrieves current authoritative subscription status from backend.
   */
  async getSubscriptionStatus(tokenOverride?: string): Promise<SubscriptionStatusResponseDto> {
    const headers = await this.buildHeaders(tokenOverride);
    const res = await fetch(`${this.baseUrl}/subscriptions/status`, {
      method: 'GET',
      headers,
    });

    return this.handleResponse<SubscriptionStatusResponseDto>(
      res,
      'Failed to retrieve subscription status',
    );
  }

  /**
   * Syncs user ID with backend subscription record.
   */
  async syncSubscription(
    appUserId?: string,
    tokenOverride?: string,
  ): Promise<SubscriptionStatusResponseDto> {
    const headers = await this.buildHeaders(tokenOverride);
    const res = await fetch(`${this.baseUrl}/subscriptions/sync`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ appUserId }),
    });

    return this.handleResponse<SubscriptionStatusResponseDto>(
      res,
      'Failed to synchronize subscription',
    );
  }

  /**
   * Checks whether the user can access a specific feature or history timeframe.
   */
  async checkFeatureAccess(
    feature: FeatureKey,
    historyDays?: number,
    tokenOverride?: string,
  ): Promise<FeatureAccessResponseDto> {
    const headers = await this.buildHeaders(tokenOverride);
    const query = new URLSearchParams({ feature });
    if (historyDays !== undefined) {
      query.set('historyDays', String(historyDays));
    }

    const res = await fetch(`${this.baseUrl}/subscriptions/check-access?${query.toString()}`, {
      method: 'GET',
      headers,
    });

    return this.handleResponse<FeatureAccessResponseDto>(res, 'Failed to verify feature access');
  }
}
