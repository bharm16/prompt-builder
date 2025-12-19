/**
 * Types for LLM services
 */

/**
 * Input span for role classification
 */
export interface InputSpan {
  text: string;
  start: number;
  end: number;
}

/**
 * Labeled span with role and confidence
 */
export interface LabeledSpan {
  text: string;
  start: number;
  end: number;
  role: string;
  confidence: number;
}

/**
 * AI Service interface
 */
export interface AIService {
  execute: (operation: string, params: {
    systemPrompt?: string;
    userMessage?: string;
    maxTokens?: number;
    jsonMode?: boolean;
  }) => Promise<{
    text?: string;
    content?: Array<{ text?: string }>;
  }>;
}

