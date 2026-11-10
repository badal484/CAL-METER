import { randomUUID } from 'node:crypto';
import { DomainValidationError } from '@calmeter/shared';

export interface PresignedUploadDetails {
  uploadUrl: string;
  storageKey: string;
  expiresInSeconds: number;
}

export interface IObjectStorageService {
  generateStorageKey(userId: string, scanId: string, extension?: string): string;
  generatePresignedUploadUrl(
    storageKey: string,
    mimeType: string,
    expiresInSeconds?: number,
  ): Promise<PresignedUploadDetails>;
  saveImage(storageKey: string, buffer: Buffer, mimeType: string): Promise<void>;
  getImage(storageKey: string): Promise<Buffer>;
  deleteImage(storageKey: string): Promise<void>;
  hasImage(storageKey: string): Promise<boolean>;
}

/**
 * High-performance in-memory and local mock storage service.
 * Simulates presigned S3/R2 direct uploads and provides secure object management.
 */
export class LocalObjectStorageService implements IObjectStorageService {
  private storage = new Map<string, { buffer: Buffer; mimeType: string; createdAt: Date }>();
  private presignedTokens = new Map<
    string,
    { storageKey: string; mimeType: string; expiresAt: Date }
  >();

  private baseUrl: string;

  constructor(baseUrl = 'http://localhost:4000/api/v1/scans') {
    this.baseUrl = baseUrl;
  }

  /**
   * Generates a safe server-side storage key.
   * Path: scans/<userId>/<scanId>.<ext>
   */
  generateStorageKey(userId: string, scanId: string, extension = 'jpg'): string {
    const cleanUserId = userId.replace(/[^a-zA-Z0-9-]/g, '');
    const cleanScanId = scanId.replace(/[^a-zA-Z0-9-]/g, '');
    const cleanExt = extension.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() || 'jpg';
    return `scans/${cleanUserId}/${cleanScanId}.${cleanExt}`;
  }

  async generatePresignedUploadUrl(
    storageKey: string,
    mimeType: string,
    expiresInSeconds = 300,
  ): Promise<PresignedUploadDetails> {
    const token = randomUUID();
    const expiresAt = new Date(Date.now() + expiresInSeconds * 1000);

    this.presignedTokens.set(token, {
      storageKey,
      mimeType,
      expiresAt,
    });

    const uploadUrl = `${this.baseUrl}/upload?token=${token}`;

    return {
      uploadUrl,
      storageKey,
      expiresInSeconds,
    };
  }

  /**
   * Resolves storage key from a presigned token and verifies expiry.
   */
  verifyUploadToken(token: string): { storageKey: string; mimeType: string } {
    const tokenData = this.presignedTokens.get(token);
    if (!tokenData) {
      throw new DomainValidationError('Invalid or expired upload token.');
    }

    if (new Date() > tokenData.expiresAt) {
      this.presignedTokens.delete(token);
      throw new DomainValidationError('Upload token has expired.');
    }

    return {
      storageKey: tokenData.storageKey,
      mimeType: tokenData.mimeType,
    };
  }

  async saveImage(storageKey: string, buffer: Buffer, mimeType: string): Promise<void> {
    this.storage.set(storageKey, {
      buffer,
      mimeType,
      createdAt: new Date(),
    });
  }

  async getImage(storageKey: string): Promise<Buffer> {
    const item = this.storage.get(storageKey);
    if (!item) {
      throw new DomainValidationError(`Image not found in storage: ${storageKey}`);
    }
    return item.buffer;
  }

  async deleteImage(storageKey: string): Promise<void> {
    this.storage.delete(storageKey);
  }

  async hasImage(storageKey: string): Promise<boolean> {
    return this.storage.has(storageKey);
  }

  clear(): void {
    this.storage.clear();
    this.presignedTokens.clear();
  }
}

// Global default storage service instance
export const defaultStorageService = new LocalObjectStorageService();
