/**
 * AI Client Interface
 * Defines the contract for AI service clients
 * 
 * SOLID Principles Applied:
 * - ISP: Minimal interface with only essential methods
 * - DIP: Abstraction that high-level modules depend on
 */
export class IAIClient {
  /**
   * Complete a prompt with the AI model
   * @param {string} systemPrompt - System instructions
   * @param {Object} options - Completion options
   * @param {string} [options.userMessage] - User message
   * @param {number} [options.maxTokens] - Maximum tokens to generate
   * @param {number} [options.temperature] - Temperature for generation
   * @param {number} [options.timeout] - Request timeout in milliseconds
   * @param {AbortSignal} [options.signal] - Abort signal for cancellation
   * @returns {Promise<AIResponse>} AI response
   * @throws {AIClientError} On API errors
   */
  async complete(systemPrompt, options = {}) {
    throw new Error('complete() must be implemented by subclass');
  }
}

/**
 * Standardized AI Response
 */
export class AIResponse {
  constructor(text, metadata = {}) {
    this.text = text;
    this.metadata = metadata; // model, tokens, finish_reason, etc.
  }
}

/**
 * Base AI Client Error
 */
export class AIClientError extends Error {
  constructor(message, statusCode, originalError = null) {
    super(message);
    this.name = 'AIClientError';
    this.statusCode = statusCode;
    this.originalError = originalError;
  }
}
