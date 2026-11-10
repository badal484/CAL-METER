import { describe, it, expect } from 'vitest';
import {
  calculateGs1CheckDigit,
  isValidGs1Checksum,
  expandUpcEToUpcA,
  validateBarcode,
  detectBarcodeFormat,
  BarcodeFormat,
} from '../src/index.js';

describe('GS1 Barcode Validation & Checksum Calculations', () => {
  describe('calculateGs1CheckDigit', () => {
    it('calculates correct check digit for 12-digit data (EAN-13)', () => {
      // 590123412345 -> 7
      expect(calculateGs1CheckDigit('590123412345')).toBe(7);
      // 890103082548 -> 4 (e.g. Parle-G Indian packaged product)
      expect(calculateGs1CheckDigit('890103082548')).toBe(4);
    });

    it('calculates correct check digit for 11-digit data (UPC-A)', () => {
      // 73762806450 -> 2
      expect(calculateGs1CheckDigit('73762806450')).toBe(2);
      // 01111000001 -> 9
      expect(calculateGs1CheckDigit('01111000001')).toBe(9);
    });

    it('calculates correct check digit for 7-digit data (EAN-8)', () => {
      // 9638507 -> 4
      expect(calculateGs1CheckDigit('9638507')).toBe(4);
    });

    it('throws when non-numeric characters are passed', () => {
      expect(() => calculateGs1CheckDigit('123A56')).toThrow();
    });
  });

  describe('isValidGs1Checksum', () => {
    it('returns true for valid EAN-13 barcodes', () => {
      expect(isValidGs1Checksum('5901234123457')).toBe(true);
      expect(isValidGs1Checksum('8901030825484')).toBe(true);
      expect(isValidGs1Checksum('0737628064502')).toBe(true); // UPC-A as EAN-13
    });

    it('returns false for invalid EAN-13 check digit', () => {
      expect(isValidGs1Checksum('5901234123450')).toBe(false);
      expect(isValidGs1Checksum('8901030825489')).toBe(false);
    });

    it('returns true for valid UPC-A barcodes', () => {
      expect(isValidGs1Checksum('737628064502')).toBe(true);
      expect(isValidGs1Checksum('011110000019')).toBe(true);
    });

    it('returns false for invalid UPC-A check digit', () => {
      expect(isValidGs1Checksum('737628064509')).toBe(false);
    });

    it('returns true for valid EAN-8 barcodes', () => {
      expect(isValidGs1Checksum('96385074')).toBe(true);
    });

    it('returns false for invalid EAN-8 check digit', () => {
      expect(isValidGs1Checksum('96385071')).toBe(false);
    });
  });

  describe('expandUpcEToUpcA', () => {
    it('expands UPC-E pattern ending in 0, 1, 2', () => {
      // 01234505 -> 012000003455
      const expanded = expandUpcEToUpcA('01234505');
      expect(expanded).toBe('012000003455');
      expect(isValidGs1Checksum(expanded!)).toBe(true);
    });

    it('expands UPC-E pattern ending in 3', () => {
      // 0123453 -> manufacturer 012300, product 00045, check 1
      const expanded = expandUpcEToUpcA('0123453');
      expect(expanded).toBe('012300000451');
      expect(isValidGs1Checksum(expanded!)).toBe(true);
    });

    it('expands UPC-E pattern ending in 4', () => {
      // 0123454 -> manufacturer 012340, product 00005, check 3
      const expanded = expandUpcEToUpcA('0123454');
      expect(expanded).toBe('012340000053');
      expect(isValidGs1Checksum(expanded!)).toBe(true);
    });

    it('expands UPC-E pattern ending in 5..9', () => {
      // 0123457 -> manufacturer 012345, product 00007, check 2
      const expanded = expandUpcEToUpcA('0123457');
      expect(expanded).toBe('012345000072');
      expect(isValidGs1Checksum(expanded!)).toBe(true);
    });
  });

  describe('validateBarcode - End-to-end validation', () => {
    it('validates a correct EAN-13 barcode', () => {
      const res = validateBarcode('8901030825484');
      expect(res.isValid).toBe(true);
      expect(res.format).toBe(BarcodeFormat.EAN_13);
      expect(res.normalizedBarcode).toBe('8901030825484');
      expect(res.error).toBeUndefined();
    });

    it('rejects an EAN-13 barcode with invalid check digit', () => {
      const res = validateBarcode('8901030825480');
      expect(res.isValid).toBe(false);
      expect(res.format).toBe(BarcodeFormat.EAN_13);
      expect(res.error).toContain('Invalid EAN-13 check digit');
    });

    it('validates a correct UPC-A barcode', () => {
      const res = validateBarcode('737628064502');
      expect(res.isValid).toBe(true);
      expect(res.format).toBe(BarcodeFormat.UPC_A);
      expect(res.normalizedBarcode).toBe('737628064502');
    });

    it('rejects a UPC-A barcode with invalid check digit', () => {
      const res = validateBarcode('737628064508');
      expect(res.isValid).toBe(false);
      expect(res.format).toBe(BarcodeFormat.UPC_A);
      expect(res.error).toContain('Invalid UPC-A check digit');
    });

    it('validates a correct EAN-8 barcode', () => {
      const res = validateBarcode('96385074');
      expect(res.isValid).toBe(true);
      expect(res.format).toBe(BarcodeFormat.EAN_8);
    });

    it('validates a valid UPC-E barcode and populates expandedBarcode', () => {
      const res = validateBarcode('01234505');
      expect(res.isValid).toBe(true);
      expect(res.format).toBe(BarcodeFormat.UPC_E);
      expect(res.expandedBarcode).toBe('012000003455');
    });

    it('validates Code 128 format alphanumeric barcodes', () => {
      const res = validateBarcode('ITEM-PKG-9821');
      expect(res.isValid).toBe(true);
      expect(res.format).toBe(BarcodeFormat.CODE_128);
    });

    it('rejects empty and whitespace inputs', () => {
      expect(validateBarcode('').isValid).toBe(false);
      expect(validateBarcode('   ').isValid).toBe(false);
      expect(validateBarcode(null).isValid).toBe(false);
      expect(validateBarcode(undefined).isValid).toBe(false);
    });

    it('rejects barcodes exceeding 64 characters', () => {
      const longBarcode = '1'.repeat(65);
      const res = validateBarcode(longBarcode);
      expect(res.isValid).toBe(false);
      expect(res.error).toContain('exceeds maximum allowed length');
    });

    it('normalizes formatted barcodes with spaces or hyphens', () => {
      const res = validateBarcode(' 890-1030 825484 ');
      expect(res.isValid).toBe(true);
      expect(res.normalizedBarcode).toBe('8901030825484');
    });
  });

  describe('detectBarcodeFormat', () => {
    it('detects EAN-13, UPC-A, and EAN-8 accurately', () => {
      expect(detectBarcodeFormat('8901030825484')).toBe(BarcodeFormat.EAN_13);
      expect(detectBarcodeFormat('737628064502')).toBe(BarcodeFormat.UPC_A);
      expect(detectBarcodeFormat('96385074')).toBe(BarcodeFormat.EAN_8);
      expect(detectBarcodeFormat('CODE128TEST')).toBe(BarcodeFormat.CODE_128);
    });
  });
});
