import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { hashString } from '../hash';

describe('hashString', () => {
  describe('error handling', () => {
    it('returns 0 for empty string', () => {
      expect(hashString('')).toBe(0);
    });
  });

  describe('edge cases', () => {
    it('produces same hash for same input', () => {
      const input = 'test string';
      const hash1 = hashString(input);
      const hash2 = hashString(input);

      expect(hash1).toBe(hash2);
    });

    it('produces different hashes for different inputs', () => {
      const hash1 = hashString('hello');
      const hash2 = hashString('world');

      expect(hash1).not.toBe(hash2);
    });

    it('handles single character', () => {
      const hash = hashString('a');

      expect(typeof hash).toBe('number');
      expect(hash).toBeGreaterThan(0);
    });

    it('handles unicode characters', () => {
      const hash = hashString('café 日本語 🎉');

      expect(typeof hash).toBe('number');
      expect(Number.isFinite(hash)).toBe(true);
    });

    it('handles very long strings', () => {
      const longString = 'a'.repeat(10000);
      const hash = hashString(longString);

      expect(typeof hash).toBe('number');
      expect(Number.isFinite(hash)).toBe(true);
    });

    it('handles strings with special characters', () => {
      const hash = hashString('hello\nworld\t!@#$%^&*()');

      expect(typeof hash).toBe('number');
      expect(hash).toBeGreaterThan(0);
    });

    it('produces different hashes for strings differing by one character', () => {
      const hash1 = hashString('hello');
      const hash2 = hashString('hellp');

      expect(hash1).not.toBe(hash2);
    });

    it('produces different hashes for same characters in different order', () => {
      const hash1 = hashString('abc');
      const hash2 = hashString('cba');

      expect(hash1).not.toBe(hash2);
    });
  });

  describe('core behavior', () => {
    it('always returns a non-negative number', () => {
      const testCases = ['test', 'hello world', '123', '-500', 'negative'];

      for (const input of testCases) {
        const hash = hashString(input);
        expect(hash).toBeGreaterThanOrEqual(0);
      }
    });

    it('returns an integer', () => {
      const hash = hashString('test');

      expect(Number.isInteger(hash)).toBe(true);
    });
  });

  describe('invariants', () => {
    it('always returns non-negative integer for any string input', () => {
      fc.assert(
        fc.property(fc.string(), (input) => {
          const hash = hashString(input);

          expect(typeof hash).toBe('number');
          expect(Number.isInteger(hash)).toBe(true);
          expect(hash).toBeGreaterThanOrEqual(0);
        })
      );
    });

    it('is deterministic - same input always produces same output', () => {
      fc.assert(
        fc.property(fc.string(), (input) => {
          const hash1 = hashString(input);
          const hash2 = hashString(input);

          expect(hash1).toBe(hash2);
        })
      );
    });

    it('produces finite values for any input', () => {
      fc.assert(
        fc.property(fc.string(), (input) => {
          const hash = hashString(input);

          expect(Number.isFinite(hash)).toBe(true);
        })
      );
    });
  });
});
