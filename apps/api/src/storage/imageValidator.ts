import { DomainValidationError } from '@calmeter/shared';

export interface ValidatedImageInfo {
  sanitizedBuffer: Buffer;
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
  width: number;
  height: number;
  fileSizeBytes: number;
  exifStripped: boolean;
}

export const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
export const MIN_IMAGE_SIZE_BYTES = 100; // 100 bytes minimum to reject empty/trivial files
export const MIN_IMAGE_DIMENSION = 100; // 100px minimum width and height
export const MAX_IMAGE_DIMENSION = 8192; // 8192px maximum width and height

/**
 * Validates actual binary contents against file signatures (magic bytes),
 * checks file size, validates pixel dimensions, and strips EXIF metadata.
 */
export function validateAndSanitizeImage(
  buffer: Buffer,
  declaredMimeType?: string,
): ValidatedImageInfo {
  if (!buffer || !Buffer.isBuffer(buffer)) {
    throw new DomainValidationError('Invalid image payload: buffer is required.');
  }

  const fileSizeBytes = buffer.length;

  if (fileSizeBytes < MIN_IMAGE_SIZE_BYTES) {
    throw new DomainValidationError(
      `Image file size (${fileSizeBytes} bytes) is too small to be a valid image. Minimum is ${MIN_IMAGE_SIZE_BYTES} bytes.`,
    );
  }

  if (fileSizeBytes > MAX_IMAGE_SIZE_BYTES) {
    throw new DomainValidationError(
      `Image file size (${fileSizeBytes} bytes) exceeds maximum allowable limit of 10 MB.`,
    );
  }

  // Detect actual MIME type from magic bytes (never trust client header)
  const actualMimeType = detectMimeTypeFromMagicBytes(buffer);
  if (!actualMimeType) {
    throw new DomainValidationError(
      'Unsupported or malformed image format. Only JPEG, PNG, and WebP are supported.',
    );
  }

  // If client declared a MIME type, verify it matches the actual file content
  if (declaredMimeType && declaredMimeType.toLowerCase() !== actualMimeType) {
    throw new DomainValidationError(
      `Declared MIME type '${declaredMimeType}' does not match actual binary content (${actualMimeType}).`,
    );
  }

  // Extract dimensions
  const dimensions = extractImageDimensions(buffer, actualMimeType);
  if (!dimensions || dimensions.width <= 0 || dimensions.height <= 0) {
    throw new DomainValidationError('Corrupted image file: unable to read image dimensions.');
  }

  if (dimensions.width < MIN_IMAGE_DIMENSION || dimensions.height < MIN_IMAGE_DIMENSION) {
    throw new DomainValidationError(
      `Image dimensions (${dimensions.width}x${dimensions.height}) are too small for accurate food recognition. Minimum dimension is ${MIN_IMAGE_DIMENSION}x${MIN_IMAGE_DIMENSION}px.`,
    );
  }

  if (dimensions.width > MAX_IMAGE_DIMENSION || dimensions.height > MAX_IMAGE_DIMENSION) {
    throw new DomainValidationError(
      `Image dimensions (${dimensions.width}x${dimensions.height}) exceed maximum allowed dimension of ${MAX_IMAGE_DIMENSION}px.`,
    );
  }

  // Strip EXIF metadata for privacy preservation (GPS, camera serials, timestamps)
  const { sanitizedBuffer, exifStripped } = stripExifMetadata(buffer, actualMimeType);

  return {
    sanitizedBuffer,
    mimeType: actualMimeType,
    width: dimensions.width,
    height: dimensions.height,
    fileSizeBytes: sanitizedBuffer.length,
    exifStripped,
  };
}

/**
 * Inspects leading magic bytes to identify the actual image format.
 */
export function detectMimeTypeFromMagicBytes(
  buffer: Buffer,
): 'image/jpeg' | 'image/png' | 'image/webp' | null {
  if (buffer.length < 12) return null;

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return 'image/png';
  }

  // WebP: RIFF ... WEBP
  if (
    buffer[0] === 0x52 && // R
    buffer[1] === 0x49 && // I
    buffer[2] === 0x46 && // F
    buffer[3] === 0x46 && // F
    buffer[8] === 0x57 && // W
    buffer[9] === 0x45 && // E
    buffer[10] === 0x42 && // B
    buffer[11] === 0x50 // P
  ) {
    return 'image/webp';
  }

  return null;
}

/**
 * Extracts width and height from the image headers.
 */
export function extractImageDimensions(
  buffer: Buffer,
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp',
): { width: number; height: number } | null {
  try {
    if (mimeType === 'image/png') {
      if (buffer.length < 24) return null;
      const width = buffer.readUInt32BE(16);
      const height = buffer.readUInt32BE(20);
      return { width, height };
    }

    if (mimeType === 'image/jpeg') {
      let offset = 2; // Skip SOI marker 0xFFD8
      while (offset < buffer.length) {
        if (buffer[offset] !== 0xff) {
          offset++;
          continue;
        }

        const marker = buffer[offset + 1];

        // SOF markers: 0xC0 (SOF0 baseline), 0xC1 (SOF1 extended), 0xC2 (SOF2 progressive), 0xC3 (SOF3 lossless)
        if (marker === 0xc0 || marker === 0xc1 || marker === 0xc2 || marker === 0xc3) {
          if (offset + 8 >= buffer.length) return null;
          const height = buffer.readUInt16BE(offset + 5);
          const width = buffer.readUInt16BE(offset + 7);
          return { width, height };
        }

        // SOS (Start of Scan) or EOI (End of Image) - stop header parsing
        if (marker === 0xda || marker === 0xd9) {
          break;
        }

        // Variable length marker segment: read length and advance
        if (offset + 3 >= buffer.length) break;
        const segmentLength = buffer.readUInt16BE(offset + 2);
        offset += 2 + segmentLength;
      }
      return null;
    }

    if (mimeType === 'image/webp') {
      // Check for VP8 (lossy), VP8L (lossless), or VP8X (extended)
      if (buffer.length < 30) return null;
      const chunkType = buffer.slice(12, 16).toString('ascii');

      if (chunkType === 'VP8 ') {
        // Keyframe signature: 0x9D 0x01 0x2A
        const keyframeOffset = 23;
        if (
          buffer[keyframeOffset] === 0x9d &&
          buffer[keyframeOffset + 1] === 0x01 &&
          buffer[keyframeOffset + 2] === 0x2a
        ) {
          const width = buffer.readUInt16LE(keyframeOffset + 3) & 0x3fff;
          const height = buffer.readUInt16LE(keyframeOffset + 5) & 0x3fff;
          return { width, height };
        }
      } else if (chunkType === 'VP8L') {
        // Lossless VP8L header
        if (buffer[20] === 0x2f && buffer.length >= 25) {
          const b1 = buffer[21]!;
          const b2 = buffer[22]!;
          const b3 = buffer[23]!;
          const b4 = buffer[24]!;
          const width = 1 + (((b2 & 0x3f) << 8) | b1);
          const height = 1 + (((b4 & 0x0f) << 10) | (b3 << 2) | ((b2 & 0xc0) >> 6));
          return { width, height };
        }
      } else if (chunkType === 'VP8X' && buffer.length >= 30) {
        // Extended VP8X header (24-bit width at 24, 24-bit height at 27)
        const width = 1 + (buffer[24]! | (buffer[25]! << 8) | (buffer[26]! << 16));
        const height = 1 + (buffer[27]! | (buffer[28]! << 8) | (buffer[29]! << 16));
        return { width, height };
      }
      return null;
    }
  } catch {
    return null;
  }

  return null;
}

/**
 * Strips EXIF metadata segments (e.g. APP1 markers in JPEG or eXIf chunks in PNG)
 * to ensure user privacy and remove location/device identifiers.
 */
export function stripExifMetadata(
  buffer: Buffer,
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp',
): { sanitizedBuffer: Buffer; exifStripped: boolean } {
  if (mimeType === 'image/jpeg') {
    let exifFound = false;
    const segments: Buffer[] = [buffer.slice(0, 2)]; // Keep SOI marker 0xFFD8
    let offset = 2;

    while (offset < buffer.length) {
      if (buffer[offset] !== 0xff) {
        // Copy remainder of the buffer (scan data)
        segments.push(buffer.slice(offset));
        break;
      }

      const marker = buffer[offset + 1];
      if (marker === undefined) {
        segments.push(buffer.slice(offset));
        break;
      }

      // SOS (Start of Scan) - remainder of file is compressed image data
      if (marker === 0xda) {
        segments.push(buffer.slice(offset));
        break;
      }

      // Standalone markers without length: RST0-7, SOI, EOI
      if ((marker >= 0xd0 && marker <= 0xd7) || marker === 0xd8 || marker === 0xd9) {
        segments.push(buffer.slice(offset, offset + 2));
        offset += 2;
        continue;
      }

      if (offset + 3 >= buffer.length) {
        segments.push(buffer.slice(offset));
        break;
      }

      const length = buffer.readUInt16BE(offset + 2);
      const segmentEnd = offset + 2 + length;

      // APP1 marker (0xFFE1) carries EXIF / XMP metadata
      if (marker === 0xe1) {
        exifFound = true;
        offset = segmentEnd; // Omit this segment from output
        continue;
      }

      segments.push(buffer.slice(offset, segmentEnd));
      offset = segmentEnd;
    }

    if (exifFound) {
      return { sanitizedBuffer: Buffer.concat(segments), exifStripped: true };
    }
    return { sanitizedBuffer: buffer, exifStripped: false };
  }

  // PNG: Strip eXIf, tEXt, zTXt, iTXt chunks if present
  if (mimeType === 'image/png') {
    let exifFound = false;
    const chunks: Buffer[] = [buffer.slice(0, 8)]; // PNG Signature
    let offset = 8;

    while (offset + 8 <= buffer.length) {
      const length = buffer.readUInt32BE(offset);
      const chunkType = buffer.slice(offset + 4, offset + 8).toString('ascii');
      const totalChunkLength = 12 + length; // length (4) + type (4) + data (len) + crc (4)

      if (offset + totalChunkLength > buffer.length) {
        chunks.push(buffer.slice(offset));
        break;
      }

      // Metadata chunk types to remove
      if (['eXIf', 'tEXt', 'zTXt', 'iTXt'].includes(chunkType)) {
        exifFound = true;
        offset += totalChunkLength;
        continue;
      }

      chunks.push(buffer.slice(offset, offset + totalChunkLength));
      offset += totalChunkLength;

      if (chunkType === 'IEND') break;
    }

    if (exifFound) {
      return { sanitizedBuffer: Buffer.concat(chunks), exifStripped: true };
    }
    return { sanitizedBuffer: buffer, exifStripped: false };
  }

  // WebP: default pass-through
  return { sanitizedBuffer: buffer, exifStripped: false };
}
