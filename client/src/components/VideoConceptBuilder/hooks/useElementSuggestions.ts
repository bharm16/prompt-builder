/**
 * Element Suggestions Hook
 *
 * Manages fetching and handling AI suggestions for element values.
 * Includes deduplication, abort controller, and cooldown logic.
 */

import { useCallback, useRef, type Dispatch } from 'react';
import { VideoConceptApi } from '../api/videoConceptApi';
import { formatLabel } from '../utils/formatting';
import { logger } from '@/services/LoggingService';
import type { VideoConceptAction, ElementKey } from './types';

const COOLDOWN_MS = 800;

interface ConflictItem {
  message: string;
  resolution?: string;
  suggestion?: string;
  severity?: string;
}

interface UseElementSuggestionsReturn {
  fetchSuggestions: (elementType: ElementKey) => Promise<void>;
  clearSuggestions: () => void;
}

/**
 * Custom hook for managing element suggestions
 */
export function useElementSuggestions(
  dispatch: Dispatch<VideoConceptAction>,
  composedElements: Record<string, string>,
  concept: string,
  conflicts: ConflictItem[]
): UseElementSuggestionsReturn {
  const abortControllerRef = useRef<AbortController | null>(null);
  const lastRequestRef = useRef<{ ts: number; key: string }>({ ts: 0, key: '' });
  const isFetchingRef = useRef(false);

  const fetchSuggestions = useCallback(
    async (elementType: ElementKey): Promise<void> => {
      // Build context object
      const contextObject: Record<string, unknown> = {
        ...composedElements,
        conflicts: (conflicts || []).map((conflict) => ({
          message: conflict.message,
          resolution: conflict.resolution || conflict.suggestion || null,
          severity: conflict.severity || null,
        })),
      };

      // Build context summary for deduplication
      const contextSummary = Object.entries(contextObject)
        .filter(([key, value]) => {
          if (!value || key === elementType || key === 'subjectDescriptors')
            return false;
          if (key === 'conflicts')
            return Array.isArray(value) && value.length > 0;
          return true;
        })
        .map(([key, value]) => {
          if (key === 'conflicts' && Array.isArray(value)) {
            return `${value.length} conflict${value.length === 1 ? '' : 's'} present`;
          }
          const displayValue = Array.isArray(value)
            ? value.join('; ')
            : String(value);
          return `${formatLabel(key)}: ${displayValue}`;
        })
        .join(', ');

      // Dedupe key
      const dedupeKey = `${elementType}|${composedElements[elementType] || ''}|${contextSummary}|${concept || ''}`;
      const now = Date.now();

      // Check cooldown
      if (
        lastRequestRef.current.key === dedupeKey &&
        now - lastRequestRef.current.ts < COOLDOWN_MS
      ) {
        return;
      }

      // Prevent concurrent fetches
      if (isFetchingRef.current) {
        return;
      }

      lastRequestRef.current = { key: dedupeKey, ts: now };

      // Abort previous request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();

      isFetchingRef.current = true;
      dispatch({ type: 'SUGGESTIONS_LOADING' });
      dispatch({ type: 'SET_ACTIVE_ELEMENT', payload: elementType });

      try {
        const suggestions = await VideoConceptApi.fetchSuggestions(
          elementType,
          composedElements[elementType] || '',
          contextObject as Record<string, string>,
          concept,
          abortControllerRef.current.signal
        );

        dispatch({ type: 'SUGGESTIONS_LOADED', payload: suggestions });
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          return;
        }
        logger.error('Error fetching suggestions', error as Error, {
          hook: 'useElementSuggestions',
          operation: 'fetchSuggestions',
          elementType,
          contextSummaryLength: contextSummary.length,
        });
        dispatch({ type: 'SUGGESTIONS_CLEAR' });
      } finally {
        isFetchingRef.current = false;
      }
    },
    [dispatch, composedElements, concept, conflicts]
  );

  const clearSuggestions = useCallback(() => {
    dispatch({ type: 'SUGGESTIONS_CLEAR' });
    dispatch({ type: 'SET_ACTIVE_ELEMENT', payload: null });
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  }, [dispatch]);

  return {
    fetchSuggestions,
    clearSuggestions,
  };
}

