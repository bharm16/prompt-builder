/**
 * Validation schemas for enhancement suggestions
 * 
 * This module now delegates to the provider-aware SchemaFactory
 * for optimized schemas based on the LLM provider being used.
 */

import {
  getEnhancementSchema as getProviderEnhancementSchema,
  getCustomSuggestionSchema as getProviderCustomSuggestionSchema,
  type JSONSchema,
  type SchemaOptions,
} from '@utils/provider/SchemaFactory.js';

/**
 * Get schema for enhancement suggestions
 * 
 * Provider-aware: Returns optimized schema based on detected provider
 * - OpenAI: strict mode with rich descriptions
 * - Groq/Llama: simplified schema for 8B model
 * 
 * @param isPlaceholder - Whether this is for placeholder replacement
 * @param options - Optional provider detection options
 */
export function getEnhancementSchema(
  isPlaceholder: boolean,
  options: SchemaOptions = {}
): JSONSchema {
  return getProviderEnhancementSchema({
    ...options,
    isPlaceholder,
    operation: options.operation || 'enhance_suggestions',
  });
}

/**
 * Get schema for custom suggestions
 * 
 * @param options - Optional provider detection options
 */
export function getCustomSuggestionSchema(options: SchemaOptions = {}): JSONSchema {
  return getProviderCustomSuggestionSchema({
    ...options,
    operation: options.operation || 'enhance_suggestions',
  });
}

// Re-export types for convenience
export type { JSONSchema, SchemaOptions };
