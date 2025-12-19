/**
 * Video Template Builder Factory
 *
 * Routes to provider-specific template builders based on detected provider.
 * Follows the factory pattern established in the Enhancement service.
 *
 * Architecture:
 * - Singleton instances for performance
 * - Provider detection via ProviderDetector
 * - Returns appropriate builder (OpenAI vs Groq)
 */

import { logger } from '../../../../infrastructure/Logger.js';
import { detectProvider } from '@utils/provider/ProviderDetector.js';
import { OpenAIVideoTemplateBuilder } from './OpenAIVideoTemplateBuilder.js';
import { GroqVideoTemplateBuilder } from './GroqVideoTemplateBuilder.js';
import type { BaseVideoTemplateBuilder } from './BaseVideoTemplateBuilder.js';

const log = logger.child({ service: 'VideoTemplateBuilderFactory' });

// Singleton instances (initialized on first use)
let openaiBuilder: OpenAIVideoTemplateBuilder | null = null;
let groqBuilder: GroqVideoTemplateBuilder | null = null;

/**
 * Get template builder based on provider detection
 *
 * @param options - Provider detection options
 * @returns Provider-specific template builder
 *
 * @example
 * ```typescript
 * const builder = getVideoTemplateBuilder({
 *   operation: 'optimize_standard',
 *   client: 'openai'
 * });
 *
 * const template = builder.buildTemplate({
 *   userConcept: 'A cat walking',
 *   includeInstructions: true
 * });
 * ```
 */
export function getVideoTemplateBuilder(options: {
  operation?: string;
  model?: string;
  client?: string;
}): BaseVideoTemplateBuilder {
  const operation = 'getVideoTemplateBuilder';
  
  log.debug('Getting video template builder', {
    operation,
    options,
  });
  
  const provider = detectProvider(options);

  if (provider === 'openai') {
    if (!openaiBuilder) {
      log.debug('Creating OpenAI video template builder instance', {
        operation,
        provider,
      });
      openaiBuilder = new OpenAIVideoTemplateBuilder();
    }
    
    log.debug('Returning OpenAI video template builder', {
      operation,
      provider,
    });
    
    return openaiBuilder;
  }

  // Default to Groq for all other providers
  // (Anthropic, Gemini, and unknown providers use Groq template)
  if (!groqBuilder) {
    log.debug('Creating Groq video template builder instance', {
      operation,
      provider,
    });
    groqBuilder = new GroqVideoTemplateBuilder();
  }
  
  log.debug('Returning Groq video template builder', {
    operation,
    provider,
  });
  
  return groqBuilder;
}

/**
 * Create a new template builder instance (for testing)
 *
 * @param provider - Provider type
 * @returns New template builder instance
 */
export function createVideoTemplateBuilder(provider: 'openai' | 'groq'): BaseVideoTemplateBuilder {
  const operation = 'createVideoTemplateBuilder';
  
  log.debug('Creating new video template builder instance', {
    operation,
    provider,
  });
  
  if (provider === 'openai') {
    return new OpenAIVideoTemplateBuilder();
  }
  return new GroqVideoTemplateBuilder();
}

// Re-export types and classes
export { BaseVideoTemplateBuilder } from './BaseVideoTemplateBuilder.js';
export type { VideoTemplateContext, VideoTemplateResult } from './BaseVideoTemplateBuilder.js';
export { OpenAIVideoTemplateBuilder } from './OpenAIVideoTemplateBuilder.js';
export { GroqVideoTemplateBuilder } from './GroqVideoTemplateBuilder.js';
