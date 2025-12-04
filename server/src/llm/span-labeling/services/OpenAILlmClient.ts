/**
 * OpenAI-specific LLM Client
 * 
 * Extends RobustLlmClient with OpenAI/GPT-4o optimizations:
 * - Developer role for hard constraints
 * - Strict JSON schema mode (grammar-constrained)
 * - Bookending strategy for long prompts
 * - Temperature 0.0 for deterministic output
 * 
 * These optimizations are primarily handled by OpenAICompatibleAdapter,
 * but this client ensures proper configuration.
 */

import { RobustLlmClient } from './RobustLlmClient.js';
import type { LlmSpanParams, ILlmClient } from './ILlmClient.js';
import type { LabelSpansResult } from '../types.js';

/**
 * OpenAI/GPT-4o optimized LLM client
 * 
 * Key OpenAI-specific optimizations (mostly handled by adapter):
 * 1. Developer role: Highest priority instructions
 * 2. Strict JSON schema: Grammar-constrained decoding
 * 3. Bookending: Format instructions at start and end
 * 4. Temperature 0.0: Deterministic structured output
 * 
 * No post-processing needed - OpenAI's strict schema ensures correctness.
 */
export class OpenAILlmClient extends RobustLlmClient implements ILlmClient {
  
  /**
   * Get spans using OpenAI/GPT-4o
   * 
   * No additional processing needed - OpenAI adapter handles optimizations
   * and strict schema ensures schema compliance at generation time.
   */
  async getSpans(params: LlmSpanParams): Promise<LabelSpansResult> {
    // Call base implementation
    // OpenAI-specific optimizations are handled by:
    // 1. OpenAICompatibleAdapter (strict schema, developer role)
    // 2. modelConfig.js (temperature 0.0)
    // 3. ProviderDetector (capability detection)
    return super.getSpans(params);
  }

  /**
   * Override post-process to skip Groq-specific adjustments
   * 
   * OpenAI doesn't need confidence adjustment because:
   * 1. Strict schema mode guarantees format compliance
   * 2. Temperature 0.0 provides consistent outputs
   * 3. No logprobs-based adjustment needed
   */
  protected _postProcessResult(result: LabelSpansResult, isGroq: boolean): LabelSpansResult {
    // Skip Groq-specific processing - just return result as-is
    return result;
  }
}
