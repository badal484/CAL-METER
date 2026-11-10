import { describe, it, expect } from 'vitest';
import {
  validateAndSanitizeImage,
  detectMimeTypeFromMagicBytes,
  extractImageDimensions,
  stripExifMetadata,
  MAX_IMAGE_SIZE_BYTES,
} from '../src/storage/imageValidator.js';
import { DomainValidationError } from '@calmeter/shared';

// Helper to construct a minimal valid PNG buffer with custom dimensions
function createMockPngBuffer(width = 200, height = 200, extraMetadataChunk?: Buffer): Buffer {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  // IHDR: 4 bytes len (13), 4 bytes "IHDR", 13 bytes data, 4 bytes CRC
  const ihdr = Buffer.alloc(4 + 4 + 13 + 4);
  ihdr.writeUInt32BE(13, 0);
  ihdr.write('IHDR', 4, 'ascii');
  ihdr.writeUInt32BE(width, 8);
  ihdr.writeUInt32BE(height, 12);
  ihdr.writeUInt8(8, 16); // 8-bit
  ihdr.writeUInt8(2, 17); // Truecolor RGB
  ihdr.writeUInt8(0, 18); // Deflate
  ihdr.writeUInt8(0, 19); // Filter
  ihdr.writeUInt8(0, 20); // No interlace
  ihdr.writeUInt32BE(0x12345678, 21); // Dummy CRC

  // IEND chunk
  const iend = Buffer.alloc(12);
  iend.writeUInt32BE(0, 0);
  iend.write('IEND', 4, 'ascii');
  iend.writeUInt32BE(0xae426082, 8);

  // Pad dummy IDAT so buffer size is > 100 bytes
  const dummyData = Buffer.alloc(80, 0xaa);

  if (extraMetadataChunk) {
    return Buffer.concat([signature, ihdr, extraMetadataChunk, dummyData, iend]);
  }
  return Buffer.concat([signature, ihdr, dummyData, iend]);
}

// Helper to construct a minimal valid JPEG buffer with custom dimensions
function createMockJpegBuffer(width = 200, height = 200, includeExifApp1 = false): Buffer {
  const parts: Buffer[] = [];

  // SOI (Start of Image)
  parts.push(Buffer.from([0xff, 0xd8]));

  // APP0 (JFIF Header)
  const app0 = Buffer.from([
    0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01,
    0x00, 0x00,
  ]);
  parts.push(app0);

  // Optional APP1 (EXIF segment with mock GPS / device info)
  if (includeExifApp1) {
    const exifData = Buffer.from('Exif\0\0GPS_LAT_37_LONG_122_APPLE_IPHONE_16');
    const app1 = Buffer.alloc(4 + exifData.length);
    app1[0] = 0xff;
    app1[1] = 0xe1;
    app1.writeUInt16BE(2 + exifData.length, 2);
    exifData.copy(app1, 4);
    parts.push(app1);
  }

  // SOF0 (Start of Frame: 0xFFC0, length, precision 8, height, width, 1 component)
  const sof0 = Buffer.alloc(13);
  sof0[0] = 0xff;
  sof0[1] = 0xc0;
  sof0.writeUInt16BE(11, 2); // segment length
  sof0[4] = 8; // 8-bit precision
  sof0.writeUInt16BE(height, 5); // height
  sof0.writeUInt16BE(width, 7); // width
  sof0[9] = 1; // 1 component (grayscale)
  sof0[10] = 1;
  sof0[11] = 0x11;
  sof0[12] = 0;
  parts.push(sof0);

  // SOS (Start of Scan) & compressed data padding
  const sos = Buffer.from([0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f, 0x00]);
  parts.push(sos);

  // Compressed payload bytes to exceed 100 bytes min limit
  parts.push(Buffer.alloc(80, 0x55));

  // EOI (End of Image)
  parts.push(Buffer.from([0xff, 0xd9]));

  return Buffer.concat(parts);
}

describe('AI Image Ingestion, Validation & Privacy Sanitization', () => {
  it('validates and accepts a standard JPEG image payload', () => {
    const jpeg = createMockJpegBuffer(400, 300);
    const result = validateAndSanitizeImage(jpeg, 'image/jpeg');

    expect(result.mimeType).toBe('image/jpeg');
    expect(result.width).toBe(400);
    expect(result.height).toBe(300);
    expect(result.fileSizeBytes).toBe(jpeg.length);
    expect(result.sanitizedBuffer).toBeDefined();
  });

  it('validates and accepts a standard PNG image payload', () => {
    const png = createMockPngBuffer(800, 600);
    const result = validateAndSanitizeImage(png, 'image/png');

    expect(result.mimeType).toBe('image/png');
    expect(result.width).toBe(800);
    expect(result.height).toBe(600);
    expect(result.fileSizeBytes).toBe(png.length);
  });

  it('detects MIME type from magic bytes regardless of client header', () => {
    const png = createMockPngBuffer(300, 300);
    const detected = detectMimeTypeFromMagicBytes(png);
    expect(detected).toBe('image/png');

    const jpeg = createMockJpegBuffer(300, 300);
    const detectedJpeg = detectMimeTypeFromMagicBytes(jpeg);
    expect(detectedJpeg).toBe('image/jpeg');
  });

  it('rejects image when declared MIME type contradicts actual binary magic bytes', () => {
    const jpeg = createMockJpegBuffer(200, 200);

    expect(() => {
      validateAndSanitizeImage(jpeg, 'image/png');
    }).toThrow(DomainValidationError);
  });

  it('rejects unsupported or non-image file formats (PDF, GIF, plain text)', () => {
    const pdfBuffer = Buffer.concat([
      Buffer.from('%PDF-1.4 Mock PDF file that is not an image'),
      Buffer.alloc(100, 0x20),
    ]);
    expect(() => validateAndSanitizeImage(pdfBuffer)).toThrow(
      /Unsupported or malformed image format/,
    );

    const gifBuffer = Buffer.concat([
      Buffer.from('GIF89a\x01\x00\x01\x00\x80\x00\x00\xff\xff\xff\x00\x00\x00!'),
      Buffer.alloc(100, 0x20),
    ]);
    expect(() => validateAndSanitizeImage(gifBuffer)).toThrow(
      /Unsupported or malformed image format/,
    );

    const textBuffer = Buffer.concat([
      Buffer.from('<html><body>malicious payload with html and scripts</body></html>'),
      Buffer.alloc(100, 0x20),
    ]);
    expect(() => validateAndSanitizeImage(textBuffer)).toThrow(
      /Unsupported or malformed image format/,
    );
  });

  it('rejects image files smaller than minimum threshold (100 bytes)', () => {
    const tinyBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
    expect(() => validateAndSanitizeImage(tinyBuffer)).toThrow(/too small/);
  });

  it('rejects image files exceeding 10 MB limit', () => {
    // 10 MB + 1 byte
    const oversizedBuffer = Buffer.alloc(MAX_IMAGE_SIZE_BYTES + 1);
    oversizedBuffer[0] = 0xff;
    oversizedBuffer[1] = 0xd8;
    oversizedBuffer[2] = 0xff;

    expect(() => validateAndSanitizeImage(oversizedBuffer)).toThrow(
      /exceeds maximum allowable limit/,
    );
  });

  it('rejects images with dimensions below minimum recognition threshold (100x100)', () => {
    const smallPng = createMockPngBuffer(80, 80);
    expect(() => validateAndSanitizeImage(smallPng)).toThrow(
      /too small for accurate food recognition/,
    );

    const smallJpeg = createMockJpegBuffer(99, 120);
    expect(() => validateAndSanitizeImage(smallJpeg)).toThrow(
      /too small for accurate food recognition/,
    );
  });

  it('rejects images with absurd dimensions exceeding 8192px', () => {
    const hugePng = createMockPngBuffer(9000, 2000);
    expect(() => validateAndSanitizeImage(hugePng)).toThrow(/exceed maximum allowed dimension/);
  });

  it('strips sensitive EXIF metadata (GPS, camera serials) from JPEG images', () => {
    const jpegWithExif = createMockJpegBuffer(300, 300, true);
    expect(jpegWithExif.includes(Buffer.from('GPS_LAT'))).toBe(true);

    const { sanitizedBuffer, exifStripped } = stripExifMetadata(jpegWithExif, 'image/jpeg');

    expect(exifStripped).toBe(true);
    expect(sanitizedBuffer.includes(Buffer.from('GPS_LAT'))).toBe(false);
    expect(sanitizedBuffer.includes(Buffer.from('APPLE_IPHONE'))).toBe(false);

    // Verify sanitized buffer still retains valid JPEG structure & dimensions
    const dims = extractImageDimensions(sanitizedBuffer, 'image/jpeg');
    expect(dims).toEqual({ width: 300, height: 300 });
  });

  it('strips metadata chunks from PNG images', () => {
    const textChunk = Buffer.alloc(24);
    textChunk.writeUInt32BE(12, 0);
    textChunk.write('tEXt', 4, 'ascii');
    textChunk.write('Author=User', 8, 'ascii');
    textChunk.writeUInt32BE(0, 20);

    const pngWithMeta = createMockPngBuffer(400, 400, textChunk);
    expect(pngWithMeta.includes(Buffer.from('tEXt'))).toBe(true);

    const { sanitizedBuffer, exifStripped } = stripExifMetadata(pngWithMeta, 'image/png');
    expect(exifStripped).toBe(true);
    expect(sanitizedBuffer.includes(Buffer.from('tEXt'))).toBe(false);

    const dims = extractImageDimensions(sanitizedBuffer, 'image/png');
    expect(dims).toEqual({ width: 400, height: 400 });
  });
});
