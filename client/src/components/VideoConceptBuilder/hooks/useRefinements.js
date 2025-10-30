/**
 * Refinements Hook
 *
 * Manages fetching refinement suggestions for existing elements.
 */

import { useCallback, useRef } from 'react';
import { VideoConceptApi } from '../api/videoConceptApi';
import { PRIMARY_ELEMENT_KEYS } from '../config/constants';

/**
 * Custom hook for managing refinement suggestions
 * @param {Function} dispatch - State dispatch function
 * @returns {Function} Fetch refinements function
 */
export function useRefinements(dispatch) {
  const requestIdRef = useRef(0);

  const fetchRefinements = useCallback(
    async (elements) => {
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
