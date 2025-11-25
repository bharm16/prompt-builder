/**
 * Debounced Validation Hook
 *
 * Provides a way to run validation less frequently than rendering.
 * Useful for expensive validation operations that don't need to run on every render.
 *
 * PERFORMANCE OPTIMIZATION:
 * - Validation runs at most once per debounce period
 * - Results are cached to avoid redundant validation
 * - Runs validation in background without blocking rendering
 *
 * Current Use: Reserved for future heavy validation operations
 * The lightweight structural validation in categoryValidators.js doesn't need debouncing.
 */

import { useRef, useCallback, useEffect, useMemo } from 'react';

interface Span {
  id?: string;
  start?: number;
  end?: number;
  category?: string;
  role?: string;
  [key: string]: unknown;
}

interface ValidationResult {
  pass: boolean;
  reason?: string;
}

interface ValidationState {
  valid: Span[];
  invalid: Array<{ span: Span; reason?: string }>;
  validatedAt: number | null;
}

type ValidatorFunction = (span: Span) => ValidationResult;

/**
 * Simple debounce utility
 */
function debounce(
  func: (spans: Span[]) => void,
  wait: number
): ((spans: Span[]) => void) & { cancel: () => void } {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  const debounced = ((spans: Span[]) => {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => func(spans), wait);
  }) as ((spans: Span[]) => void) & { cancel: () => void };

  debounced.cancel = () => {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
    }
  };

  return debounced;
}

/**
 * Hook for debounced span validation
 */
export function useDebouncedValidation(
  spans: Span[] | null | undefined,
  validator: ValidatorFunction,
  delay: number = 1000
): {
  validationResult: ValidationState;
  validateNow: () => void;
  clearCache: () => void;
} {
  const validationCacheRef = useRef(new Map<string, ValidationResult>());
  const validationResultRef = useRef<ValidationState>({
    valid: [],
    invalid: [],
    validatedAt: null,
  });

  // Create debounced validation function
  const debouncedValidate = useMemo(
    () =>
      debounce((spansToValidate: Span[]) => {
        const valid: Span[] = [];
        const invalid: Array<{ span: Span; reason?: string }> = [];

        spansToValidate.forEach((span) => {
          // Check cache first
          const cacheKey =
            span.id ||
            `${span.start ?? 0}-${span.end ?? 0}-${span.category || span.role || ''}`;

          const cached = validationCacheRef.current.get(cacheKey);
          if (cached) {
            if (cached.pass) {
              valid.push(span);
            } else {
              const invalidItem: { span: Span; reason?: string } = { span };
              if (cached.reason !== undefined) {
                invalidItem.reason = cached.reason;
              }
              invalid.push(invalidItem);
            }
            return;
          }

          // Run validation
          const result = validator(span);

          // Cache result
          validationCacheRef.current.set(cacheKey, result);

          if (result.pass) {
            valid.push(span);
          } else {
            const invalidItem: { span: Span; reason?: string } = { span };
            if (result.reason !== undefined) {
              invalidItem.reason = result.reason;
            }
            invalid.push(invalidItem);
          }
        });

        validationResultRef.current = {
          valid,
          invalid,
          validatedAt: Date.now(),
        };
      }, delay),
    [validator, delay]
  );

  // Trigger validation when spans change
  useEffect(() => {
    if (!spans || spans.length === 0) {
      validationResultRef.current = {
        valid: [],
        invalid: [],
        validatedAt: null,
      };
      return;
    }

    debouncedValidate(spans);

    return () => {
      debouncedValidate.cancel();
    };
  }, [spans, debouncedValidate]);

  // Manual trigger for immediate validation
  const validateNow = useCallback(() => {
    debouncedValidate.cancel();
    if (spans && spans.length > 0) {
      debouncedValidate(spans);
    }
  }, [spans, debouncedValidate]);

  // Clear cache
  const clearCache = useCallback(() => {
    validationCacheRef.current.clear();
  }, []);

  return {
    validationResult: validationResultRef.current,
    validateNow,
    clearCache,
  };
}

