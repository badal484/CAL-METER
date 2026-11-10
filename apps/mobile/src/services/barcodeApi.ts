import type { PackagedProductDto } from '@calmeter/contracts';

export interface BarcodeApiClientConfig {
  baseUrl?: string;
  getAuthToken?: () => Promise<string | null>;
}

export class BarcodeApiClient {
  private baseUrl: string;
  private getAuthToken?: () => Promise<string | null>;

  constructor(config?: BarcodeApiClientConfig) {
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
   * Looks up a packaged food product by barcode value.
   */
  async lookupBarcode(barcode: string, token?: string): Promise<PackagedProductDto> {
    const clean = barcode.replace(/[\s\-_]/g, '').trim();
    const headers = await this.buildHeaders(token);
    const url = `${this.baseUrl}/foods/barcode/${encodeURIComponent(clean)}`;

    const res = await fetch(url, { method: 'GET', headers });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const errorMsg =
        err.error?.message ||
        (res.status === 404
          ? `Product not found for barcode ${clean}`
          : `Barcode lookup failed (${res.status})`);
      const error = new Error(errorMsg);
      (error as any).status = res.status;
      (error as any).code = err.error?.code;
      throw error;
    }

    const json = await res.json();
    return json.data;
  }

  /**
   * Manually looks up a barcode via POST body.
   */
  async manualLookup(barcode: string, token?: string): Promise<PackagedProductDto> {
    const clean = barcode.replace(/[\s\-_]/g, '').trim();
    const headers = await this.buildHeaders(token);
    const url = `${this.baseUrl}/foods/barcode/lookup`;

    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ barcode: clean }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const errorMsg =
        err.error?.message ||
        (res.status === 404
          ? `Product not found for barcode ${clean}`
          : `Barcode lookup failed (${res.status})`);
      const error = new Error(errorMsg);
      (error as any).status = res.status;
      (error as any).code = err.error?.code;
      throw error;
    }

    const json = await res.json();
    return json.data;
  }
}

export const defaultBarcodeApiClient = new BarcodeApiClient();
