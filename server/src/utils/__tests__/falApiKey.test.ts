import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { isFalKeyPlaceholder, resolveFalApiKey } from '../falApiKey';

describe('isFalKeyPlaceholder', () => {
  describe('error handling and edge cases', () => {
    it('returns false for undefined', () => {
      expect(isFalKeyPlaceholder(undefined)).toBe(false);
    });

    it('returns false for null', () => {
      expect(isFalKeyPlaceholder(null)).toBe(false);
    });

    it('returns false for empty string', () => {
      expect(isFalKeyPlaceholder('')).toBe(false);
    });

    it('returns false for whitespace-only string', () => {
      expect(isFalKeyPlaceholder('   ')).toBe(false);
    });
  });

  describe('core behavior - detects placeholders', () => {
    it('detects template pattern ${...}', () => {
      expect(isFalKeyPlaceholder('${FAL_KEY}')).toBe(true);
      expect(isFalKeyPlaceholder('${FAL_API_KEY}')).toBe(true);
    });

    it('detects $-prefixed values', () => {
      expect(isFalKeyPlaceholder('$FAL_KEY')).toBe(true);
      expect(isFalKeyPlaceholder('$ENV_VAR')).toBe(true);
    });

    it('detects literal "undefined"', () => {
      expect(isFalKeyPlaceholder('undefined')).toBe(true);
    });

    it('detects literal "null"', () => {
      expect(isFalKeyPlaceholder('null')).toBe(true);
    });

    it('returns false for real API keys', () => {
      expect(isFalKeyPlaceholder('fal-1234567890abcdef')).toBe(false);
      expect(isFalKeyPlaceholder('abc123:secret456')).toBe(false);
    });

    it('trims whitespace before checking', () => {
      expect(isFalKeyPlaceholder('  $FAL_KEY  ')).toBe(true);
      expect(isFalKeyPlaceholder('  undefined  ')).toBe(true);
    });
  });
});

describe('resolveFalApiKey', () => {
  const savedEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const key of ['FAL_KEY', 'FAL_API_KEY', 'FAL_KEY_ID', 'FAL_KEY_SECRET']) {
      savedEnv[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of ['FAL_KEY', 'FAL_API_KEY', 'FAL_KEY_ID', 'FAL_KEY_SECRET']) {
      if (savedEnv[key] !== undefined) {
        process.env[key] = savedEnv[key];
      } else {
        delete process.env[key];
      }
    }
  });

  describe('error handling and edge cases', () => {
    it('returns null when no keys available', () => {
      expect(resolveFalApiKey()).toBeNull();
    });

    it('returns null when explicit key is a placeholder', () => {
      expect(resolveFalApiKey('${FAL_KEY}')).toBeNull();
    });

    it('returns null when explicit key is empty', () => {
      expect(resolveFalApiKey('')).toBeNull();
    });

    it('returns null when explicit key is whitespace', () => {
      expect(resolveFalApiKey('   ')).toBeNull();
    });

    it('ignores FAL_KEY env var if it is a placeholder', () => {
      process.env.FAL_KEY = '${FAL_KEY}';
      expect(resolveFalApiKey()).toBeNull();
    });

    it('returns null when only FAL_KEY_ID is set', () => {
      process.env.FAL_KEY_ID = 'myid';
      expect(resolveFalApiKey()).toBeNull();
    });

    it('returns null when only FAL_KEY_SECRET is set', () => {
      process.env.FAL_KEY_SECRET = 'mysecret';
      expect(resolveFalApiKey()).toBeNull();
    });
  });

  describe('core behavior - priority order', () => {
    it('returns explicit key first', () => {
      process.env.FAL_KEY = 'env-key';
      expect(resolveFalApiKey('explicit-key')).toBe('explicit-key');
    });

    it('falls back to FAL_KEY env var', () => {
      process.env.FAL_KEY = 'env-fal-key';
      expect(resolveFalApiKey()).toBe('env-fal-key');
    });

    it('falls back to FAL_API_KEY when FAL_KEY is missing', () => {
      process.env.FAL_API_KEY = 'env-fal-api-key';
      expect(resolveFalApiKey()).toBe('env-fal-api-key');
    });

    it('falls back to FAL_KEY_ID:FAL_KEY_SECRET composite', () => {
      process.env.FAL_KEY_ID = 'myid';
      process.env.FAL_KEY_SECRET = 'mysecret';
      expect(resolveFalApiKey()).toBe('myid:mysecret');
    });

    it('prefers FAL_KEY over FAL_API_KEY', () => {
      process.env.FAL_KEY = 'fal-key-value';
      process.env.FAL_API_KEY = 'fal-api-key-value';
      expect(resolveFalApiKey()).toBe('fal-key-value');
    });

    it('skips placeholder FAL_KEY and uses FAL_API_KEY', () => {
      process.env.FAL_KEY = '$FAL_KEY';
      process.env.FAL_API_KEY = 'real-api-key';
      expect(resolveFalApiKey()).toBe('real-api-key');
    });

    it('skips placeholder explicit key and uses FAL_KEY', () => {
      process.env.FAL_KEY = 'real-env-key';
      expect(resolveFalApiKey('$PLACEHOLDER')).toBe('real-env-key');
    });
  });
});
