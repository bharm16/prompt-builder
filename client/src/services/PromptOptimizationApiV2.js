/**
 * PromptOptimizationApiV2 - Enhanced API Service with Two-Stage Streaming
 *
 * Supports Server-Sent Events (SSE) for real-time draft and refinement updates
 * Provides fast perceived performance (~300ms to draft, full refinement in background)
 */

import { apiClient } from './ApiClient';

export class PromptOptimizationApiV2 {
  constructor(client = apiClient) {
    this.client = client;
  }

  /**
   * Optimize a prompt with legacy single-stage API (fallback)
   * @param {Object} options - Optimization options
   * @returns {Promise<{optimizedPrompt: string}>}
   */
  async optimizeLegacy({ prompt, mode, context = null, brainstormContext = null }) {
    return this.client.post('/optimize', {
      prompt,
      mode,
      context,
      brainstormContext,
    });
  }

  /**
   * Optimize a prompt with two-stage streaming
   *
   * @param {Object} options - Optimization options
   * @param {string} options.prompt - The prompt to optimize
   * @param {string} options.mode - Optimization mode
   * @param {Object} options.context - Additional context
   * @param {Object} options.brainstormContext - Brainstorm context
   * @param {Function} options.onDraft - Callback when draft is ready (draft: string) => void
   * @param {Function} options.onSpans - Callback when spans are ready (spans: Array, source: string) => void
   * @param {Function} options.onRefined - Callback when refinement is ready (refined: string, metadata: Object) => void
   * @param {Function} options.onError - Callback for errors (error: Error) => void
   * @returns {Promise<{draft: string, refined: string, spans: Array, metadata: Object}>}
   */
  async optimizeWithStreaming({
    prompt,
    mode,
    context = null,
    brainstormContext = null,
    onDraft = null,
    onSpans = null,
    onRefined = null,
    onError = null,
  }) {
    return new Promise((resolve, reject) => {
      let draft = null;
      let refined = null;
      let spans = null;
      let metadata = null;

      // Build request URL
      const baseUrl = this.client.getBaseUrl?.() || '/api';
      const url = `${baseUrl}/optimize-stream`;

      // Create EventSource for SSE
      // Note: EventSource only supports GET, so we use fetch with streaming instead
      this.streamWithFetch({
        url,
        method: 'POST',
        body: {
          prompt,
          mode,
          context,
          brainstormContext,
        },
        onMessage: (event, data) => {
          try {
            switch (event) {
              case 'draft':
                draft = data.draft;
                if (onDraft && typeof onDraft === 'function') {
                  onDraft(draft);
                }
                break;

              case 'spans':
                // New event type for parallel span labeling
                spans = data.spans;
                if (onSpans && typeof onSpans === 'function') {
                  onSpans(data.spans, data.source || 'unknown', data.meta);
                }
                break;

              case 'refined':
                refined = data.refined;
                metadata = data.metadata;
                if (onRefined && typeof onRefined === 'function') {
                  onRefined(refined, metadata);
                }
                break;

              case 'done':
                // Resolve with final result including spans
                resolve({
                  draft: draft || refined, // Fallback if draft wasn't sent
                  refined: refined || draft,
                  spans: spans || [],
                  metadata,
                  usedFallback: data.usedFallback || false,
                });
                break;

              case 'error':
                const error = new Error(data.error || 'Streaming optimization failed');
                if (onError && typeof onError === 'function') {
                  onError(error);
                }
                reject(error);
                break;
            }
          } catch (parseError) {
            console.error('Error parsing streaming event:', parseError);
          }
        },
        onError: (error) => {
          if (onError && typeof onError === 'function') {
            onError(error);
          }
          reject(error);
        },
      });
    });
  }

  /**
   * Internal method to handle SSE streaming with fetch
   * @private
   */
  async streamWithFetch({ url, method, body, onMessage, onError }) {
    try {
      const response = await fetch(url, {
        method: method || 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Parse SSE messages
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer

        let currentEvent = 'message'; // Default event type

        for (const line of lines) {
          if (line.startsWith('event: ')) {
            currentEvent = line.slice(7).trim();
          } else if (line.startsWith('data: ')) {
            const dataStr = line.slice(6);
            try {
              const data = JSON.parse(dataStr);
              onMessage(currentEvent, data);
            } catch (e) {
              console.warn('Failed to parse SSE data:', dataStr);
            }
          }
        }
      }
    } catch (error) {
      console.error('Streaming fetch error:', error);
      onError(error);
    }
  }

  /**
   * Optimize with automatic fallback to legacy API if streaming fails
   *
   * @param {Object} options - Same as optimizeWithStreaming
   * @returns {Promise<{draft: string, refined: string, metadata: Object}>}
   */
  async optimizeWithFallback(options) {
    try {
      // Try streaming first
      return await this.optimizeWithStreaming(options);
    } catch (streamingError) {
      console.warn('Streaming failed, falling back to legacy API:', streamingError);

      // Fallback to single-stage API
      const { prompt, mode, context, brainstormContext } = options;
      const result = await this.optimizeLegacy({
        prompt,
        mode,
        context,
        brainstormContext,
      });

      // Format as two-stage result
      const optimized = result.optimizedPrompt;
      return {
        draft: optimized,
        refined: optimized,
        metadata: { usedFallback: true },
        usedFallback: true,
      };
    }
  }

  /**
   * Get quality score for a prompt (same as V1)
   * @param {string} inputPrompt - Original prompt
   * @param {string} outputPrompt - Optimized prompt
   * @returns {number} Quality score (0-100)
   */
  calculateQualityScore(inputPrompt, outputPrompt) {
    let score = 0;
    const inputWords = inputPrompt.split(/\s+/).length;
    const outputWords = outputPrompt.split(/\s+/).length;

    // Length improvement
    if (outputWords > inputWords * 2) score += 25;
    else if (outputWords > inputWords) score += 15;

    // Structure (sections with headers)
    const sections = (outputPrompt.match(/\*\*/g) || []).length / 2;
    score += Math.min(sections * 10, 30);

    // Key components
    if (outputPrompt.includes('Goal')) score += 15;
    if (outputPrompt.includes('Return Format') || outputPrompt.includes('Research')) score += 15;
    if (outputPrompt.includes('Context') || outputPrompt.includes('Learning')) score += 15;

    return Math.min(score, 100);
  }
}

// Export singleton instance
export const promptOptimizationApiV2 = new PromptOptimizationApiV2();
