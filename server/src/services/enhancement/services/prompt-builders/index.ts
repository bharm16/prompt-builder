/**
 * Prompt Builder Factory
 * 
 * Creates the appropriate prompt builder based on provider.
 * Uses dependency injection pattern for testability.
 */

import { OpenAIPromptBuilder } from './OpenAIPromptBuilder.js';
import { GroqPromptBuilder } from './GroqPromptBuilder.js';
import type { IPromptBuilder } from './IPromptBuilder.js';

// Singleton instances
let openaiBuilder: OpenAIPromptBuilder | null = null;
let groqBuilder: GroqPromptBuilder | null = null;

/**
 * Get the appropriate prompt builder for a provider
 * 
 * @param provider - 'openai' or 'groq'
 * @returns Prompt builder instance
 */
export function getPromptBuilder(provider: 'openai' | 'groq'): IPromptBuilder {
  if (provider === 'openai') {
    if (!openaiBuilder) {
      openaiBuilder = new OpenAIPromptBuilder();
    }
    return openaiBuilder;
  }
  
  if (!groqBuilder) {
    groqBuilder = new GroqPromptBuilder();
  }
  return groqBuilder;
}

/**
 * Create a new prompt builder instance (for testing)
 * 
 * @param provider - 'openai' or 'groq'
 * @returns New prompt builder instance
 */
export function createPromptBuilder(provider: 'openai' | 'groq'): IPromptBuilder {
  if (provider === 'openai') {
    return new OpenAIPromptBuilder();
  }
  return new GroqPromptBuilder();
}

// Re-export types and classes
export type { IPromptBuilder, PromptBuildResult, SharedPromptContext } from './IPromptBuilder.js';
export { OpenAIPromptBuilder } from './OpenAIPromptBuilder.js';
export { GroqPromptBuilder } from './GroqPromptBuilder.js';
export { BasePromptBuilder } from './BasePromptBuilder.js';
