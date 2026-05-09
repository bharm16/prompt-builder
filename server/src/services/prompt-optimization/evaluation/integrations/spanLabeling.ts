import type { LLMSpan } from "@llm/span-labeling/types";
import type { PromptSpanProvider } from "@llm/span-labeling/ports/PromptSpanProvider";

/**
 * Label spans for an optimized prompt during evaluation.
 *
 * Routes through the shared `PromptSpanProvider` port (DI-injected) instead
 * of importing `labelSpans` directly so calls are coalesced and cached on
 * the same path as every other consumer.
 */
export async function labelOptimizedSpans(
  provider: PromptSpanProvider,
  optimized: string,
): Promise<LLMSpan[]> {
  return provider.label(optimized, {
    maxSpans: 80,
    minConfidence: 0.4,
  });
}
