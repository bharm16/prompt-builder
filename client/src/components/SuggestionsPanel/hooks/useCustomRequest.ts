/**
 * useCustomRequest Hook
 *
 * Manages custom request input state and API interactions.
 * Following VideoConceptBuilder pattern: hooks/useElementSuggestions.ts
 */

import { useState, useCallback } from 'react';
import { fetchCustomSuggestions } from '../api/customSuggestionsApi';
import { logger } from '@/services/LoggingService';

import type { SuggestionItem } from './types';

interface UseCustomRequestParams {
  selectedText?: string;
  fullPrompt?: string;
  onCustomRequest?: (request: string) => Promise<SuggestionItem[]>;
  setSuggestions?: (suggestions: SuggestionItem[], category?: string) => void;
}

interface UseCustomRequestReturn {
  customRequest: string;
  setCustomRequest: (value: string) => void;
  handleCustomRequest: () => Promise<void>;
  isCustomLoading: boolean;
}

/**
 * Custom hook for handling custom suggestion requests
 */
export function useCustomRequest({
  selectedText = '',
  fullPrompt = '',
  onCustomRequest = undefined,
  setSuggestions = undefined,
}: UseCustomRequestParams = {}): UseCustomRequestReturn {
  const [customRequest, setCustomRequest] = useState('');
  const [isCustomLoading, setIsCustomLoading] = useState(false);

  /**
   * Handle custom request submission
   */
  const handleCustomRequest = useCallback(async (): Promise<void> => {
    if (!customRequest.trim()) return;

    const startTime = performance.now();
    const operation = 'handleCustomRequest';
    logger.startTimer(operation);
    
    setIsCustomLoading(true);
    try {
      // If custom handler provided, use it
      if (typeof onCustomRequest === 'function') {
        const result = await onCustomRequest(customRequest.trim());
        if (Array.isArray(result) && setSuggestions) {
          setSuggestions(result, undefined);
        }
      }
      // Otherwise, use default API
      else if (setSuggestions) {
        const suggestions = await fetchCustomSuggestions({
          highlightedText: selectedText,
          customRequest: customRequest.trim(),
          fullPrompt,
        });

        // Convert string[] to SuggestionItem[]
        const suggestionItems: SuggestionItem[] = suggestions.map((text) => ({
          text,
        })) as SuggestionItem[];

        setSuggestions(suggestionItems, undefined);
      }
      
      const duration = logger.endTimer(operation);
      logger.info('Custom suggestions fetched successfully', {
        hook: 'useCustomRequest',
        operation,
        duration,
        suggestionCount: setSuggestions ? 'unknown' : 0,
      });
    } catch (error) {
      const duration = logger.endTimer(operation);
      logger.error('Error fetching custom suggestions', error as Error, {
        hook: 'useCustomRequest',
        operation,
        duration,
        customRequestLength: customRequest.trim().length,
        selectedTextLength: selectedText.length,
      });
      if (setSuggestions) {
        setSuggestions(
          [{ text: 'Failed to load custom suggestions. Please try again.' }],
          undefined
        );
      }
    } finally {
      setIsCustomLoading(false);
      setCustomRequest('');
    }
  }, [customRequest, selectedText, fullPrompt, onCustomRequest, setSuggestions]);

  return {
    customRequest,
    setCustomRequest,
    handleCustomRequest,
    isCustomLoading,
  };
}

