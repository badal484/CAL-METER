import type {
  UserProfileDto,
  UpdateUserProfile,
  OnboardingData,
  OnboardingCompleteResponse,
} from '@calmeter/contracts';

export interface ProfileApiClientConfig {
  baseUrl?: string;
  getAuthToken?: () => Promise<string | null>;
}

export interface WeightLogDto {
  id: string;
  userId: string;
  weightKg: number;
  loggedAt: string;
  notes?: string | null;
}

export class ProfileApiClient {
  private baseUrl: string;
  private getAuthToken?: () => Promise<string | null>;

  constructor(config?: ProfileApiClientConfig) {
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
   * Fetches the authenticated user's nutrition profile.
   */
  async getProfile(token?: string): Promise<UserProfileDto | null> {
    const headers = await this.buildHeaders(token);
    const url = `${this.baseUrl}/profile`;

    const res = await fetch(url, { method: 'GET', headers });
    if (res.status === 404) {
      return null;
    }
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as any;
      throw new Error(err.error?.message || `Failed to fetch profile (status ${res.status})`);
    }

    const json = (await res.json()) as any;
    return json.data as UserProfileDto;
  }

  /**
   * Updates the authenticated user's nutrition profile biometrics and preferences.
   */
  async updateProfile(data: UpdateUserProfile, token?: string): Promise<UserProfileDto> {
    const headers = await this.buildHeaders(token);
    const url = `${this.baseUrl}/profile`;

    const res = await fetch(url, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as any;
      throw new Error(err.error?.message || `Failed to update profile (status ${res.status})`);
    }

    const json = (await res.json()) as any;
    return json.data as UserProfileDto;
  }

  /**
   * Completes the multi-step onboarding journey atomically.
   */
  async completeOnboarding(
    data: OnboardingData,
    token?: string,
  ): Promise<OnboardingCompleteResponse['data']> {
    const headers = await this.buildHeaders(token);
    const url = `${this.baseUrl}/onboarding/complete`;

    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as any;
      const detailsMsg = err.error?.details
        ? err.error.details.map((d: any) => `${d.field ? d.field + ': ' : ''}${d.issue}`).join(', ')
        : '';
      throw new Error(
        detailsMsg || err.error?.message || `Failed to complete onboarding (status ${res.status})`,
      );
    }

    const json = (await res.json()) as any;
    return json.data as OnboardingCompleteResponse['data'];
  }

  /**
   * Logs a weight tracking entry.
   */
  async logWeight(weightKg: number, notes?: string, token?: string): Promise<WeightLogDto> {
    const headers = await this.buildHeaders(token);
    const url = `${this.baseUrl}/tracking/weight`;

    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ weightKg, notes }),
    });

    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as any;
      throw new Error(err.error?.message || `Failed to log weight (status ${res.status})`);
    }

    const json = (await res.json()) as any;
    return json.data as WeightLogDto;
  }

  /**
   * Fetches weight tracking history.
   */
  async getWeightHistory(token?: string): Promise<WeightLogDto[]> {
    const headers = await this.buildHeaders(token);
    const url = `${this.baseUrl}/tracking/weight`;

    const res = await fetch(url, { method: 'GET', headers });
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as any;
      throw new Error(
        err.error?.message || `Failed to fetch weight history (status ${res.status})`,
      );
    }

    const json = (await res.json()) as any;
    return json.data as WeightLogDto[];
  }

  /**
   * Requests account deletion.
   * Required for Apple App Store Guideline 5.1.1(v), Google Play, and DPDP/GDPR compliance.
   */
  async deleteAccount(token?: string): Promise<{ success: boolean; scheduledPurgeAt: string }> {
    const headers = await this.buildHeaders(token);
    const url = `${this.baseUrl}/profile`;

    const res = await fetch(url, { method: 'DELETE', headers });
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as any;
      throw new Error(err.error?.message || `Failed to delete account (status ${res.status})`);
    }

    const json = (await res.json()) as any;
    return json.data;
  }
}
