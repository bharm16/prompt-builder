/**
 * Groq-specific LLM Client
 * 
 * Extends RobustLlmClient with Groq/Llama 3 optimizations:
 * - Logprobs-based confidence adjustment
 * - Seed passthrough for reproducibility
 * - Min-P and stop sequence support (handled by adapter)
 * 
 * Llama 3 PDF References:
 * - Section 4.1: Logprobs more reliable than self-reported confidence
 * - Section 4.1: Min-P for dynamic truncation
 * - Section 4.3: Stop sequences prevent runaway generation
 */

import { RobustLlmClient } from './RobustLlmClient.js';
import type { LlmSpanParams, ILlmClient } from './ILlmClient.js';
import type { LabelSpansResult, LLMSpan } from '../types.js';
import { logger } from '@infrastructure/Logger';

/**
 * Groq/Llama 3 optimized LLM client
 * 
 * Key Groq-specific optimizations:
 * 1. Logprobs confidence adjustment: Uses token-level confidence to validate
 *    self-reported confidence scores
 * 2. Seed passthrough: Ensures reproducibility for caching and debugging
 * 3. Provider-specific request options forwarded to GroqLlamaAdapter
 * 
 * The base class handles most of the logic, but this subclass can be
 * extended with additional Groq-specific behavior as needed.
 */
export class GroqLlmClient extends RobustLlmClient implements ILlmClient {
  
  /**
   * Get spans using Groq/Llama 3 with provider-specific optimizations
   * 
   * Optimizations are handled by:
   * 1. GroqLlamaAdapter (min_p, stop sequences, sandwich prompting)
   * 2. Base class _postProcessResult (logprobs confidence adjustment)
   * 3. modelConfig.js (temperature 0.1, seed)
   */
  async getSpans(params: LlmSpanParams): Promise<LabelSpansResult> {
    logger.debug('GroqLlmClient.getSpans called', {
      textLength: params.text?.length,
      enableRepair: params.enableRepair,
    });

    // Call base implementation - it handles Groq-specific logic via isGroq flag
    const result = await super.getSpans(params);

    // Add Groq-specific metadata for debugging
    if (result.meta) {
      result.meta._clientType = 'GroqLlmClient';
    }

    return result;
  }

  /**
   * Override post-process to ensure Groq optimizations are applied
   * 
   * Llama 3 PDF Section 4.1: Logprobs Confidence
   * "Token-level probabilities are more reliable than asking the model
   * to self-report confidence. The model's actual certainty is revealed
   * in the logprobs, not in generated confidence scores."
   */
  protected _postProcessResult(result: LabelSpansResult, isGroq: boolean): LabelSpansResult {
    // Force isGroq to true since we're the Groq client
    // This ensures logprobs adjustment is always applied
    const processedResult = super._postProcessResult(result, true);

    // Add additional Groq-specific metadata
    if (processedResult.meta && this._lastResponseMetadata?.optimizations) {
      processedResult.meta._groqOptimizations = this._lastResponseMetadata.optimizations;
    }

    return processedResult;
  }
}
