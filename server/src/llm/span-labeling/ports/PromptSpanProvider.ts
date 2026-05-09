import type { LLMSpan, LabelSpansParams } from "../types";

/**
 * Shared port for prompt span labeling consumers.
 *
 * Wraps `labelSpans` (and optionally a cache) behind a DI-friendly seam so
 * downstream services don't reach into the SpanLabelingService function
 * directly. Multiple consumers (model intelligence, optimization evaluation,
 * request batching) all flow through this port.
 */
export interface PromptSpanProvider {
  /**
   * Label spans for a given prompt.
   *
   * @param prompt The prompt text to label.
   * @param options Optional labeling parameters (maxSpans, minConfidence, etc.).
   *                The `text` field on LabelSpansParams is overridden by `prompt`.
   */
  label(
    prompt: string,
    options?: Omit<LabelSpansParams, "text">,
  ): Promise<LLMSpan[]>;
}
