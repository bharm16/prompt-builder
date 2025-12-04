/**
 * OpenAI-specific LLM Client
 * 
 * Extends RobustLlmClient with OpenAI/GPT-4o optimizations:
 * - Developer role for hard constraints (highest priority)
 * - Bookending strategy for format adherence
 * - Strict JSON schema mode (grammar-constrained)
 * - Temperature 0.0 for deterministic output
 * 
 * These optimizations are primarily handled by OpenAICompatibleAdapter,
 * but this client ensures proper configuration via hooks.
 */

import { RobustLlmClient, ProviderRequestOptions } from './RobustLlmClient.js';
import type { ILlmClient } from './ILlmClient.js';
import type { LabelSpansResult } from '../types.js';
import { logger } from '@infrastructure/Logger';

/**
 * OpenAI/GPT-4o optimized LLM client
 * 
 * Key OpenAI-specific optimizations:
 * 1. Developer role: Highest priority instructions for hard constraints
 * 2. Bookending: Repeat format instructions at start and end
 * 3. Strict JSON schema: Grammar-constrained decoding guarantees format
 * 4. Temperature 0.0: Deterministic structured output
 * 
 * No post-processing needed - OpenAI's strict schema ensures correctness
 * at generation time, eliminating the need for confidence adjustment.
 */
export class OpenAILlmClient extends RobustLlmClient implements ILlmClient {
  
  /**
   * HOOK: Configure OpenAI-specific request options
   * 
   * OpenAI Best Practices:
   * - enableBookending: Repeat instructions at end for long contexts
   * - useFewShot: false - OpenAI uses rich schema descriptions instead
   * - useSeedFromConfig: Enable seed for reproducibility
   * - enableLogprobs: false - Not needed with strict schema
   */
  protected _getProviderRequestOptions(): ProviderRequestOptions {
    return {
      enableBookending: true, // OpenAI benefits from bookending
      useFewShot: false, // OpenAI uses schema descriptions instead
      useSeedFromConfig: true, // Enable seed for reproducibility
      enableLogprobs: false, // Not needed - strict schema ensures correctness
    };
  }

  /**
   * HOOK: Provider name for logging and prompt building
   */
  protected _getProviderName(): string {
    return 'openai';
  }

  /**
   * HOOK: Post-process result
   * 
   * OpenAI doesn't need confidence adjustment because:
   * 1. Strict schema mode guarantees format compliance at generation time
   * 2. Temperature 0.0 provides consistent, deterministic outputs
   * 3. Grammar-constrained decoding prevents schema violations
   * 
   * Just add provider metadata for debugging.
   */
  protected _postProcessResult(result: LabelSpansResult): LabelSpansResult {
    logger.debug('OpenAILlmClient: Returning result without adjustment', {
      spanCount: result.spans?.length || 0,
    });

    return {
      ...result,
      meta: {
        ...result.meta,
        _clientType: 'OpenAILlmClient',
        _providerOptimizations: {
          provider: 'openai',
          strictSchema: true,
          logprobsAdjustment: false, // Explicitly not applied
        },
      },
    };
  }
}
