/**
 * VideoConceptApi - API Service for Video Concept Operations
 *
 * Handles all API calls related to video concept building and wizard
 */

import { apiClient } from './ApiClient';

export class VideoConceptApi {
  constructor(client = apiClient) {
    this.client = client;
  }

  /**
   * Get suggestions for a specific video element
   * @param {Object} options - Suggestion options
   * @param {string} options.elementType - Type of element (subject, action, location, etc.)
   * @param {string} options.currentValue - Current value of the element
   * @param {Object} options.context - Context from other elements
   * @param {string} options.concept - Overall concept
   * @returns {Promise<{suggestions: Array}>}
   */
  async getSuggestions({ elementType, currentValue = '', context = {}, concept = '' }) {
    return this.client.post('/video/suggestions', {
      elementType,
      currentValue,
      context,
      concept,
    });
  }

  /**
   * Validate video prompt completeness
   * @param {Object} options - Validation options
   * @param {Object} options.elements - Video elements
   * @param {string} options.concept - Overall concept
   * @returns {Promise<{score: number, feedback: Array, strengths: Array, weaknesses: Array}>}
   */
  async validatePrompt({ elements, concept = '' }) {
    return this.client.post('/video/validate', {
      elements,
      concept,
    });
  }

  /**
   * Get compatibility check for video elements
   * @param {Object} elements - Video elements to check
   * @returns {Promise<{compatible: boolean, issues: Array}>}
   */
  async checkCompatibility(elements) {
    return this.client.post('/video/compatibility', {
      elements,
    });
  }
}

// Export singleton instance
export const videoConceptApi = new VideoConceptApi();
