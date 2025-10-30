/**
 * Technical Parameters Hook
 *
 * Manages fetching technical parameters based on creative elements.
 */

import { useCallback, useRef } from 'react';
import { VideoConceptApi } from '../api/videoConceptApi';
import { PRIMARY_ELEMENT_KEYS } from '../config/constants';

/**
 * Custom hook for managing technical parameters
 * @param {Function} dispatch - State dispatch function
 * @returns {Function} Fetch technical params function
 */
export function useTechnicalParams(dispatch) {
  const requestIdRef = useRef(0);

  const fetchTechnicalParams = useCallback(
    async (elements) => {
      const filledCount = PRIMARY_ELEMENT_KEYS.filter((key) => elements[key]).length;

      if (filledCount < 3) {
        dispatch({ type: 'TECHNICAL_PARAMS_CLEAR' });
        return null;
      }

      const requestId = Date.now();
      requestIdRef.current = requestId;
      dispatch({ type: 'TECHNICAL_PARAMS_LOADING' });

      try {
        const params = await VideoConceptApi.generateTechnicalParams(elements);

        if (requestIdRef.current === requestId) {
          dispatch({ type: 'TECHNICAL_PARAMS_LOADED', payload: params });
        }

        return params;
      } catch (error) {
        console.error('Error generating technical parameters:', error);
        if (requestIdRef.current === requestId) {
          dispatch({ type: 'TECHNICAL_PARAMS_CLEAR' });
        }
        return {};
      }
    },
    [dispatch]
  );

  return fetchTechnicalParams;
}
