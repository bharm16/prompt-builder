/**
 * Compatibility Scores Hook
 *
 * Manages compatibility score checking with debouncing.
 */

import { useCallback, useRef, useEffect } from 'react';
import { VideoConceptApi } from '../api/videoConceptApi';

const DEBOUNCE_MS = 500;

/**
 * Custom hook for managing compatibility scores
 * @param {Function} dispatch - State dispatch function
 * @param {Object} composedElements - Composed element values
 * @returns {Function} Check compatibility function
 */
export function useCompatibilityScores(dispatch, composedElements) {
  const timersRef = useRef({});

  const checkCompatibility = useCallback(
    (elementKey, value, elements = null) => {
      if (!value) {
        dispatch({
          type: 'SET_COMPATIBILITY_SCORE',
          payload: { key: elementKey, score: 1 },
        });
        return;
      }

      // Clear existing timer for this element
      if (timersRef.current[elementKey]) {
        clearTimeout(timersRef.current[elementKey]);
      }

      // Debounce compatibility check
      timersRef.current[elementKey] = setTimeout(async () => {
        try {
          const score = await VideoConceptApi.checkCompatibility(
            elementKey,
            value,
            elements || composedElements
          );

          dispatch({
            type: 'SET_COMPATIBILITY_SCORE',
            payload: { key: elementKey, score },
          });
        } catch (error) {
          console.error('Error checking compatibility:', error);
          dispatch({
            type: 'SET_COMPATIBILITY_SCORE',
            payload: { key: elementKey, score: 0.5 },
          });
        }
      }, DEBOUNCE_MS);
    },
    [dispatch, composedElements]
  );

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      Object.values(timersRef.current).forEach((timer) => clearTimeout(timer));
    };
  }, []);

  return checkCompatibility;
}
