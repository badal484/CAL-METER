import type { PackagedProductDto } from '@calmeter/contracts';

export interface IBarcodeDataProvider {
  readonly providerName: string;
  lookupBarcode(barcode: string, currentUserId?: string): Promise<PackagedProductDto | null>;
}
