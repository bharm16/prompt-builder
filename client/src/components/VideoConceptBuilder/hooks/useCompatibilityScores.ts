/**
 * Compatibility Scores Hook
 *
 * Manages compatibility score checking with debouncing.
 */

import { useCallback, useRef, useEffect, type Dispatch } from 'react';
import { VideoConceptApi } from '../api/videoConceptApi';
import type { VideoConceptAction, ElementKey } from './types';

const DEBOUNCE_MS = 500;

/**
 * Custom hook for managing compatibility scores
 */
export function useCompatibilityScores(
  dispatch: Dispatch<VideoConceptAction>,
  composedElements: Record<string, string>
): (elementKey: ElementKey, value: string, elements?: Record<string, string>) => void {
  const timersRef = useRef<Record<string, NodeJS.Timeout>>({});

  const checkCompatibility = useCallback(
    (
      elementKey: ElementKey,
      value: string,
      elements: Record<string, string> | undefined = undefined
    ): void => {
      if (!value) {
        dispatch({
          type: 'SET_COMPATIBILITY_SCORE',
          payload: { key: elementKey, score: 1 },
        });
        return;
      }

      // Clear existing timer for this element
      const existingTimer = timersRef.current[elementKey];
      if (existingTimer) {
        clearTimeout(existingTimer);
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

