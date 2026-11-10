import type {
  RegisterDeviceTokenInput,
  UpdateNotificationPreferenceInput,
  NotificationPreferenceData,
  NotificationHistoryListResponse,
  SendTestNotificationInput,
} from '@calmeter/contracts';

export interface NotificationApiClientConfig {
  baseUrl?: string;
  getAuthToken?: () => Promise<string | null>;
}

export class NotificationApiClient {
  private baseUrl: string;
  private getAuthToken?: () => Promise<string | null>;

  constructor(config?: NotificationApiClientConfig) {
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

  async registerDeviceToken(
    input: RegisterDeviceTokenInput,
    tokenOverride?: string,
  ): Promise<{ id: string; platform: string; isActive: boolean; updatedAt: string }> {
    const headers = await this.buildHeaders(tokenOverride);
    const res = await fetch(`${this.baseUrl}/notifications/device-token`, {
      method: 'POST',
      headers,
      body: JSON.stringify(input),
    });
    return this.handleResponse(res, 'Failed to register device token');
  }

  async deactivateDeviceToken(token: string, tokenOverride?: string): Promise<void> {
    const headers = await this.buildHeaders(tokenOverride);
    const res = await fetch(`${this.baseUrl}/notifications/device-token`, {
      method: 'DELETE',
      headers,
      body: JSON.stringify({ token }),
    });
    return this.handleResponse(res, 'Failed to deactivate device token');
  }

  async getPreferences(tokenOverride?: string): Promise<NotificationPreferenceData> {
    const headers = await this.buildHeaders(tokenOverride);
    const res = await fetch(`${this.baseUrl}/notifications/preferences`, {
      method: 'GET',
      headers,
    });
    return this.handleResponse(res, 'Failed to load notification preferences');
  }

  async updatePreferences(
    input: UpdateNotificationPreferenceInput,
    tokenOverride?: string,
  ): Promise<NotificationPreferenceData> {
    const headers = await this.buildHeaders(tokenOverride);
    const res = await fetch(`${this.baseUrl}/notifications/preferences`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(input),
    });
    return this.handleResponse(res, 'Failed to update notification preferences');
  }

  async getHistory(limit = 50, tokenOverride?: string): Promise<NotificationHistoryListResponse> {
    const headers = await this.buildHeaders(tokenOverride);
    const res = await fetch(`${this.baseUrl}/notifications/history?limit=${limit}`, {
      method: 'GET',
      headers,
    });
    return this.handleResponse(res, 'Failed to load notification history');
  }

  async sendTestNotification(
    input: SendTestNotificationInput,
    tokenOverride?: string,
  ): Promise<any> {
    const headers = await this.buildHeaders(tokenOverride);
    const res = await fetch(`${this.baseUrl}/notifications/test`, {
      method: 'POST',
      headers,
      body: JSON.stringify(input),
    });
    return this.handleResponse(res, 'Failed to send test notification');
  }
}

export const defaultNotificationApi = new NotificationApiClient();
