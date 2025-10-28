/**
 * EnhancementApi - API Service for Prompt Enhancement
 *
 * Handles all API calls related to prompt enhancement and suggestions
 */

import { apiClient } from './ApiClient';

export class EnhancementApi {
  constructor(client = apiClient) {
    this.client = client;
  }

  /**
   * Get enhancement suggestions for highlighted text
   * @param {Object} options - Suggestion options
   * @param {string} options.highlightedText - The highlighted text
   * @param {string} options.contextBefore - Context before the highlight
   * @param {string} options.contextAfter - Context after the highlight
   * @param {string} options.fullPrompt - The full prompt
   * @param {string} options.originalUserPrompt - Original user input
   * @param {Object} options.brainstormContext - Brainstorm context
   * @param {string} options.highlightedCategory - Category of highlight
   * @param {number} options.highlightedCategoryConfidence - Confidence level
   * @param {string} options.highlightedPhrase - Highlighted phrase
   * @returns {Promise<{suggestions: Array, isPlaceholder: boolean}>}
   */
  async getSuggestions({
    highlightedText,
    contextBefore,
    contextAfter,
    fullPrompt,
    originalUserPrompt,
    brainstormContext = null,
    highlightedCategory = null,
    highlightedCategoryConfidence = null,
    highlightedPhrase = null,
  }) {
    return this.client.post('/get-enhancement-suggestions', {
      highlightedText,
      contextBefore,
      contextAfter,
      fullPrompt,
      originalUserPrompt,
      brainstormContext,
      highlightedCategory,
      highlightedCategoryConfidence,
      highlightedPhrase,
    });
  }

  /**
   * Detect scene changes in a prompt
   * @param {Object} options - Scene detection options
   * @param {string} options.originalPrompt - Original prompt
   * @param {string} options.updatedPrompt - Updated prompt
   * @param {string} options.oldValue - Old value that was replaced
   * @param {string} options.newValue - New value
   * @returns {Promise<{hasSceneChange: boolean, updatedPrompt: string}>}
   */
  async detectSceneChange({ originalPrompt, updatedPrompt, oldValue, newValue }) {
    return this.client.post('/detect-scene-change', {
      originalPrompt,
      updatedPrompt,
      oldValue,
      newValue,
    });
  }

  /**
   * Label text spans with categories
   * @param {Object} options - Labeling options
   * @param {string} options.prompt - The prompt to label
   * @param {string} options.cacheId - Cache ID for caching
   * @param {string} options.parserVersion - Parser version
   * @returns {Promise<{spans: Array, meta: Object, signature: string}>}
   */
  async labelSpans({ prompt, cacheId = null, parserVersion = 'llm-v1' }) {
    return this.client.post('/llm/label-spans', {
      prompt,
      cacheId,
      parserVersion,
    });
  }
}

// Export singleton instance
export const enhancementApi = new EnhancementApi();
