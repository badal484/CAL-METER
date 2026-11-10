import { BarcodeFormat } from '../constants/enums.js';

export interface BarcodeValidationResult {
  isValid: boolean;
  format: BarcodeFormat;
  normalizedBarcode: string;
  error?: string;
  expandedBarcode?: string; // e.g. for UPC-E -> UPC-A
}

/**
 * Calculates the GS1 Modulo-10 check digit for standard numeric barcodes
 * (EAN-13, EAN-8, UPC-A, etc.).
 *
 * Weight alternates between 3 and 1 starting from the digit immediately to the
 * left of the check digit (right to left).
 */
export function calculateGs1CheckDigit(digitsWithoutCheck: string): number {
  if (!/^\d+$/.test(digitsWithoutCheck)) {
    throw new Error('Barcode data digits must be strictly numeric');
  }

  let sum = 0;
  // Starting from rightmost data digit, alternating weights: 3, 1, 3, 1...
  let weight = 3;
  for (let i = digitsWithoutCheck.length - 1; i >= 0; i--) {
    sum += Number(digitsWithoutCheck[i]) * weight;
    weight = weight === 3 ? 1 : 3;
  }

  return (10 - (sum % 10)) % 10;
}

/**
 * Validates whether a barcode's final digit matches the GS1 Modulo-10 checksum.
 */
export function isValidGs1Checksum(barcode: string): boolean {
  if (!/^\d{8}$|^\d{12}$|^\d{13}$|^\d{14}$/.test(barcode)) {
    return false;
  }

  const dataDigits = barcode.slice(0, -1);
  const checkDigit = Number(barcode.slice(-1));
  const expectedCheck = calculateGs1CheckDigit(dataDigits);

  return checkDigit === expectedCheck;
}

/**
 * Expands a 6, 7, or 8-digit UPC-E string to a standard 12-digit UPC-A string.
 * UPC-E format: [numberSystem (0 or 1)] + [6 data digits] + [checkDigit]
 */
export function expandUpcEToUpcA(upcE: string): string | null {
  const clean = upcE.trim();
  if (!/^\d{6,8}$/.test(clean)) return null;

  let numSystem = '0';
  let body = clean;
  let checkDigit: string | null = null;

  if (clean.length === 8) {
    numSystem = clean.charAt(0);
    body = clean.slice(1, 7);
    checkDigit = clean.charAt(7);
  } else if (clean.length === 7) {
    numSystem = clean.charAt(0);
    body = clean.slice(1);
  }

  if (numSystem !== '0' && numSystem !== '1') return null;

  const d1 = body.charAt(0);
  const d2 = body.charAt(1);
  const d3 = body.charAt(2);
  const d4 = body.charAt(3);
  const d5 = body.charAt(4);
  const d6 = body.charAt(5);

  let mfg = '';
  let prod = '';

  switch (d6) {
    case '0':
    case '1':
    case '2':
      mfg = `${d1}${d2}${d6}00`;
      prod = `00${d3}${d4}${d5}`;
      break;
    case '3':
      mfg = `${d1}${d2}${d3}00`;
      prod = `000${d4}${d5}`;
      break;
    case '4':
      mfg = `${d1}${d2}${d3}${d4}0`;
      prod = `0000${d5}`;
      break;
    case '5':
    case '6':
    case '7':
    case '8':
    case '9':
      mfg = `${d1}${d2}${d3}${d4}${d5}`;
      prod = `0000${d6}`;
      break;
    default:
      return null;
  }

  const upcWithoutCheck = `${numSystem}${mfg}${prod}`;
  const calculatedCheck = calculateGs1CheckDigit(upcWithoutCheck);

  if (checkDigit !== null && Number(checkDigit) !== calculatedCheck) {
    return null;
  }

  return `${upcWithoutCheck}${calculatedCheck}`;
}

/**
 * Normalizes barcode input (stripping whitespace, hyphens, and leading zero for 13-digit EAN-13 when representing UPC-A if desired).
 */
export function normalizeBarcode(raw: string): string {
  return raw.replace(/[\s\-_]/g, '').trim();
}

/**
 * Detects the specific barcode format based on structure, length, and character set.
 */
export function detectBarcodeFormat(cleanedBarcode: string): BarcodeFormat {
  if (!cleanedBarcode) return BarcodeFormat.OTHER;

  if (/^\d+$/.test(cleanedBarcode)) {
    if (cleanedBarcode.length === 8) {
      return isValidGs1Checksum(cleanedBarcode) ? BarcodeFormat.EAN_8 : BarcodeFormat.UPC_E;
    }
    if (cleanedBarcode.length === 12) {
      return BarcodeFormat.UPC_A;
    }
    if (cleanedBarcode.length === 13) {
      return BarcodeFormat.EAN_13;
    }
  }

  if (/^[\x20-\x7E]{1,128}$/.test(cleanedBarcode)) {
    return BarcodeFormat.CODE_128;
  }

  return BarcodeFormat.OTHER;
}

/**
 * Comprehensive validation function covering EAN-13, EAN-8, UPC-A, UPC-E, and Code 128.
 */
export function validateBarcode(rawBarcode: unknown): BarcodeValidationResult {
  if (typeof rawBarcode !== 'string') {
    return {
      isValid: false,
      format: BarcodeFormat.OTHER,
      normalizedBarcode: '',
      error: 'Barcode must be a non-empty string.',
    };
  }

  const clean = normalizeBarcode(rawBarcode);

  if (!clean || clean.length === 0) {
    return {
      isValid: false,
      format: BarcodeFormat.OTHER,
      normalizedBarcode: '',
      error: 'Barcode cannot be empty.',
    };
  }

  if (clean.length > 64) {
    return {
      isValid: false,
      format: BarcodeFormat.OTHER,
      normalizedBarcode: clean,
      error: 'Barcode exceeds maximum allowed length of 64 characters.',
    };
  }

  // 1. EAN-13 (13 digits)
  if (/^\d{13}$/.test(clean)) {
    const valid = isValidGs1Checksum(clean);
    return {
      isValid: valid,
      format: BarcodeFormat.EAN_13,
      normalizedBarcode: clean,
      error: valid ? undefined : 'Invalid EAN-13 check digit.',
    };
  }

  // 2. UPC-A (12 digits)
  if (/^\d{12}$/.test(clean)) {
    const valid = isValidGs1Checksum(clean);
    return {
      isValid: valid,
      format: BarcodeFormat.UPC_A,
      normalizedBarcode: clean,
      error: valid ? undefined : 'Invalid UPC-A check digit.',
    };
  }

  // 3. EAN-8 (8 digits)
  if (/^\d{8}$/.test(clean)) {
    if (isValidGs1Checksum(clean)) {
      return {
        isValid: true,
        format: BarcodeFormat.EAN_8,
        normalizedBarcode: clean,
      };
    }

    // Check if it's a valid UPC-E
    const expanded = expandUpcEToUpcA(clean);
    if (expanded) {
      return {
        isValid: true,
        format: BarcodeFormat.UPC_E,
        normalizedBarcode: clean,
        expandedBarcode: expanded,
      };
    }

    return {
      isValid: false,
      format: BarcodeFormat.EAN_8,
      normalizedBarcode: clean,
      error: 'Invalid EAN-8 or UPC-E check digit.',
    };
  }

  // 4. UPC-E (6 or 7 digits)
  if (/^\d{6,7}$/.test(clean)) {
    const expanded = expandUpcEToUpcA(clean);
    if (expanded) {
      return {
        isValid: true,
        format: BarcodeFormat.UPC_E,
        normalizedBarcode: clean,
        expandedBarcode: expanded,
      };
    }
    return {
      isValid: false,
      format: BarcodeFormat.UPC_E,
      normalizedBarcode: clean,
      error: 'Invalid UPC-E barcode structure.',
    };
  }

  // 5. Code 128 (ASCII alphanumeric)
  if (/^[A-Za-z0-9\-. $/+%]{1,64}$/.test(clean)) {
    return {
      isValid: true,
      format: BarcodeFormat.CODE_128,
      normalizedBarcode: clean,
    };
  }

  return {
    isValid: false,
    format: BarcodeFormat.OTHER,
    normalizedBarcode: clean,
    error: 'Unsupported barcode format or invalid characters.',
  };
}
