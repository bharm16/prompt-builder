import { RobustLlmClient, type ProviderRequestOptions } from './RobustLlmClient';
import type { LabelSpansResult } from '../types';

/**
 * Gemini LLM Client for Span Labeling
 * 
 * Specialized client for Google's Gemini models.
 * Extends RobustLlmClient to reuse the "try, validate, repair" cycle.
 */
export class GeminiLlmClient extends RobustLlmClient {
  /**
   * HOOK: Get provider name for logging and prompt building
   */
  protected override _getProviderName(): string {
    return 'gemini';
  }

  /**
   * HOOK: Get provider-specific request options
   */
  protected override _getProviderRequestOptions(): ProviderRequestOptions {
    return {
      enableBookending: false, // Gemini follows instructions well without bookending
      useFewShot: false,      // Zero-shot works well with Flash 1.5/2.0
      useSeedFromConfig: false, // Gemini doesn't support seed in the same way as OpenAI
      enableLogprobs: false,   // Not typically used for Gemini JSON mode
    };
  }

  /**
   * HOOK: Post-process result with provider-specific adjustments
   */
  protected override _postProcessResult(result: LabelSpansResult): LabelSpansResult {
    // Gemini 1.5 Flash is very fast but can sometimes be verbose
    // No specific post-processing needed yet, but keeping hook available
    return result;
  }
}
