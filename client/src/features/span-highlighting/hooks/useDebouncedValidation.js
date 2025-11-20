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

/**
 * Simple debounce utility
 */
function debounce(func, wait) {
  let timeoutId;
  
  const debounced = (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), wait);
  };
  
  debounced.cancel = () => clearTimeout(timeoutId);
  
  return debounced;
}

/**
 * Hook for debounced span validation
 * 
 * @param {Array} spans - Spans to validate
 * @param {Function} validator - Validation function that accepts a span
 * @param {number} delay - Debounce delay in milliseconds (default: 1000ms)
 * @returns {Object} Validation state and trigger function
 */
export function useDebouncedValidation(spans, validator, delay = 1000) {
  const validationCacheRef = useRef(new Map());
  const validationResultRef = useRef({
    valid: [],
    invalid: [],
    validatedAt: null,
  });

  // Create debounced validation function
  const debouncedValidate = useMemo(
    () =>
      debounce((spansToValidate) => {
        const valid = [];
        const invalid = [];

        spansToValidate.forEach((span) => {
          // Check cache first
          const cacheKey = span.id || `${span.start}-${span.end}-${span.category || span.role}`;
          
          if (validationCacheRef.current.has(cacheKey)) {
            const result = validationCacheRef.current.get(cacheKey);
            if (result.pass) {
              valid.push(span);
            } else {
              invalid.push({ span, reason: result.reason });
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
            invalid.push({ span, reason: result.reason });
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

