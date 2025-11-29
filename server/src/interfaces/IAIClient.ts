/**
 * AI Client Interface
 * Defines the contract for AI service clients
 * 
 * SOLID Principles Applied:
 * - ISP: Minimal interface with only essential methods
 * - DIP: Abstraction that high-level modules depend on
 */

export interface CompletionOptions {
  userMessage?: string;
  maxTokens?: number;
  temperature?: number;
  timeout?: number;
  signal?: AbortSignal;
  schema?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface AIResponseMetadata {
  model?: string;
  tokens?: number;
  finishReason?: string;
  [key: string]: unknown;
}

export interface AIResponse {
  text: string;
  metadata: AIResponseMetadata;
}

export class AIClientError extends Error {
  statusCode: number;
  originalError: unknown;

  constructor(message: string, statusCode: number, originalError: unknown = null) {
    super(message);
    this.name = 'AIClientError';
    this.statusCode = statusCode;
    this.originalError = originalError;
  }
}

export interface IAIClient {
  /**
   * Complete a prompt with the AI model
   */
  complete(systemPrompt: string, options?: CompletionOptions): Promise<AIResponse>;
}

