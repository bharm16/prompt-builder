/**
 * Refinements Hook
 *
 * Manages fetching refinement suggestions for existing elements.
 */

import { useCallback, useRef, type Dispatch } from 'react';
import { VideoConceptApi } from '../api/videoConceptApi';
import { PRIMARY_ELEMENT_KEYS } from '../config/constants';
import type { VideoConceptAction, Elements } from './types';

/**
 * Custom hook for managing refinement suggestions
 */
export function useRefinements(
  dispatch: Dispatch<VideoConceptAction>
): (elements: Elements) => Promise<void> {
  const requestIdRef = useRef(0);

  const fetchRefinements = useCallback(
    async (elements: Elements): Promise<void> => {
      const filledCount = PRIMARY_ELEMENT_KEYS.filter((key) => elements[key]).length;

      if (filledCount < 2) {
        dispatch({ type: 'REFINEMENTS_CLEAR' });
        return;
      }

      const requestId = Date.now();
      requestIdRef.current = requestId;
      dispatch({ type: 'REFINEMENTS_LOADING' });

      try {
        const refinements = await VideoConceptApi.fetchRefinements(elements);

        if (requestIdRef.current === requestId) {
          dispatch({ type: 'REFINEMENTS_LOADED', payload: refinements });
        }
      } catch (error) {
        console.error('Error fetching refinements:', error);
        if (requestIdRef.current === requestId) {
          dispatch({ type: 'REFINEMENTS_CLEAR' });
        }
      }
    },
    [dispatch]
  );

  return fetchRefinements;
}

