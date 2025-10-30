/**
 * Element Suggestions Hook
 *
 * Manages fetching and handling AI suggestions for element values.
 * Includes deduplication, abort controller, and cooldown logic.
 */

import { useCallback, useRef } from 'react';
import { VideoConceptApi } from '../api/videoConceptApi';
import { formatLabel } from '../utils/formatting';

const COOLDOWN_MS = 800;

/**
 * Custom hook for managing element suggestions
 * @param {Function} dispatch - State dispatch function
 * @param {Object} composedElements - Composed element values
 * @param {string} concept - Overall concept description
 * @param {Array} conflicts - Current conflicts
 * @returns {Object} Suggestion methods
 */
export function useElementSuggestions(dispatch, composedElements, concept, conflicts) {
  const abortControllerRef = useRef(null);
  const lastRequestRef = useRef({ ts: 0, key: '' });
  const isFetchingRef = useRef(false);

  const fetchSuggestions = useCallback(
    async (elementType) => {
      // Build context object
      const contextObject = {
        ...composedElements,
        conflicts: (conflicts || []).map(conflict => ({
          message: conflict.message,
          resolution: conflict.resolution || conflict.suggestion || null,
          severity: conflict.severity || null,
        })),
      };

      // Build context summary for deduplication
      const contextSummary = Object.entries(contextObject)
        .filter(([key, value]) => {
          if (!value || key === elementType || key === 'subjectDescriptors') return false;
          if (key === 'conflicts') return value.length > 0;
          return true;
        })
        .map(([key, value]) => {
          if (key === 'conflicts') {
            return `${value.length} conflict${value.length === 1 ? '' : 's'} present`;
          }
          const displayValue = Array.isArray(value) ? value.join('; ') : value;
          return `${formatLabel(key)}: ${displayValue}`;
        })
        .join(', ');

      // Dedupe key
      const dedupeKey = `${elementType}|${composedElements[elementType] || ''}|${contextSummary}|${concept || ''}`;
      const now = Date.now();

      // Check cooldown
      if (lastRequestRef.current.key === dedupeKey && now - lastRequestRef.current.ts < COOLDOWN_MS) {
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
          composedElements[elementType],
          contextObject,
          concept,
          abortControllerRef.current.signal
        );

        dispatch({ type: 'SUGGESTIONS_LOADED', payload: suggestions });
      } catch (error) {
        if (error?.name === 'AbortError') {
          return;
        }
        console.error('Error fetching suggestions:', error);
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
