/**
 * Types for text categorization services
 * Shared type definitions used across text categorization modules
 */

/**
 * Category definition used for semantic parsing
 */
export interface CategoryDefinition {
  key: string;
  label: string;
  description: string;
  examples: string[];
  color?: string;
}

/**
 * Parsed span from text categorization
 */
export interface CategorizedSpan {
  id: string;
  category: string;
  phrase: string;
  start: number;
  end: number;
  leftContext: string;
  rightContext: string;
  source: string;
  version: string;
}

/**
 * Tag result from LLM parsing
 */
export interface CategoryTag {
  key: string;
  phrases: string[];
}

/**
 * LLM parsing result
 */
export interface LLMParseResult {
  tags: CategoryTag[];
}

