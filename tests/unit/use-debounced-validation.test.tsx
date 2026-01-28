import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';

import { useDebouncedValidation } from '@features/span-highlighting/hooks/useDebouncedValidation';
import type { Span, ValidationResult } from '@features/span-highlighting/hooks/types';

const createValidator = () =>
  vi.fn((span: Span): ValidationResult => {
    if (span.category === 'valid') {
      return { pass: true };
    }
    return { pass: false, reason: 'invalid-span' };
  });

describe('useDebouncedValidation', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe('error handling', () => {
    it('returns empty results when spans are null', () => {
      const validator = createValidator();
      const { result } = renderHook(() => useDebouncedValidation(null, validator, 50));

      expect(result.current.validationResult.valid).toEqual([]);
      expect(result.current.validationResult.invalid).toEqual([]);
      expect(result.current.validationResult.validatedAt).toBeNull();
    });

    it('does not validate when spans are empty', () => {
      const validator = createValidator();
      const { result } = renderHook(() => useDebouncedValidation([], validator, 50));

      act(() => {
        result.current.validateNow();
        vi.advanceTimersByTime(50);
      });

      expect(validator).not.toHaveBeenCalled();
      expect(result.current.validationResult.validatedAt).toBeNull();
    });
  });

  describe('edge cases', () => {
    it('caches validation results and avoids duplicate work', () => {
      const validator = createValidator();
      const spans: Span[] = [
        { id: '1', start: 0, end: 1, category: 'valid' },
        { id: '2', start: 2, end: 3, category: 'invalid' },
      ];

      const { result, rerender } = renderHook(
        ({ currentSpans }) => useDebouncedValidation(currentSpans, validator, 50),
        { initialProps: { currentSpans: spans } }
      );

      act(() => {
        result.current.validateNow();
        vi.advanceTimersByTime(50);
      });

      rerender({ currentSpans: spans });

      act(() => {
        result.current.validateNow();
        vi.advanceTimersByTime(50);
      });

      expect(validator).toHaveBeenCalledTimes(2);
    });

    it('revalidates spans after the cache is cleared', () => {
      const validator = createValidator();
      const spans: Span[] = [
        { id: '1', start: 0, end: 1, category: 'valid' },
      ];

      const { result, rerender } = renderHook(
        ({ currentSpans }) => useDebouncedValidation(currentSpans, validator, 50),
        { initialProps: { currentSpans: spans } }
      );

      act(() => {
        result.current.validateNow();
        vi.advanceTimersByTime(50);
      });

      result.current.clearCache();

      rerender({ currentSpans: spans });

      act(() => {
        result.current.validateNow();
        vi.advanceTimersByTime(50);
      });

      expect(validator).toHaveBeenCalledTimes(2);
    });
  });

  describe('core behavior', () => {
    it('categorizes spans into valid and invalid buckets', () => {
      const validator = createValidator();
      const spans: Span[] = [
        { id: '1', start: 0, end: 1, category: 'valid' },
        { id: '2', start: 2, end: 3, category: 'invalid' },
      ];

      const { result, rerender } = renderHook(
        ({ currentSpans }) => useDebouncedValidation(currentSpans, validator, 50),
        { initialProps: { currentSpans: spans } }
      );

      act(() => {
        result.current.validateNow();
        vi.advanceTimersByTime(50);
      });

      rerender({ currentSpans: spans });

      expect(result.current.validationResult.valid).toHaveLength(1);
      expect(result.current.validationResult.invalid).toHaveLength(1);
      expect(result.current.validationResult.invalid[0]?.reason).toBe('invalid-span');
      expect(result.current.validationResult.validatedAt).not.toBeNull();
    });
  });
});
