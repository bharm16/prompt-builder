/**
 * Types for LLM services
 */

import type { ExecuteParams } from '@services/ai-model/AIModelService';
import type { AIResponse } from '@interfaces/IAIClient';

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
  execute: (operation: string, params: ExecuteParams) => Promise<AIResponse>;
}
