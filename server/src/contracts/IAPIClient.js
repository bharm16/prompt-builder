/**
 * Interface for API clients that communicate with LLM providers
 * Defines the contract that all API client implementations must follow
 *
 * This abstraction allows:
 * - Easy swapping of LLM providers (OpenAI, Groq, Claude, etc.)
 * - Mock implementations for testing
 * - Consistent error handling across providers
 * - Type-safe service dependencies
 */
export class IAPIClient {
  /**
   * Generate a completion from the LLM
   * @param {Object} params - Request parameters
   * @param {string} params.prompt - The prompt to send to the LLM
   * @param {Object} [params.options] - Additional options (temperature, max_tokens, etc.)
   * @returns {Promise<string>} The generated text
   * @throws {Error} If the API call fails
   */
  async generateCompletion(params) {
    throw new Error('Method not implemented');
  }

  /**
   * Check if the API client is healthy and accessible
   * @returns {Promise<{healthy: boolean, responseTime?: number, error?: string}>}
   */
  async healthCheck() {
    throw new Error('Method not implemented');
  }

  /**
   * Get the provider name (e.g., 'openai', 'groq', 'anthropic')
   * @returns {string}
   */
  getProvider() {
    throw new Error('Method not implemented');
  }

  /**
   * Get the model name being used
   * @returns {string}
   */
  getModel() {
    throw new Error('Method not implemented');
  }
}
