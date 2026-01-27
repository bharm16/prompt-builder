import { describe, it, expect } from 'vitest';
import { unwrapSuggestionsArray } from '../unwrapper';

describe('unwrapSuggestionsArray', () => {
  describe('error handling', () => {
    it('handles null input', () => {
      const result = unwrapSuggestionsArray(null, true);

      expect(result).toEqual({ value: null, unwrapped: false });
    });

    it('handles undefined input', () => {
      const result = unwrapSuggestionsArray(undefined, true);

      expect(result).toEqual({ value: undefined, unwrapped: false });
    });

    it('handles primitive string input', () => {
      const result = unwrapSuggestionsArray('test', true);

      expect(result).toEqual({ value: 'test', unwrapped: false });
    });

    it('handles primitive number input', () => {
      const result = unwrapSuggestionsArray(42, true);

      expect(result).toEqual({ value: 42, unwrapped: false });
    });

    it('handles boolean input', () => {
      const result = unwrapSuggestionsArray(true, true);

      expect(result).toEqual({ value: true, unwrapped: false });
    });
  });

  describe('edge cases', () => {
    it('returns original when isArray is false', () => {
      const wrapped = { suggestions: ['a', 'b', 'c'] };
      const result = unwrapSuggestionsArray(wrapped, false);

      expect(result.value).toEqual(wrapped);
      expect(result.unwrapped).toBe(false);
    });

    it('returns original when input is already an array', () => {
      const array = ['a', 'b', 'c'];
      const result = unwrapSuggestionsArray(array, true);

      expect(result.value).toEqual(array);
      expect(result.unwrapped).toBe(false);
    });

    it('returns original when object has no suggestions property', () => {
      const obj = { items: ['a', 'b', 'c'] };
      const result = unwrapSuggestionsArray(obj, true);

      expect(result.value).toEqual(obj);
      expect(result.unwrapped).toBe(false);
    });

    it('returns original when suggestions property is not an array', () => {
      const obj = { suggestions: 'not an array' };
      const result = unwrapSuggestionsArray(obj, true);

      expect(result.value).toEqual(obj);
      expect(result.unwrapped).toBe(false);
    });

    it('handles empty suggestions array', () => {
      const obj = { suggestions: [] };
      const result = unwrapSuggestionsArray(obj, true);

      expect(result.value).toEqual([]);
      expect(result.unwrapped).toBe(true);
    });

    it('handles object with additional properties besides suggestions', () => {
      const obj = {
        suggestions: ['a', 'b'],
        meta: { count: 2 },
        status: 'ok',
      };
      const result = unwrapSuggestionsArray(obj, true);

      // Only extracts the suggestions array
      expect(result.value).toEqual(['a', 'b']);
      expect(result.unwrapped).toBe(true);
    });
  });

  describe('core behavior', () => {
    it('unwraps suggestions array from wrapper object', () => {
      const wrapped = { suggestions: ['item1', 'item2', 'item3'] };
      const result = unwrapSuggestionsArray(wrapped, true);

      expect(result.value).toEqual(['item1', 'item2', 'item3']);
      expect(result.unwrapped).toBe(true);
    });

    it('unwraps array of objects', () => {
      const suggestions = [
        { id: 1, text: 'first' },
        { id: 2, text: 'second' },
      ];
      const wrapped = { suggestions };
      const result = unwrapSuggestionsArray(wrapped, true);

      expect(result.value).toEqual(suggestions);
      expect(result.unwrapped).toBe(true);
    });

    it('preserves type information in unwrapped result', () => {
      interface Suggestion {
        id: number;
        text: string;
      }
      const suggestions: Suggestion[] = [{ id: 1, text: 'test' }];
      const wrapped = { suggestions };

      const result = unwrapSuggestionsArray<Suggestion[]>(wrapped, true);

      expect(result.value).toEqual(suggestions);
    });

    it('returns unwrapped: false when no unwrapping occurred', () => {
      const array = ['a', 'b'];
      const result = unwrapSuggestionsArray(array, true);

      expect(result.unwrapped).toBe(false);
    });

    it('returns unwrapped: true when unwrapping occurred', () => {
      const wrapped = { suggestions: ['a', 'b'] };
      const result = unwrapSuggestionsArray(wrapped, true);

      expect(result.unwrapped).toBe(true);
    });
  });
});
