import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  normalizeHeaderValue,
  extractBearerToken,
  extractFirebaseToken,
  type RequestWithApiKey,
} from '../auth';

describe('normalizeHeaderValue', () => {
  describe('error handling and edge cases', () => {
    it('returns null for undefined', () => {
      expect(normalizeHeaderValue(undefined)).toBeNull();
    });

    it('returns null for empty string', () => {
      expect(normalizeHeaderValue('')).toBeNull();
    });

    it('returns null for whitespace-only string', () => {
      expect(normalizeHeaderValue('   ')).toBeNull();
      expect(normalizeHeaderValue('\t\n')).toBeNull();
    });

    it('returns null for empty array', () => {
      expect(normalizeHeaderValue([])).toBeNull();
    });

    it('returns null for array with only empty string', () => {
      expect(normalizeHeaderValue([''])).toBeNull();
    });
  });

  describe('core behavior', () => {
    it('trims whitespace from string values', () => {
      expect(normalizeHeaderValue('  token123  ')).toBe('token123');
    });

    it('returns first element from array', () => {
      expect(normalizeHeaderValue(['first', 'second'])).toBe('first');
    });

    it('preserves non-whitespace string values', () => {
      expect(normalizeHeaderValue('Bearer abc123')).toBe('Bearer abc123');
    });
  });

  describe('property-based', () => {
    it('never returns a string with leading/trailing whitespace', () => {
      fc.assert(fc.property(fc.string({ minLength: 1 }), (str) => {
        const result = normalizeHeaderValue(str);
        if (result !== null) {
          expect(result).toBe(result.trim());
          expect(result.length).toBeGreaterThan(0);
        }
      }));
    });
  });
});

describe('extractBearerToken', () => {
  describe('error handling and edge cases', () => {
    it('returns null for undefined', () => {
      expect(extractBearerToken(undefined)).toBeNull();
    });

    it('returns null for empty string', () => {
      expect(extractBearerToken('')).toBeNull();
    });

    it('returns null for string without Bearer prefix', () => {
      expect(extractBearerToken('Basic abc123')).toBeNull();
    });

    it('returns null for just "Bearer " with no token', () => {
      expect(extractBearerToken('Bearer ')).toBeNull();
    });

    it('returns null for "Bearer" without space', () => {
      expect(extractBearerToken('Bearer')).toBeNull();
    });

    it('returns null for "Bearer  " (whitespace-only token)', () => {
      expect(extractBearerToken('Bearer   ')).toBeNull();
    });

    it('is case-sensitive for Bearer prefix', () => {
      expect(extractBearerToken('bearer token123')).toBeNull();
      expect(extractBearerToken('BEARER token123')).toBeNull();
    });
  });

  describe('core behavior', () => {
    it('extracts token after Bearer prefix', () => {
      expect(extractBearerToken('Bearer my-token-123')).toBe('my-token-123');
    });

    it('trims whitespace from extracted token', () => {
      expect(extractBearerToken('Bearer  token-with-spaces  ')).toBe('token-with-spaces');
    });

    it('handles array input by taking first element', () => {
      expect(extractBearerToken(['Bearer first-token', 'Bearer second-token'])).toBe('first-token');
    });
  });

  describe('property-based', () => {
    it('extracts any non-empty token from valid Bearer header', () => {
      fc.assert(fc.property(
        fc.string({ minLength: 1 }).filter(s => s.trim().length > 0 && !s.includes('\n')),
        (token) => {
          const result = extractBearerToken(`Bearer ${token}`);
          if (token.trim().length > 0) {
            expect(result).toBe(token.trim());
          }
        }
      ));
    });
  });
});

describe('extractFirebaseToken', () => {
  function makeReq(overrides: {
    firebaseHeader?: string;
    authorization?: string;
    apiKey?: string;
  } = {}): RequestWithApiKey {
    const headers: Record<string, string | undefined> = {};
    if (overrides.firebaseHeader !== undefined) {
      headers['x-firebase-token'] = overrides.firebaseHeader;
    }
    if (overrides.authorization !== undefined) {
      headers['authorization'] = overrides.authorization;
    }
    return {
      headers,
      apiKey: overrides.apiKey,
    } as unknown as RequestWithApiKey;
  }

  describe('error handling and edge cases', () => {
    it('returns null when no headers present', () => {
      expect(extractFirebaseToken(makeReq())).toBeNull();
    });

    it('returns null when authorization has no Bearer prefix', () => {
      expect(extractFirebaseToken(makeReq({ authorization: 'Basic abc' }))).toBeNull();
    });

    it('returns null when bearer token matches apiKey', () => {
      expect(extractFirebaseToken(makeReq({
        authorization: 'Bearer api-key-123',
        apiKey: 'api-key-123',
      }))).toBeNull();
    });

    it('returns null when firebase header is empty', () => {
      expect(extractFirebaseToken(makeReq({ firebaseHeader: '' }))).toBeNull();
    });

    it('returns null when firebase header is whitespace only', () => {
      expect(extractFirebaseToken(makeReq({ firebaseHeader: '   ' }))).toBeNull();
    });
  });

  describe('core behavior', () => {
    it('prefers x-firebase-token header', () => {
      const req = makeReq({
        firebaseHeader: 'firebase-token-abc',
        authorization: 'Bearer different-token',
      });
      expect(extractFirebaseToken(req)).toBe('firebase-token-abc');
    });

    it('falls back to bearer token when x-firebase-token is absent', () => {
      expect(extractFirebaseToken(makeReq({
        authorization: 'Bearer firebase-abc',
      }))).toBe('firebase-abc');
    });

    it('returns bearer token when it differs from apiKey', () => {
      expect(extractFirebaseToken(makeReq({
        authorization: 'Bearer firebase-token',
        apiKey: 'different-api-key',
      }))).toBe('firebase-token');
    });

    it('returns bearer token when apiKey is undefined', () => {
      expect(extractFirebaseToken(makeReq({
        authorization: 'Bearer firebase-token',
      }))).toBe('firebase-token');
    });
  });
});
