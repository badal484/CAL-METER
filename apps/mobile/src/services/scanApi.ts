import type {
  CreateScanRequest,
  CreateScanResponse,
  ScanDetailResponse,
  SubmitScanCorrection,
  ConfirmScanRequest,
  ConfirmScanResponse,
  CancelScanResponse,
} from '@calmeter/contracts';

export interface ScanApiClientConfig {
  baseUrl?: string;
  getAuthToken?: () => Promise<string | null>;
}

export class ScanApiClient {
  private baseUrl: string;
  private getAuthToken?: () => Promise<string | null>;

  constructor(config?: ScanApiClientConfig) {
    this.baseUrl = config?.baseUrl || 'http://localhost:4000/api/v1';
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
   * Initializes a new food scan session and returns upload credentials.
   */
  async createScan(request: CreateScanRequest, token?: string): Promise<CreateScanResponse> {
    const headers = await this.buildHeaders(token);
    const response = await fetch(`${this.baseUrl}/scans`, {
      method: 'POST',
      headers,
      body: JSON.stringify(request),
    });

    const json: any = await response.json();
    if (!response.ok || !json.success) {
      throw new Error(json.error?.message || `Failed to create scan (HTTP ${response.status})`);
    }
    return json.data;
  }

  /**
   * Uploads base64 image data to the scan session.
   */
  async uploadImageBase64(
    scanId: string,
    imageBase64: string,
    mimeType = 'image/jpeg',
    token?: string,
  ): Promise<ScanDetailResponse> {
    const headers = await this.buildHeaders(token);
    headers['Content-Type'] = mimeType;

    const response = await fetch(`${this.baseUrl}/scans/${scanId}/upload`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ imageBase64 }),
    });

    const json: any = await response.json();
    if (!response.ok || !json.success) {
      throw new Error(json.error?.message || `Failed to upload image (HTTP ${response.status})`);
    }
    return json.data;
  }

  /**
   * Submits the uploaded scan for AI recognition and matching.
   */
  async processScan(scanId: string, token?: string): Promise<ScanDetailResponse> {
    const headers = await this.buildHeaders(token);
    const response = await fetch(`${this.baseUrl}/scans/${scanId}/process`, {
      method: 'POST',
      headers,
    });

    const json: any = await response.json();
    if (!response.ok || !json.success) {
      throw new Error(json.error?.message || `Failed to process scan (HTTP ${response.status})`);
    }
    return json.data.scan || json.data;
  }

  /**
   * Retrieves current scan status, candidates, and calculated nutrition.
   */
  async getScan(scanId: string, token?: string): Promise<ScanDetailResponse> {
    const headers = await this.buildHeaders(token);
    const response = await fetch(`${this.baseUrl}/scans/${scanId}`, {
      method: 'GET',
      headers,
    });

    const json: any = await response.json();
    if (!response.ok || !json.success) {
      throw new Error(json.error?.message || `Failed to get scan (HTTP ${response.status})`);
    }
    return json.data;
  }

  /**
   * Submits user corrections to portions or matched foods.
   */
  async submitCorrections(
    scanId: string,
    corrections: SubmitScanCorrection,
    token?: string,
  ): Promise<ScanDetailResponse> {
    const headers = await this.buildHeaders(token);
    const response = await fetch(`${this.baseUrl}/scans/${scanId}/corrections`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(corrections),
    });

    const json: any = await response.json();
    if (!response.ok || !json.success) {
      throw new Error(
        json.error?.message || `Failed to submit corrections (HTTP ${response.status})`,
      );
    }
    return json.data;
  }

  /**
   * Confirms the meal and creates an entry in the user's food diary.
   */
  async confirmScan(
    scanId: string,
    request?: ConfirmScanRequest,
    token?: string,
  ): Promise<ConfirmScanResponse> {
    const headers = await this.buildHeaders(token);
    const response = await fetch(`${this.baseUrl}/scans/${scanId}/confirm`, {
      method: 'POST',
      headers,
      body: JSON.stringify(request || {}),
    });

    const json: any = await response.json();
    if (!response.ok || !json.success) {
      throw new Error(json.error?.message || `Failed to confirm scan (HTTP ${response.status})`);
    }
    return json.data;
  }

  /**
   * Cancels an active scan.
   */
  async cancelScan(scanId: string, token?: string): Promise<CancelScanResponse> {
    const headers = await this.buildHeaders(token);
    const response = await fetch(`${this.baseUrl}/scans/${scanId}/cancel`, {
      method: 'POST',
      headers,
    });

    const json: any = await response.json();
    if (!response.ok || !json.success) {
      throw new Error(json.error?.message || `Failed to cancel scan (HTTP ${response.status})`);
    }
    return json.data;
  }
}
