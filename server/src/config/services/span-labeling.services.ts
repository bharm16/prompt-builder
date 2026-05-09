import type { DIContainer } from "@infrastructure/DIContainer";
import type { AIModelService } from "@services/ai-model/AIModelService";
import type { SpanLabelingCacheService } from "@services/cache/SpanLabelingCacheService";
import { CachedPromptSpanProvider } from "@llm/span-labeling/adapters/CachedPromptSpanProvider";

/**
 * Registers the shared `spanLabelingProvider` token used by every consumer
 * of `labelSpans` (model intelligence, optimization evaluation, request
 * batching). Wraps `labelSpans` plus the span-labeling cache so callers
 * automatically get single-flight coalescing and TTL caching.
 */
export function registerSpanLabelingServices(container: DIContainer): void {
  container.register(
    "spanLabelingProvider",
    (
      aiService: AIModelService,
      spanLabelingCacheService: SpanLabelingCacheService | null,
    ) => new CachedPromptSpanProvider(aiService, spanLabelingCacheService),
    ["aiService", "spanLabelingCacheService"],
  );
}
