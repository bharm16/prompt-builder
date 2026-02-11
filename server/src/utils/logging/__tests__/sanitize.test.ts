import { describe, expect, it } from 'vitest';
import {
  getEmailDomain,
  redactSensitiveFields,
  sanitizeHeaders,
  sanitizeUserData,
  summarize,
} from '../sanitize';

describe('logging sanitize utilities', () => {
  it('redacts sensitive headers and keeps safe headers', () => {
    const sanitized = sanitizeHeaders({
      authorization: 'Bearer secret',
      'x-api-key': 'abc',
      'content-type': 'application/json',
    });

    expect(sanitized.authorization).toBe('[REDACTED]');
    expect(sanitized['x-api-key']).toBe('[REDACTED]');
    expect(sanitized['content-type']).toBe('application/json');
  });

  it('summarizes large structures and truncates long strings', () => {
    expect(summarize('x'.repeat(300))).toContain('(300 chars)');
    expect(summarize([1, 2, 3, 4])).toEqual({
      type: 'array',
      length: 4,
      sample: [1, 2, 3],
    });
    expect(summarize({ a: 1, b: 2 })).toEqual({
      type: 'object',
      keys: ['a', 'b'],
      keyCount: 2,
    });
  });

  it('redacts sensitive fields recursively', () => {
    const redacted = redactSensitiveFields({
      name: 'Alice',
      password: 'secret',
      profile: {
        token: 'abc',
        age: 30,
      },
    });

    expect(redacted.password).toBe('[REDACTED]');
    expect((redacted.profile as Record<string, unknown>).token).toBe('[REDACTED]');
    expect((redacted.profile as Record<string, unknown>).age).toBe(30);
  });

  it('extracts email domain and handles invalid emails', () => {
    expect(getEmailDomain('user@example.com')).toBe('example.com');
    expect(getEmailDomain('invalid')).toBeNull();
    expect(getEmailDomain('')).toBeNull();
  });

  it('sanitizes user data to non-PII metadata', () => {
    const sanitized = sanitizeUserData({
      id: 'user-1',
      email: 'alice@example.com',
      role: 'admin',
      name: 'Alice',
    });

    expect(sanitized).toEqual({
      userId: 'user-1',
      emailDomain: 'example.com',
      role: 'admin',
    });
    expect(sanitized.name).toBeUndefined();
  });
});
