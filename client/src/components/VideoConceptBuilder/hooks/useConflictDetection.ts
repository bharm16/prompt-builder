/**
 * Conflict Detection Hook
 *
 * Manages detection of conflicts between element values.
 */

import { useCallback, useRef, type Dispatch } from 'react';
import { VideoConceptApi } from '../api/videoConceptApi';
import { PRIMARY_ELEMENT_KEYS } from '../config/constants';
import type { VideoConceptAction, Elements } from './types';

/**
 * Custom hook for managing conflict detection
 */
export function useConflictDetection(
  dispatch: Dispatch<VideoConceptAction>,
  composedElements: Record<string, string>
): (elements: Elements) => Promise<void> {
  const requestIdRef = useRef(0);

  const detectConflicts = useCallback(
    async (elements: Elements): Promise<void> => {
      const filledCount = PRIMARY_ELEMENT_KEYS.filter((key) => elements[key]).length;

      if (filledCount < 2) {
        dispatch({ type: 'CONFLICTS_CLEAR' });
        return;
      }

      const requestId = Date.now();
      requestIdRef.current = requestId;
      dispatch({ type: 'CONFLICTS_LOADING' });

      try {
        const data = await VideoConceptApi.validateElements(elements);

        if (requestIdRef.current === requestId) {
          const conflicts = Array.isArray(data.conflicts) ? data.conflicts : [];
          dispatch({ type: 'CONFLICTS_LOADED', payload: conflicts });
        }
      } catch (error) {
        console.error('Error detecting conflicts:', error);
        if (requestIdRef.current === requestId) {
          dispatch({ type: 'CONFLICTS_CLEAR' });
        }
      }
    },
    [dispatch]
  );

  return detectConflicts;
}

