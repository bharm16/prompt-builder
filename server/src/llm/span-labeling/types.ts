/**
 * Types for span labeling service
 */

/**
 * Span from LLM response
 */
export interface LLMSpan {
  text: string;
  start?: number;
  end?: number;
  role: string;
  confidence?: number;
}

/**
 * Metadata from LLM response
 */
export interface LLMMeta {
  version: string;
  notes: string;
  [key: string]: unknown;
}

/**
 * LLM response structure
 */
export interface LLMResponse {
  spans?: LLMSpan[];
  meta?: LLMMeta;
  isAdversarial?: boolean;
  is_adversarial?: boolean;
}

/**
 * Validation policy
 */
export interface ValidationPolicy {
  nonTechnicalWordLimit?: number;
  allowOverlap?: boolean;
}

/**
 * Processing options
 */
export interface ProcessingOptions {
  maxSpans?: number;
  minConfidence?: number;
  templateVersion?: string;
}

/**
 * Label spans parameters
 */
export interface LabelSpansParams {
  text: string;
  maxSpans?: number;
  minConfidence?: number;
  policy?: ValidationPolicy;
  templateVersion?: string;
  enableRepair?: boolean;
}

/**
 * Validation result
 */
export interface ValidationResult {
  ok: boolean;
  errors: string[];
  result: {
    spans: LLMSpan[];
    meta: LLMMeta;
    isAdversarial?: boolean;
    analysisTrace?: string | null;
  };
}

/**
 * Label spans result
 */
export interface LabelSpansResult {
  spans: LLMSpan[];
  meta: LLMMeta;
  isAdversarial?: boolean;
  analysisTrace?: string | null;
}

