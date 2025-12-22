/**
 * useCustomRequest Hook
 *
 * Manages custom request input state and API interactions.
 * Following VideoConceptBuilder pattern: hooks/useElementSuggestions.ts
 *
 * Features:
 * - Request cancellation via SuggestionRequestManager
 * - 3-second timeout for requests
 * - Proper error handling (no error-as-suggestion anti-pattern)
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { fetchCustomSuggestions } from '../api/customSuggestionsApi';
import { logger } from '@/services/LoggingService';
import { SuggestionRequestManager } from '@features/prompt-optimizer/utils/SuggestionRequestManager';
import { CancellationError } from '@features/prompt-optimizer/utils/signalUtils';

import type { SuggestionItem } from './types';

interface UseCustomRequestParams {
  selectedText?: string;
  fullPrompt?: string;
  onCustomRequest?: (request: string) => Promise<SuggestionItem[]>;
  setSuggestions?: (suggestions: SuggestionItem[], category?: string) => void;
  /** NEW: Proper error state handler - Requirement 3.1 */
  setError?: (message: string) => void;
}

interface UseCustomRequestReturn {
  customRequest: string;
  setCustomRequest: (value: string) => void;
  handleCustomRequest: () => Promise<void>;
  isCustomLoading: boolean;
}

/** Configuration for request manager (no debounce for custom requests) */
const REQUEST_CONFIG = {
  debounceMs: 0, // No debounce - user explicitly clicked button
  timeoutMs: 3000,
};

/**
 * Custom hook for handling custom suggestion requests
 * 
 * Features:
 * - Request cancellation on new request
 * - 3-second timeout
 * - Proper error handling via setError callback
 */
export function useCustomRequest({
  selectedText = '',
  fullPrompt = '',
  onCustomRequest = undefined,
  setSuggestions = undefined,
  setError = undefined,
}: UseCustomRequestParams = {}): UseCustomRequestReturn {
  const [customRequest, setCustomRequest] = useState('');
  const [isCustomLoading, setIsCustomLoading] = useState(false);

  // Request manager instance (no debounce for custom requests)
  const requestManagerRef = useRef<SuggestionRequestManager>(
    new SuggestionRequestManager(REQUEST_CONFIG)
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      requestManagerRef.current.dispose();
    };
  }, []);

  /**
   * Handle custom request submission
   */
  const handleCustomRequest = useCallback(async (): Promise<void> => {
    if (!customRequest.trim()) return;

    const startTime = performance.now();
    const operation = 'handleCustomRequest';
    logger.startTimer(operation);
    
    setIsCustomLoading(true);
    
    // Clear any previous error
    if (setError) {
      setError('');
    }

    try {
      const result = await requestManagerRef.current.scheduleRequest(
        customRequest.trim(), // Use request text as dedup key
        async (signal) => {
          // If custom handler provided, use it
          if (typeof onCustomRequest === 'function') {
            return onCustomRequest(customRequest.trim());
          }
          
          // Otherwise, use default API with cancellation support
          const suggestions = await fetchCustomSuggestions({
            highlightedText: selectedText,
            customRequest: customRequest.trim(),
            fullPrompt,
            signal, // Pass abort signal for cancellation
          });

          // Convert string[] to SuggestionItem[]
          return suggestions.map((text) => ({ text })) as SuggestionItem[];
        }
      );

      // Update suggestions with result
      if (setSuggestions && Array.isArray(result)) {
        setSuggestions(result, undefined);
      }
      
      const duration = logger.endTimer(operation);
      logger.info('Custom suggestions fetched successfully', {
        hook: 'useCustomRequest',
        operation,
        duration,
        suggestionCount: Array.isArray(result) ? result.length : 0,
      });
    } catch (error) {
      // Silently ignore cancellation - don't update state
      if (error instanceof CancellationError) {
        return;
      }

      const duration = logger.endTimer(operation);
      logger.error('Error fetching custom suggestions', error as Error, {
        hook: 'useCustomRequest',
        operation,
        duration,
        customRequestLength: customRequest.trim().length,
        selectedTextLength: selectedText.length,
      });
      
      // Set error state properly (not as a fake suggestion) - Requirement 3.1
      if (setError) {
        setError('Failed to load custom suggestions. Please try again.');
      }
      // Note: We no longer set error as a suggestion item (removed anti-pattern)
    } finally {
      setIsCustomLoading(false);
      setCustomRequest('');
    }
  }, [customRequest, selectedText, fullPrompt, onCustomRequest, setSuggestions, setError]);

  return {
    customRequest,
    setCustomRequest,
    handleCustomRequest,
    isCustomLoading,
  };
}

