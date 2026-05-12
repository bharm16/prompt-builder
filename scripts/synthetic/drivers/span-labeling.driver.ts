/**
 * Emits one `label-spans.completed` event plus 1 underlying `llm.call.completed`
 * event per prompt. Provider/model mirrors server/src/config/modelConfig.ts:
 *   - span_labeling → gemini / gemini-2.5-flash (fallback: qwen/qwen3-32b)
 */

import { SpanLabelingTelemetryService } from "../../../server/src/services/observability/SpanLabelingTelemetryService.js";
import { LlmCallTelemetryService } from "../../../server/src/services/observability/LlmCallTelemetryService.js";
import {
  jitter,
  runInSyntheticContext,
  syntheticDistinctId,
  type DriverSummary,
  type HarnessPrompt,
} from "../utils/request-helper.js";

interface DriverDeps {
  spanLabels: SpanLabelingTelemetryService;
  llm: LlmCallTelemetryService;
}

export async function driveSpanLabels(
  deps: DriverDeps,
  prompts: HarnessPrompt[],
): Promise<DriverSummary> {
  const distinctId = syntheticDistinctId();
  let surfaceEvents = 0;
  let llmEvents = 0;

  for (let i = 0; i < prompts.length; i++) {
    const prompt = prompts[i]!;
    const requestId = `synthetic-spanlabels-${prompt.id}`;
    const llmMs = jitter(320, i);

    runInSyntheticContext(requestId, () => {
      const trace = deps.spanLabels.startSpanLabelingTrace(
        requestId,
        distinctId,
      );

      // ~30% cache-hit rate, deterministic per index.
      const cacheHit = i % 10 < 3;
      if (cacheHit) trace.recordCacheHit();

      if (!cacheHit) {
        deps.llm.record({
          executionType: "span_labeling",
          provider: "gemini",
          model: "gemini-2.5-flash",
          durationMs: llmMs,
          promptTokens: 80 + (i % 25),
          completionTokens: 60 + (i % 20),
          totalTokens: 140 + (i % 45),
          finishReason: "stop",
          outcome: "success",
          userId: distinctId,
        });
        llmEvents++;
      }

      trace.complete({
        outcome: "success",
        promptLength: prompt.text.length,
        spanCount: Math.max(prompt.tags.length, 3) + (i % 4),
        provider: cacheHit ? null : "gemini",
        model: cacheHit ? null : "gemini-2.5-flash",
      });
      surfaceEvents++;
    });

    console.log(
      `[span-labels] ${prompt.id} emitted (1 surface${cacheHitFor(i) ? "" : " + 1 llm"})`,
    );
  }

  return {
    surface: "span-labels",
    promptCount: prompts.length,
    surfaceEventsEmitted: surfaceEvents,
    llmEventsEmitted: llmEvents,
  };
}

function cacheHitFor(i: number): boolean {
  return i % 10 < 3;
}
