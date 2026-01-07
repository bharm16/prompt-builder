/**
 * Logging Sanitization Utilities
 * 
 * Provides functions to sanitize sensitive data before logging.
 * These utilities help prevent accidental exposure of PII, credentials,
 * and other confidential information in logs.
 * 
 * @module utils/logging/sanitize
 */

/**
 * List of sensitive header names that should be redacted
 */
const SENSITIVE_HEADERS = [
  'authorization',
  'x-api-key',
  'cookie',
  'set-cookie',
  'x-auth-token',
  'x-access-token',
  'x-firebase-token',
  'api-key',
  'apikey',
];

/**
 * Sanitize HTTP headers by redacting sensitive values
 * 
 * @param headers - Headers object to sanitize
 * @returns Sanitized headers with sensitive values redacted
 * 
 * @example
 * const headers = {
 *   'content-type': 'application/json',
 *   'authorization': 'Bearer secret-token',
 *   'x-api-key': 'my-api-key'
 * };
 * const sanitized = sanitizeHeaders(headers);
 * // Result: {
 * //   'content-type': 'application/json',
 * //   'authorization': '[REDACTED]',
 * //   'x-api-key': '[REDACTED]'
 * // }
 */
export function sanitizeHeaders(
  headers: Record<string, string | string[] | undefined>
): Record<string, string | string[]> {
  const sanitized: Record<string, string | string[]> = {};

  for (const [key, value] of Object.entries(headers)) {
    if (value === undefined) continue;

    const lowerKey = key.toLowerCase();
    const isSensitive = SENSITIVE_HEADERS.some((sensitive) =>
      lowerKey.includes(sensitive)
    );

    if (isSensitive) {
      sanitized[key] = '[REDACTED]';
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

/**
 * Summarize large data structures for logging
 * Prevents logging of massive payloads while preserving useful information
 * 
 * @param data - Data to summarize
 * @param maxLength - Maximum string length before truncation (default: 200)
 * @returns Summarized representation of the data
 * 
 * @example
 * // String truncation
 * summarize('a'.repeat(500));
 * // Result: 'aaa...aaa (500 chars)'
 * 
 * // Array summarization
 * summarize([1, 2, 3, 4, 5]);
 * // Result: { type: 'array', length: 5, sample: [1, 2, 3] }
 * 
 * // Object summarization
 * summarize({ a: 1, b: 2, c: 3, ... });
 * // Result: { type: 'object', keys: ['a', 'b', 'c', ...], keyCount: 10 }
 */
export function summarize(data: unknown, maxLength = 200): unknown {
  // Handle null/undefined
  if (data === null || data === undefined) {
    return data;
  }

  // Handle strings
  if (typeof data === 'string') {
    if (data.length <= maxLength) {
      return data;
    }
    return `${data.slice(0, maxLength)}... (${data.length} chars)`;
  }

  // Handle arrays
  if (Array.isArray(data)) {
    return {
      type: 'array',
      length: data.length,
      sample: data.slice(0, 3), // First 3 items
    };
  }

  // Handle objects
  if (typeof data === 'object') {
    const keys = Object.keys(data);
    return {
      type: 'object',
      keys: keys.slice(0, 10), // First 10 keys
      keyCount: keys.length,
    };
  }

  // Primitives (numbers, booleans) pass through
  return data;
}

/**
 * Redact sensitive fields from an object
 * Useful for logging user data or request bodies
 * 
 * @param obj - Object to redact
 * @param sensitiveFields - Additional field names to redact (beyond defaults)
 * @returns Object with sensitive fields redacted
 * 
 * @example
 * const userData = {
 *   name: 'John Doe',
 *   email: 'john@example.com',
 *   password: 'secret123',
 *   apiKey: 'key-123'
 * };
 * const redacted = redactSensitiveFields(userData);
 * // Result: {
 * //   name: 'John Doe',
 * //   email: '[REDACTED]',
 * //   password: '[REDACTED]',
 * //   apiKey: '[REDACTED]'
 * // }
 */
export function redactSensitiveFields(
  obj: Record<string, unknown>,
  sensitiveFields: string[] = []
): Record<string, unknown> {
  const defaultSensitiveFields = [
    'password',
    'token',
    'apikey',
    'api_key',
    'secret',
    'authorization',
    'cookie',
    'ssn',
    'creditcard',
    'credit_card',
    'cvv',
    'pin',
  ];

  const allSensitiveFields = [
    ...defaultSensitiveFields,
    ...sensitiveFields.map((f) => f.toLowerCase()),
  ];

  const redacted: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();
    const isSensitive = allSensitiveFields.some((field) =>
      lowerKey.includes(field)
    );

    if (isSensitive) {
      redacted[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      // Recursively redact nested objects
      redacted[key] = redactSensitiveFields(
        value as Record<string, unknown>,
        sensitiveFields
      );
    } else {
      redacted[key] = value;
    }
  }

  return redacted;
}

/**
 * Extract email domain instead of full email address
 * Useful for analytics while preserving privacy
 * 
 * @param email - Email address
 * @returns Email domain or null if invalid
 * 
 * @example
 * getEmailDomain('user@example.com');
 * // Result: 'example.com'
 * 
 * getEmailDomain('invalid-email');
 * // Result: null
 */
export function getEmailDomain(email: string): string | null {
  if (!email || typeof email !== 'string') {
    return null;
  }

  const match = email.match(/@(.+)$/);
  return match && match[1] ? match[1] : null;
}

/**
 * Sanitize user data for logging
 * Removes PII while keeping useful metadata
 * 
 * @param user - User object
 * @returns Sanitized user data safe for logging
 * 
 * @example
 * const user = {
 *   id: 'user-123',
 *   email: 'john@example.com',
 *   name: 'John Doe',
 *   password: 'secret',
 *   createdAt: '2025-01-01'
 * };
 * const sanitized = sanitizeUserData(user);
 * // Result: {
 * //   userId: 'user-123',
 * //   emailDomain: 'example.com',
 * //   createdAt: '2025-01-01'
 * // }
 */
export function sanitizeUserData(user: {
  id?: string;
  uid?: string;
  email?: string;
  [key: string]: unknown;
}): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};

  // Include user ID (not PII)
  if (user.id) sanitized.userId = user.id;
  if (user.uid) sanitized.userId = user.uid;

  // Include email domain instead of full email
  if (user.email && typeof user.email === 'string') {
    const domain = getEmailDomain(user.email);
    if (domain) {
      sanitized.emailDomain = domain;
    }
  }

  // Include non-sensitive metadata
  const safeFields = ['createdAt', 'updatedAt', 'role', 'status', 'plan'];
  for (const field of safeFields) {
    if (user[field] !== undefined) {
      sanitized[field] = user[field];
    }
  }

  return sanitized;
}
