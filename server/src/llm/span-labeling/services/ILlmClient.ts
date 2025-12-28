/**
 * LLM Client Interface
 * 
 * Base interface for provider-specific LLM clients.
 * Each provider (Groq, OpenAI, etc.) implements this interface
 * with provider-specific optimizations.
 */

import type { LabelSpansResult, ValidationPolicy, ProcessingOptions } from '../types';
import type { AIService as BaseAIService } from '@services/enhancement/services/types';
import { SubstringPositionCache } from '../cache/SubstringPositionCache';

/**
 * Parameters for LLM span extraction
 */
export interface LlmSpanParams {
  text: string;
  policy: ValidationPolicy;
  options: ProcessingOptions;
  enableRepair: boolean;
  aiService: BaseAIService;
  cache: SubstringPositionCache;
  nlpSpansAttempted?: number;
}

/**
 * Base interface for all LLM clients
 */
export interface ILlmClient {
  /**
   * Get spans using LLM with validation and optional repair
   */
  getSpans(params: LlmSpanParams): Promise<LabelSpansResult>;
}

/**
 * Provider type for factory selection
 */
export type LlmClientProvider = 'groq' | 'openai' | 'anthropic' | 'gemini' | 'unknown';
