/**
 * API Layer for Span Labeling
 *
 * Centralizes all API calls for span labeling operations.
 * Each method returns a Promise that resolves with the API response data.
 */

import { API_CONFIG } from '@config/api.config';

/**
 * Default headers for span labeling API requests
 */
const DEFAULT_HEADERS = {
  'Content-Type': 'application/json',
  'X-API-Key': API_CONFIG.apiKey,
};

/**
 * Builds the request body for span labeling API call
 * @private
 * @param {Object} payload - The span labeling payload
 * @returns {string} JSON string of the request body
 */
const buildBody = (payload) => {
  const body = {
    text: payload.text,
    maxSpans: payload.maxSpans,
    minConfidence: payload.minConfidence,
    policy: payload.policy,
    templateVersion: payload.templateVersion,
  };

  return JSON.stringify(body);
};

/**
 * Span Labeling API
 */
export class SpanLabelingApi {
  /**
   * Labels spans in the provided text
   *
   * @param {Object} payload - The span labeling request payload
   * @param {string} payload.text - Text to label
   * @param {number} [payload.maxSpans] - Maximum number of spans to return
   * @param {number} [payload.minConfidence] - Minimum confidence threshold
   * @param {Object} [payload.policy] - Policy configuration
   * @param {string} [payload.templateVersion] - Template version
   * @param {AbortSignal} [signal] - Optional abort signal for cancellation
   * @returns {Promise<Object>} Response with spans and metadata
   * @throws {Error} If the request fails
   */
  static async labelSpans(payload, signal = null) {
    const res = await fetch('/llm/label-spans', {
      method: 'POST',
      headers: DEFAULT_HEADERS,
      body: buildBody(payload),
      signal,
    });

    if (!res.ok) {
      let message = `Request failed with status ${res.status}`;
      try {
        const errorBody = await res.json();
        if (errorBody?.message) {
          message = errorBody.message;
        }
      } catch {
        // Ignore JSON parse errors and fall back to default message
      }
      const error = new Error(message);
      error.status = res.status;
      throw error;
    }

    const data = await res.json();
    return {
      spans: Array.isArray(data?.spans) ? data.spans : [],
      meta: data?.meta ?? null,
    };
  }
}
