/**
 * API Layer for Video Concept Builder
 *
 * Centralizes all API calls for video concept operations.
 * Each method returns a Promise that resolves with the API response data.
 */

import { API_CONFIG } from '../../../config/api.config';

/**
 * Base fetch wrapper with error handling
 * @private
 */
async function apiFetch(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': API_CONFIG.apiKey,
      ...options.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`API request failed: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Video Concept API
 */
export class VideoConceptApi {
  /**
   * Validates elements for compatibility and conflicts
   * @param {Object} elements - Element values to validate
   * @param {string} elementType - Optional specific element type
   * @param {string} value - Optional specific value
   * @returns {Promise<Object>} Validation results
   */
  static async validateElements(elements, elementType = null, value = null) {
    const body = { elements };
    if (elementType) body.elementType = elementType;
    if (value) body.value = value;

    return apiFetch('/api/video/validate', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  /**
   * Checks compatibility of a specific element value
   * @param {string} elementType - Type of element
   * @param {string} value - Element value
   * @param {Object} elements - Current element values
   * @returns {Promise<number>} Compatibility score (0-1)
   */
  static async checkCompatibility(elementType, value, elements) {
    const data = await apiFetch('/api/video/validate', {
      method: 'POST',
      body: JSON.stringify({
        elementType,
        value,
        elements,
      }),
    });

    return data?.compatibility?.score || 0.5;
  }

  /**
   * Fetches AI suggestions for an element
   * @param {string} elementType - Type of element
   * @param {string} currentValue - Current value of element
   * @param {Object} context - Context object with other elements
   * @param {string} concept - Overall concept description
   * @param {AbortSignal} signal - Optional abort signal
   * @returns {Promise<Array>} Array of suggestions
   */
  static async fetchSuggestions(elementType, currentValue, context, concept, signal = null) {
    const data = await apiFetch('/api/video/suggestions', {
      method: 'POST',
      body: JSON.stringify({
        elementType,
        currentValue,
        context,
        concept,
      }),
      signal,
    });

    return data.suggestions || [];
  }

  /**
   * Auto-completes a scene with AI-generated elements
   * @param {Object} existingElements - Elements already filled
   * @param {string} concept - Overall concept description
   * @returns {Promise<Object>} Suggested element values
   */
  static async completeScene(existingElements, concept) {
    const data = await apiFetch('/api/video/complete', {
      method: 'POST',
      body: JSON.stringify({
        existingElements,
        concept,
      }),
    });

    return data.suggestions || {};
  }

  /**
   * Parses a concept description into structured elements
   * @param {string} concept - Concept description to parse
   * @returns {Promise<Object>} Parsed element values
   */
  static async parseConcept(concept) {
    const data = await apiFetch('/api/video/parse', {
      method: 'POST',
      body: JSON.stringify({ concept }),
    });

    return data.elements || {};
  }

  /**
   * Fetches refinement suggestions for existing elements
   * @param {Object} existingElements - Elements already filled
   * @returns {Promise<Object>} Refinement suggestions by element type
   */
  static async fetchRefinements(existingElements) {
    const data = await apiFetch('/api/video/complete', {
      method: 'POST',
      body: JSON.stringify({ existingElements }),
    });

    return data.smartDefaults?.refinements || data.refinements || {};
  }

  /**
   * Generates technical parameters based on creative elements
   * @param {Object} existingElements - Elements already filled
   * @returns {Promise<Object>} Technical parameters
   */
  static async generateTechnicalParams(existingElements) {
    const data = await apiFetch('/api/video/complete', {
      method: 'POST',
      body: JSON.stringify({
        existingElements,
        smartDefaultsFor: 'technical',
      }),
    });

    return (
      data.smartDefaults?.technical ||
      data.smartDefaults ||
      data.technicalParams ||
      {}
    );
  }
}
