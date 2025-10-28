/**
 * PromptOptimizationApi - API Service for Prompt Optimization
 *
 * Handles all API calls related to prompt optimization
 * Decoupled from components for better testability and maintainability
 */

import { apiClient } from './ApiClient';

export class PromptOptimizationApi {
  constructor(client = apiClient) {
    this.client = client;
  }

  /**
   * Optimize a prompt
   * @param {Object} options - Optimization options
   * @param {string} options.prompt - The prompt to optimize
   * @param {string} options.mode - Optimization mode (optimize, reasoning, research, etc.)
   * @param {Object} options.context - Additional context
   * @param {Object} options.brainstormContext - Brainstorm context
   * @returns {Promise<{optimizedPrompt: string}>}
   */
  async optimize({ prompt, mode, context = null, brainstormContext = null }) {
    return this.client.post('/optimize', {
      prompt,
      mode,
      context,
      brainstormContext,
    });
  }

  /**
   * Get quality score for a prompt
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
export const promptOptimizationApi = new PromptOptimizationApi();
