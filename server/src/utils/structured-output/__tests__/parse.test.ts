import { describe, it, expect, vi } from 'vitest';
import { parseStructuredOutput } from '../parse';
import type { StructuredOutputSchema } from '../types';

// Mock the JsonExtractor
vi.mock('@utils/JsonExtractor', () => ({
  extractAndParse: vi.fn((text: string, isArray: boolean) => {
    // Simple mock that returns based on isArray flag
    if (isArray) {
      return text.includes('[') ? JSON.parse(text.match(/\[.*\]/s)?.[0] || '[]') : [];
    }
    return text.includes('{') ? JSON.parse(text.match(/\{.*\}/s)?.[0] || '{}') : {};
  }),
}));

describe('parseStructuredOutput', () => {
  describe('error handling', () => {
    it('handles null schema', () => {
      const result = parseStructuredOutput('[1, 2, 3]', null, true);

      expect(result).toEqual([1, 2, 3]);
    });

    it('handles undefined schema', () => {
      const result = parseStructuredOutput('{"key": "value"}', undefined, false);

      expect(result).toEqual({ key: 'value' });
    });
  });

  describe('edge cases', () => {
    it('schema type array overrides isArray=false parameter', () => {
      const schema: StructuredOutputSchema = { type: 'array' };
      const result = parseStructuredOutput('[1, 2, 3]', schema, false);

      expect(result).toEqual([1, 2, 3]);
    });

    it('schema type object overrides isArray=true parameter', () => {
      const schema: StructuredOutputSchema = { type: 'object' };
      const result = parseStructuredOutput('{"key": "value"}', schema, true);

      expect(result).toEqual({ key: 'value' });
    });

    it('uses isArray parameter when schema type is neither array nor object', () => {
      const schema: StructuredOutputSchema = { type: 'string' as any };
      const result = parseStructuredOutput('[1, 2, 3]', schema, true);

      expect(result).toEqual([1, 2, 3]);
    });

    it('handles schema with required fields and array type', () => {
      const schema: StructuredOutputSchema = { type: 'array', items: { required: ['id'] } };
      const result = parseStructuredOutput('[{"id": 1}]', schema, false);

      expect(result).toEqual([{ id: 1 }]);
    });
  });

  describe('core behavior', () => {
    it('parses array when schema type is array', () => {
      const schema: StructuredOutputSchema = { type: 'array' };
      const result = parseStructuredOutput<number[]>('[1, 2, 3]', schema, false);

      expect(result).toEqual([1, 2, 3]);
    });

    it('parses object when schema type is object', () => {
      const schema: StructuredOutputSchema = { type: 'object' };
      const result = parseStructuredOutput<{ key: string }>(
        '{"key": "value"}',
        schema,
        true
      );

      expect(result).toEqual({ key: 'value' });
    });

    it('respects isArray=true when no schema', () => {
      const result = parseStructuredOutput<number[]>('[1, 2, 3]', null, true);

      expect(result).toEqual([1, 2, 3]);
    });

    it('respects isArray=false when no schema', () => {
      const result = parseStructuredOutput<{ key: string }>(
        '{"key": "value"}',
        null,
        false
      );

      expect(result).toEqual({ key: 'value' });
    });

    it('passes through to extractAndParse with correct isArray', async () => {
      const { extractAndParse } = await import('@utils/JsonExtractor');

      parseStructuredOutput('[1]', { type: 'array' }, false);
      expect(extractAndParse).toHaveBeenCalledWith('[1]', true);

      parseStructuredOutput('{}', { type: 'object' }, true);
      expect(extractAndParse).toHaveBeenCalledWith('{}', false);

      parseStructuredOutput('[2]', null, true);
      expect(extractAndParse).toHaveBeenCalledWith('[2]', true);
    });
  });
});
