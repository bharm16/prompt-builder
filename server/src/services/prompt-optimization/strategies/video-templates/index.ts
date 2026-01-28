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

import { logger } from '@infrastructure/Logger';
import { detectProvider } from '@utils/provider/ProviderDetector';
import { OpenAIVideoTemplateBuilder } from './OpenAIVideoTemplateBuilder';
import { OpenAIVideoTemplateBuilderLocked } from './OpenAIVideoTemplateBuilderLocked';
import { GroqVideoTemplateBuilder } from './GroqVideoTemplateBuilder';
import { GroqVideoTemplateBuilderLocked } from './GroqVideoTemplateBuilderLocked';
import type { BaseVideoTemplateBuilder } from './BaseVideoTemplateBuilder';

const log = logger.child({ service: 'VideoTemplateBuilderFactory' });

// Singleton instances (initialized on first use)
let openaiBuilder: OpenAIVideoTemplateBuilder | null = null;
let groqBuilder: GroqVideoTemplateBuilder | null = null;
let openaiLockedBuilder: OpenAIVideoTemplateBuilderLocked | null = null;
let groqLockedBuilder: GroqVideoTemplateBuilderLocked | null = null;

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
  lockedSpans?: Array<{ text: string }>;
}): BaseVideoTemplateBuilder {
  const operation = 'getVideoTemplateBuilder';
  
  log.debug('Getting video template builder', {
    operation,
    options,
  });
  
  const provider = detectProvider(options);
  const hasLockedSpans = Array.isArray(options.lockedSpans) && options.lockedSpans.length > 0;

  if (provider === 'openai') {
    if (hasLockedSpans) {
      if (!openaiLockedBuilder) {
        log.debug('Creating OpenAI locked video template builder instance', {
          operation,
          provider,
        });
        openaiLockedBuilder = new OpenAIVideoTemplateBuilderLocked();
      }
      log.debug('Returning OpenAI locked video template builder', {
        operation,
        provider,
      });
      return openaiLockedBuilder;
    }

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
  if (hasLockedSpans) {
    if (!groqLockedBuilder) {
      log.debug('Creating Groq locked video template builder instance', {
        operation,
        provider,
      });
      groqLockedBuilder = new GroqVideoTemplateBuilderLocked();
    }
    log.debug('Returning Groq locked video template builder', {
      operation,
      provider,
    });
    return groqLockedBuilder;
  }

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
export { BaseVideoTemplateBuilder } from './BaseVideoTemplateBuilder';
export type { VideoTemplateContext, VideoTemplateResult } from './BaseVideoTemplateBuilder';
export { OpenAIVideoTemplateBuilder } from './OpenAIVideoTemplateBuilder';
export { GroqVideoTemplateBuilder } from './GroqVideoTemplateBuilder';
export { OpenAIVideoTemplateBuilderLocked } from './OpenAIVideoTemplateBuilderLocked';
export { GroqVideoTemplateBuilderLocked } from './GroqVideoTemplateBuilderLocked';
