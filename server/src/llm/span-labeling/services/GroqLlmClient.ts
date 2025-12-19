/**
 * Groq-specific LLM Client
 * 
 * Extends RobustLlmClient with Groq/Llama 3 optimizations:
 * - Logprobs-based confidence adjustment (Section 4.1)
 * - Few-shot examples as message array (Section 3.3)
 * - Seed passthrough for reproducibility
 * - Min-P and stop sequences (handled by GroqLlamaAdapter)
 * 
 * Llama 3 PDF References:
 * - Section 4.1: Logprobs more reliable than self-reported confidence
 * - Section 3.3: Few-shot examples improve instruction following
 * - Section 4.1: Min-P for dynamic truncation
 * - Section 4.3: Stop sequences prevent runaway generation
 */

import { RobustLlmClient, ProviderRequestOptions, ModelResponse } from './RobustLlmClient.js';
import type { LlmSpanParams, ILlmClient } from './ILlmClient.js';
import type { LabelSpansResult, LLMSpan } from '../types.js';
import { logger } from '@infrastructure/Logger';

/**
 * Groq/Llama 3 optimized LLM client
 * 
 * Key Groq-specific optimizations:
 * 1. Logprobs confidence adjustment: Uses token-level probabilities to validate
 *    and cap self-reported confidence scores
 * 2. Few-shot examples: Sent as message array per Llama 3 best practices
 * 3. Seed passthrough: Ensures reproducibility for caching and debugging
 * 4. Provider-specific options forwarded to GroqLlamaAdapter (min_p, stop sequences)
 */
export class GroqLlmClient extends RobustLlmClient implements ILlmClient {
  
  /**
   * HOOK: Configure Groq-specific request options
   * 
   * Llama 3 PDF Best Practices:
   * - useFewShot: Section 3.3 - Few-shot examples as message array
   * - enableLogprobs: Section 4.1 - Token-level confidence
   * - useSeedFromConfig: Reproducibility for caching
   * - enableBookending: false - Groq adapter handles sandwich prompting
   */
  protected _getProviderRequestOptions(): ProviderRequestOptions {
    return {
      enableBookending: false, // GroqLlamaAdapter handles sandwich prompting
      useFewShot: true, // Llama 3 PDF Section 3.3
      useSeedFromConfig: true, // Enable seed for reproducibility
      enableLogprobs: true, // Llama 3 PDF Section 4.1
    };
  }

  /**
   * HOOK: Provider name for logging and prompt building
   */
  protected _getProviderName(): string {
    return 'groq';
  }

  /**
   * HOOK: Post-process result with logprobs confidence adjustment
   * 
   * Llama 3 PDF Section 4.1: Logprobs Confidence
   * "Token-level probabilities are more reliable than asking the model
   * to self-report confidence. The model's actual certainty is revealed
   * in the logprobs, not in generated confidence scores."
   * 
   * Strategy: Use Math.min(selfReported, logprobsAverage) to prevent
   * overconfident predictions. This caps confidence at what the model
   * actually believes based on token probabilities.
   */
  protected _postProcessResult(result: LabelSpansResult): LabelSpansResult {
    const metadata = this._lastResponseMetadata;
    
    // Skip if no logprobs data available
    if (!metadata?.averageConfidence) {
      logger.debug('GroqLlmClient: No logprobs data for confidence adjustment', {
        hasMetadata: !!metadata,
        spanCount: result.spans?.length || 0,
      });
      return this._addProviderMetadata(result, false);
    }

    const averageConfidence = metadata.averageConfidence;
    
    // Skip if no spans to adjust
    if (!result.spans?.length) {
      return this._addProviderMetadata(result, false);
    }

    // Adjust confidence for each span
    const adjustedSpans = result.spans.map((span: LLMSpan) => {
      const originalConfidence = span.confidence ?? 1.0;
      
      // Use minimum of self-reported and logprobs-derived confidence
      // This prevents overconfident predictions where the model claims
      // high confidence but token probabilities suggest uncertainty
      const adjustedConfidence = Math.min(originalConfidence, averageConfidence);
      
      // Log significant adjustments for debugging
      if (originalConfidence - adjustedConfidence > 0.1) {
        logger.debug('GroqLlmClient: Significant confidence adjustment', {
          spanText: span.text?.substring(0, 30),
          original: originalConfidence,
          adjusted: adjustedConfidence,
          logprobsAvg: averageConfidence,
        });
      }
      
      return {
        ...span,
        confidence: adjustedConfidence,
        // Store original for debugging
        _originalConfidence: originalConfidence,
      };
    });

    logger.info('GroqLlmClient: Applied logprobs confidence adjustment', {
      spanCount: adjustedSpans.length,
      averageLogprobsConfidence: averageConfidence,
      adjustedCount: adjustedSpans.filter(
        (s: LLMSpan & { _originalConfidence?: number }) => 
          s._originalConfidence && s._originalConfidence > s.confidence
      ).length,
    });

    return this._addProviderMetadata(
      {
        ...result,
        spans: adjustedSpans,
      },
      true,
      averageConfidence
    );
  }

  /**
   * Add Groq-specific metadata to result
   */
  private _addProviderMetadata(
    result: LabelSpansResult,
    logprobsApplied: boolean,
    averageConfidence?: number
  ): LabelSpansResult {
    const metadata = this._lastResponseMetadata;
    
    return {
      ...result,
      meta: {
        ...result.meta,
        _clientType: 'GroqLlmClient',
        _providerOptimizations: {
          provider: 'groq',
          logprobsAdjustment: logprobsApplied,
          averageLogprobsConfidence: averageConfidence,
          optimizations: metadata?.optimizations || [],
        },
      },
    };
  }
}
