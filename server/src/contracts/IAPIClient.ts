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

export interface CompletionOptions {
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  stop?: string[];
  [key: string]: unknown;
}

export interface HealthCheckResult {
  healthy: boolean;
  responseTime?: number;
  error?: string;
}

export interface IAPIClient {
  /**
   * Generate a completion from the LLM
   */
  generateCompletion(params: { prompt: string; options?: CompletionOptions }): Promise<string>;

  /**
   * Check if the API client is healthy and accessible
   */
  healthCheck(): Promise<HealthCheckResult>;

  /**
   * Get the provider name (e.g., 'openai', 'groq', 'anthropic')
   */
  getProvider(): string;

  /**
   * Get the model name being used
   */
  getModel(): string;
}

