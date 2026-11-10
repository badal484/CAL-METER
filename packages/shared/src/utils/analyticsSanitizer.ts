/**
 * Privacy-preserving analytics property sanitizer.
 * Enforces zero-PII guarantee: strips sensitive credentials, tokens, passwords,
 * raw personal notes, and private coach messages before persistence or dispatch.
 */

const BLOCKED_KEY_PATTERNS = [
  /password/i,
  /secret/i,
  /token/i,
  /auth/i,
  /bearer/i,
  /cookie/i,
  /email/i,
  /phone/i,
  /mobile/i,
  /ssn/i,
  /card/i,
  /cvv/i,
  /notes/i,
  /rawtext/i,
  /messagetext/i,
  /coachprompt/i,
  /coachresponse/i,
  /prompt/i,
  /api[_-]?key/i,
];

const EMAIL_REGEX = /[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+/;
const JWT_REGEX = /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]*$/;

/**
 * Checks whether an object property key is sensitive and must be redacted.
 */
export function isSensitiveKey(key: string): boolean {
  return BLOCKED_KEY_PATTERNS.some(pattern => pattern.test(key));
}

/**
 * Recursively sanitizes an analytics payload.
 * Redacts blocked keys, strips JWTs / email patterns, and trims large strings.
 */
export function sanitizeAnalyticsProperties(
  properties: Record<string, unknown> | null | undefined,
  maxDepth: number = 4,
): Record<string, unknown> {
  if (!properties || typeof properties !== 'object' || Array.isArray(properties)) {
    return {};
  }

  function cleanValue(val: unknown, currentDepth: number): unknown {
    if (val === null || val === undefined) return val;

    if (currentDepth > maxDepth) {
      return '[TRUNCATED_DEPTH]';
    }

    if (typeof val === 'string') {
      if (JWT_REGEX.test(val.trim())) {
        return '[REDACTED_TOKEN]';
      }
      if (EMAIL_REGEX.test(val)) {
        return '[REDACTED_EMAIL]';
      }
      // Truncate excessively long strings
      if (val.length > 500) {
        return `${val.slice(0, 500)}...[TRUNCATED]`;
      }
      return val;
    }

    if (typeof val === 'number' || typeof val === 'boolean') {
      return val;
    }

    if (Array.isArray(val)) {
      return val.slice(0, 50).map(item => cleanValue(item, currentDepth + 1));
    }

    if (typeof val === 'object') {
      const sanitizedObj: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
        if (isSensitiveKey(k)) {
          sanitizedObj[k] = '[REDACTED]';
        } else {
          sanitizedObj[k] = cleanValue(v, currentDepth + 1);
        }
      }
      return sanitizedObj;
    }

    return String(val);
  }

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(properties)) {
    if (isSensitiveKey(key)) {
      result[key] = '[REDACTED]';
    } else {
      result[key] = cleanValue(value, 1);
    }
  }

  return result;
}
