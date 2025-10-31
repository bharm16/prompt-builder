/**
 * useCustomRequest Hook
 *
 * Manages custom request input state and API interactions.
 * Following VideoConceptBuilder pattern: hooks/useElementSuggestions.js
 */

import { useState, useCallback } from 'react';
import { fetchCustomSuggestions } from '../api/customSuggestionsApi';

/**
 * Custom hook for handling custom suggestion requests
 *
 * @param {Object} params - Hook parameters
 * @param {string} params.selectedText - Currently selected text
 * @param {string} params.fullPrompt - Full prompt context
 * @param {Function} params.onCustomRequest - Optional custom handler
 * @param {Function} params.setSuggestions - Function to update suggestions
 * @returns {Object} Custom request state and handler
 */
export function useCustomRequest({
  selectedText = '',
  fullPrompt = '',
  onCustomRequest = null,
  setSuggestions = null,
}) {
  const [customRequest, setCustomRequest] = useState('');
  const [isCustomLoading, setIsCustomLoading] = useState(false);

  /**
   * Handle custom request submission
   */
  const handleCustomRequest = useCallback(async () => {
    if (!customRequest.trim()) return;

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

        setSuggestions(suggestions, undefined);
      }
    } catch (error) {
      console.error('Error fetching custom suggestions:', error);
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
