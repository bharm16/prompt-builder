import { describe, it, expect } from 'vitest';
import {
  validateSchema,
  getSchemaErrors,
  formatSchemaErrors,
  validateSchemaOrThrow,
} from '../SchemaValidator';

describe('validateSchema', () => {
  describe('error handling', () => {
    it('returns false for null data', () => {
      const result = validateSchema(null);
      expect(result).toBe(false);
    });

    it('returns false for undefined data', () => {
      const result = validateSchema(undefined);
      expect(result).toBe(false);
    });

    it('returns false for string data', () => {
      const result = validateSchema('not an object');
      expect(result).toBe(false);
    });

    it('returns false for number data', () => {
      const result = validateSchema(123);
      expect(result).toBe(false);
    });

    it('returns false for array data', () => {
      const result = validateSchema([]);
      expect(result).toBe(false);
    });

    it('returns false when required fields are missing', () => {
      const result = validateSchema({});
      expect(result).toBe(false);
    });

    it('returns false when analysis_trace is missing', () => {
      const result = validateSchema({
        spans: [],
        meta: { version: 'v1', notes: 'test' },
      });
      expect(result).toBe(false);
    });

    it('returns false when spans is missing', () => {
      const result = validateSchema({
        analysis_trace: 'test',
        meta: { version: 'v1', notes: 'test' },
      });
      expect(result).toBe(false);
    });

    it('returns false when meta is missing', () => {
      const result = validateSchema({
        analysis_trace: 'test',
        spans: [],
      });
      expect(result).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('returns false when spans is not an array', () => {
      const result = validateSchema({
        analysis_trace: 'test',
        spans: 'not an array',
        meta: { version: 'v1', notes: 'test' },
      });
      expect(result).toBe(false);
    });

    it('returns false when span item is missing required fields', () => {
      const result = validateSchema({
        analysis_trace: 'test',
        spans: [{ start: 0, end: 5 }], // missing text and role
        meta: { version: 'v1', notes: 'test' },
      });
      expect(result).toBe(false);
    });

    it('returns false when meta.version is missing', () => {
      const result = validateSchema({
        analysis_trace: 'test',
        spans: [],
        meta: { notes: 'test' },
      });
      expect(result).toBe(false);
    });

    it('returns false when meta.notes is missing', () => {
      const result = validateSchema({
        analysis_trace: 'test',
        spans: [],
        meta: { version: 'v1' },
      });
      expect(result).toBe(false);
    });

    it('returns false when confidence is outside 0-1 range', () => {
      const result = validateSchema({
        analysis_trace: 'test',
        spans: [{ text: 'hello', role: 'subject', confidence: 1.5 }],
        meta: { version: 'v1', notes: 'test' },
      });
      expect(result).toBe(false);
    });

    it('returns false when start is negative', () => {
      const result = validateSchema({
        analysis_trace: 'test',
        spans: [{ text: 'hello', role: 'subject', start: -1, end: 5 }],
        meta: { version: 'v1', notes: 'test' },
      });
      expect(result).toBe(false);
    });

    it('allows empty analysis_trace string', () => {
      const result = validateSchema({
        analysis_trace: '',
        spans: [],
        meta: { version: 'v1', notes: '' },
      });
      expect(result).toBe(true);
    });

    it('allows empty spans array', () => {
      const result = validateSchema({
        analysis_trace: 'No spans found',
        spans: [],
        meta: { version: 'v1', notes: 'empty' },
      });
      expect(result).toBe(true);
    });
  });

  describe('core behavior', () => {
    it('returns true for valid minimal response', () => {
      const result = validateSchema({
        analysis_trace: 'Analyzed the text',
        spans: [],
        meta: { version: 'v1', notes: 'processed' },
      });
      expect(result).toBe(true);
    });

    it('returns true for valid response with spans', () => {
      const result = validateSchema({
        analysis_trace: 'Found subject and action',
        spans: [
          { text: 'cat', role: 'subject.identity' },
          { text: 'running', role: 'action.movement', confidence: 0.9 },
        ],
        meta: { version: 'v1', notes: 'two spans found' },
      });
      expect(result).toBe(true);
    });

    it('returns true for valid response with optional start/end indices', () => {
      const result = validateSchema({
        analysis_trace: 'test',
        spans: [
          { text: 'cat', role: 'subject', start: 0, end: 3, confidence: 0.95 },
        ],
        meta: { version: 'v1', notes: 'with indices' },
      });
      expect(result).toBe(true);
    });

    it('returns true when isAdversarial flag is present', () => {
      const result = validateSchema({
        analysis_trace: 'test',
        spans: [],
        meta: { version: 'v1', notes: '' },
        isAdversarial: true,
      });
      expect(result).toBe(true);
    });

    it('returns true when is_adversarial (snake_case) flag is present', () => {
      const result = validateSchema({
        analysis_trace: 'test',
        spans: [],
        meta: { version: 'v1', notes: '' },
        is_adversarial: false,
      });
      expect(result).toBe(true);
    });
  });
});

describe('getSchemaErrors', () => {
  describe('error handling', () => {
    it('returns empty array when no validation has been done', () => {
      // Validate a valid object first to clear any errors
      validateSchema({
        analysis_trace: 'test',
        spans: [],
        meta: { version: 'v1', notes: '' },
      });
      const errors = getSchemaErrors();
      expect(errors).toEqual([]);
    });
  });

  describe('core behavior', () => {
    it('returns errors after failed validation', () => {
      validateSchema({ invalid: 'data' });
      const errors = getSchemaErrors();

      expect(Array.isArray(errors)).toBe(true);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('returns empty array after successful validation', () => {
      validateSchema({
        analysis_trace: 'test',
        spans: [],
        meta: { version: 'v1', notes: '' },
      });
      const errors = getSchemaErrors();
      expect(errors).toEqual([]);
    });
  });
});

describe('formatSchemaErrors', () => {
  describe('edge cases', () => {
    it('returns empty string when no errors exist', () => {
      validateSchema({
        analysis_trace: 'test',
        spans: [],
        meta: { version: 'v1', notes: '' },
      });
      const result = formatSchemaErrors();
      expect(result).toBe('');
    });
  });

  describe('core behavior', () => {
    it('returns formatted error message after failed validation', () => {
      validateSchema({ invalid: 'data' });
      const result = formatSchemaErrors();

      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('includes property path in error message', () => {
      validateSchema({
        analysis_trace: 'test',
        spans: [{ invalid: true }], // missing required text and role
        meta: { version: 'v1', notes: '' },
      });
      const result = formatSchemaErrors();

      // Should mention spans path
      expect(result).toContain('spans');
    });
  });
});

describe('validateSchemaOrThrow', () => {
  describe('error handling', () => {
    it('throws error for invalid data', () => {
      expect(() => {
        validateSchemaOrThrow({ invalid: 'data' });
      }).toThrow('Schema validation failed');
    });

    it('throws error with formatted error details', () => {
      expect(() => {
        validateSchemaOrThrow({ analysis_trace: 'test' });
      }).toThrow(/required/);
    });

    it('throws for null data', () => {
      expect(() => {
        validateSchemaOrThrow(null);
      }).toThrow('Schema validation failed');
    });
  });

  describe('core behavior', () => {
    it('does not throw for valid data', () => {
      expect(() => {
        validateSchemaOrThrow({
          analysis_trace: 'test',
          spans: [],
          meta: { version: 'v1', notes: '' },
        });
      }).not.toThrow();
    });

    it('does not throw for valid data with spans', () => {
      expect(() => {
        validateSchemaOrThrow({
          analysis_trace: 'test',
          spans: [
            { text: 'hello', role: 'subject', confidence: 0.8 },
          ],
          meta: { version: 'v1', notes: 'valid' },
        });
      }).not.toThrow();
    });
  });
});
