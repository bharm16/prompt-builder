import { labelSpans } from "../SpanLabelingService";
import { getCurrentSpanProvider } from "../services/LlmClientFactory";
import type { AIExecutionPort } from "@services/ai-model/ports/AIExecutionPort";
import type { SpanLabelingCacheService } from "@services/cache/SpanLabelingCacheService";
import type { PromptSpanProvider } from "../ports/PromptSpanProvider";
import type { LLMSpan, LabelSpansParams } from "../types";

/**
 * Production adapter for the PromptSpanProvider port.
 *
 * Wraps `labelSpans` and consults `SpanLabelingCacheService.getOrCompute` so
 * the underlying LLM call is single-flight coalesced and cached. Falls back
 * to a direct `labelSpans` invocation when no cache is configured.
 */
export class CachedPromptSpanProvider implements PromptSpanProvider {
  constructor(
    private readonly aiService: AIExecutionPort,
    private readonly cache: SpanLabelingCacheService | null,
  ) {}

  async label(
    prompt: string,
    options: Omit<LabelSpansParams, "text"> = {},
  ): Promise<LLMSpan[]> {
    const params: LabelSpansParams = { text: prompt, ...options };

    if (!this.cache) {
      const result = await labelSpans(params, this.aiService);
      return Array.isArray(result.spans) ? result.spans : [];
    }

    const provider = getCurrentSpanProvider();
    const ttl = prompt.length > 2000 ? 300 : 3600;

    const { value } = await this.cache.getOrCompute(
      prompt,
      options.policy ?? null,
      options.templateVersion ?? null,
      () => labelSpans(params, this.aiService),
      { ttl, provider },
    );

    return Array.isArray(value.spans) ? value.spans : [];
  }
}
