/**
 * Technical Parameters Hook
 *
 * Manages fetching technical parameters based on creative elements.
 */

import { useCallback, useRef, type Dispatch } from 'react';
import { VideoConceptApi } from '../api/videoConceptApi';
import { PRIMARY_ELEMENT_KEYS } from '../config/constants';
import type { VideoConceptAction, Elements } from './types';

/**
 * Custom hook for managing technical parameters
 */
export function useTechnicalParams(
  dispatch: Dispatch<VideoConceptAction>
): (elements: Elements) => Promise<Record<string, unknown> | null> {
  const requestIdRef = useRef(0);

  const fetchTechnicalParams = useCallback(
    async (elements: Elements): Promise<Record<string, unknown> | null> => {
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

