import { describe, it, expect } from 'vitest';

import { cn } from '@/utils/cn';

describe('cn', () => {
  describe('error handling', () => {
    it('filters out falsy and boolean true values', () => {
      const result = cn(null, undefined, false, true, '');

      expect(result).toBe('');
    });
  });

  describe('edge cases', () => {
    it('flattens nested arrays and collapses whitespace', () => {
      const result = cn('base', ['alpha', ['beta', '  gamma  '], null], false);

      expect(result).toBe('base alpha beta gamma');
    });
  });

  describe('core behavior', () => {
    it('joins multiple class sources into a single string', () => {
      const result = cn('one', 'two', ['three', 'four']);

      expect(result).toBe('one two three four');
    });
  });
});
