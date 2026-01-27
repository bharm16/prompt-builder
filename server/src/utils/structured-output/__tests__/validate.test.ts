import { describe, it, expect, vi, beforeEach } from 'vitest';
import { validateStructuredOutput } from '../validate';
import type { StructuredOutputSchema } from '../types';

// Mock the logger
vi.mock('@infrastructure/Logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('validateStructuredOutput', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('error handling', () => {
    it('throws when expecting array but receiving object', () => {
      const schema: StructuredOutputSchema = { type: 'array' };
      const data = { key: 'value' };

      expect(() => validateStructuredOutput(data, schema)).toThrow(
        'Expected array but got object'
      );
    });

    it('throws when expecting object but receiving array', () => {
      const schema: StructuredOutputSchema = { type: 'object' };
      const data = ['item1', 'item2'];

      expect(() => validateStructuredOutput(data, schema)).toThrow(
        'Expected object but got array'
      );
    });

    it('throws when required field is missing from object', () => {
      const schema: StructuredOutputSchema = {
        type: 'object',
        required: ['name', 'age'],
      };
      const data = { name: 'John' };

      expect(() => validateStructuredOutput(data, schema)).toThrow(
        'Missing required field: age'
      );
    });

    it('throws when required field is missing from array item', () => {
      const schema: StructuredOutputSchema = {
        type: 'array',
        items: { required: ['id', 'text'] },
      };
      const data = [{ id: 1 }, { id: 2, text: 'complete' }];

      expect(() => validateStructuredOutput(data, schema)).toThrow(
        "Missing required field 'text' in array item at index 0"
      );
    });
  });

  describe('edge cases', () => {
    it('handles empty array with schema', () => {
      const schema: StructuredOutputSchema = {
        type: 'array',
        items: { required: ['id'] },
      };

      expect(() => validateStructuredOutput([], schema)).not.toThrow();
    });

    it('handles object schema without required fields', () => {
      const schema: StructuredOutputSchema = { type: 'object' };
      const data = { any: 'field' };

      expect(() => validateStructuredOutput(data, schema)).not.toThrow();
    });

    it('handles array schema without items specification', () => {
      const schema: StructuredOutputSchema = { type: 'array' };
      const data = [1, 2, 3];

      expect(() => validateStructuredOutput(data, schema)).not.toThrow();
    });

    it('handles null data with object schema', () => {
      const schema: StructuredOutputSchema = {
        type: 'object',
        required: ['name'],
      };

      // null is typeof 'object' but fails the !== null check
      expect(() => validateStructuredOutput(null, schema)).not.toThrow();
    });

    it('handles primitive items in array', () => {
      const schema: StructuredOutputSchema = {
        type: 'array',
        items: { required: ['id'] },
      };
      const data = ['string', 42, true];

      // Primitives are skipped in required field check
      expect(() => validateStructuredOutput(data, schema)).not.toThrow();
    });

    it('handles nested null items in array', () => {
      const schema: StructuredOutputSchema = {
        type: 'array',
        items: { required: ['id'] },
      };
      const data = [null, { id: 1 }];

      expect(() => validateStructuredOutput(data, schema)).not.toThrow();
    });

    it('handles multiple missing required fields (reports first)', () => {
      const schema: StructuredOutputSchema = {
        type: 'object',
        required: ['a', 'b', 'c'],
      };
      const data = {};

      expect(() => validateStructuredOutput(data, schema)).toThrow(
        'Missing required field: a'
      );
    });
  });

  describe('core behavior', () => {
    it('passes validation for valid object with required fields', () => {
      const schema: StructuredOutputSchema = {
        type: 'object',
        required: ['name', 'age'],
      };
      const data = { name: 'John', age: 30, extra: 'field' };

      expect(() => validateStructuredOutput(data, schema)).not.toThrow();
    });

    it('passes validation for valid array', () => {
      const schema: StructuredOutputSchema = { type: 'array' };
      const data = [1, 2, 3];

      expect(() => validateStructuredOutput(data, schema)).not.toThrow();
    });

    it('passes validation for array with all required fields', () => {
      const schema: StructuredOutputSchema = {
        type: 'array',
        items: { required: ['id', 'text'] },
      };
      const data = [
        { id: 1, text: 'first' },
        { id: 2, text: 'second' },
      ];

      expect(() => validateStructuredOutput(data, schema)).not.toThrow();
    });

    it('logs debug message on successful validation', async () => {
      const schema: StructuredOutputSchema = { type: 'object' };

      validateStructuredOutput({}, schema);

      const { logger } = await import('@infrastructure/Logger');
      expect(logger.debug).toHaveBeenCalledWith('Schema validation passed');
    });

    it('validates each item in array independently', () => {
      const schema: StructuredOutputSchema = {
        type: 'array',
        items: { required: ['id'] },
      };
      const data = [{ id: 1 }, { id: 2 }, { id: 3 }];

      expect(() => validateStructuredOutput(data, schema)).not.toThrow();
    });

    it('includes array index in error message for array items', () => {
      const schema: StructuredOutputSchema = {
        type: 'array',
        items: { required: ['id'] },
      };
      const data = [{ id: 1 }, { missing: 'field' }, { id: 3 }];

      expect(() => validateStructuredOutput(data, schema)).toThrow(
        "Missing required field 'id' in array item at index 1"
      );
    });
  });
});
