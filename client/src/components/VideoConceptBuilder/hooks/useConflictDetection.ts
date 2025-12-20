/**
 * Conflict Detection Hook
 *
 * Manages detection of conflicts between element values.
 */

import { useCallback, useRef, type Dispatch } from 'react';
import { VideoConceptApi } from '../api/videoConceptApi';
import { PRIMARY_ELEMENT_KEYS } from '../config/constants';
import { logger } from '@/services/LoggingService';
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
      const startTime = performance.now();
      const operation = 'detectConflicts';
      const filledCount = PRIMARY_ELEMENT_KEYS.filter((key) => elements[key]).length;

      if (filledCount < 2) {
        dispatch({ type: 'CONFLICTS_CLEAR' });
        return;
      }

      const requestId = Date.now();
      requestIdRef.current = requestId;
      dispatch({ type: 'CONFLICTS_LOADING' });
      logger.startTimer(operation);

      try {
        const data = await VideoConceptApi.validateElements(elements);

        if (requestIdRef.current === requestId) {
          const duration = logger.endTimer(operation);
          const conflicts = Array.isArray(data.conflicts)
            ? data.conflicts.map((message) => ({ message }))
            : [];
          logger.info('Conflict detection completed', {
            hook: 'useConflictDetection',
            operation,
            duration,
            filledCount,
            conflictCount: conflicts.length,
          });
          dispatch({ type: 'CONFLICTS_LOADED', payload: conflicts });
        }
      } catch (error) {
        const duration = logger.endTimer(operation);
        logger.error('Error detecting conflicts', error as Error, {
          hook: 'useConflictDetection',
          operation,
          duration,
          filledCount,
        });
        if (requestIdRef.current === requestId) {
          dispatch({ type: 'CONFLICTS_CLEAR' });
        }
      }
    },
    [dispatch]
  );

  return detectConflicts;
}
