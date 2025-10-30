/**
 * Conflict Detection Hook
 *
 * Manages detection of conflicts between element values.
 */

import { useCallback, useRef } from 'react';
import { VideoConceptApi } from '../api/videoConceptApi';
import { PRIMARY_ELEMENT_KEYS } from '../config/constants';

/**
 * Custom hook for managing conflict detection
 * @param {Function} dispatch - State dispatch function
 * @param {Object} composedElements - Composed element values
 * @returns {Function} Detect conflicts function
 */
export function useConflictDetection(dispatch, composedElements) {
  const requestIdRef = useRef(0);

  const detectConflicts = useCallback(
    async (elements) => {
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
          dispatch({ type: 'CONFLICTS_LOADED', payload: data.conflicts || [] });
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
