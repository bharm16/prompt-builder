/**
 * Emits one `label-spans.completed` event per prompt by invoking the live
 * SpanLabelingService. Underlying `llm.call.completed` events are emitted
 * automatically by the AIModelService when wired with llmCallTelemetry —
 * we no longer fake those records here.
 */

import { labelSpans } from "../../../server/src/llm/span-labeling/SpanLabelingService.js";
import type { AIModelService } from "../../../server/src/services/ai-model/index.js";
import type {
  SpanLabelingTelemetryService,
  SpanLabelSpan,
} from "../../../server/src/services/observability/SpanLabelingTelemetryService.js";
import {
  runInSyntheticContext,
  syntheticDistinctId,
  type DriverSummary,
  type HarnessPrompt,
} from "../utils/request-helper.js";

interface DriverDeps {
  spanLabels: SpanLabelingTelemetryService;
  aiService: AIModelService;
}

const TEMPLATE_VERSION = "v3.0";
const PROVIDER = "gemini";
// Matches the SPAN_MODEL default in server/src/config/modelConfig.ts so synthetic
// label-spans.completed events carry the same model dimension prod emits.
const MODEL = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";

export async function driveSpanLabels(
  deps: DriverDeps,
  prompts: HarnessPrompt[],
): Promise<DriverSummary> {
  const distinctId = syntheticDistinctId();
  let surfaceEvents = 0;

  for (let i = 0; i < prompts.length; i++) {
    const prompt = prompts[i]!;
    const requestId = `synthetic-spanlabels-${prompt.id}`;

    await runInSyntheticContext(requestId, async () => {
      const trace = deps.spanLabels.startSpanLabelingTrace(
        requestId,
        distinctId,
      );

      try {
        const result = await labelSpans(
          {
            text: prompt.text,
            maxSpans: 50,
            minConfidence: 0.5,
            templateVersion: TEMPLATE_VERSION,
          },
          deps.aiService,
        );

        const spans: SpanLabelSpan[] = result.spans.map((s) => ({
          text: s.text,
          category: s.role ?? s.category ?? "subject",
        }));

        trace.complete({
          outcome: "success",
          promptLength: prompt.text.length,
          spanCount: spans.length,
          provider: PROVIDER,
          model: MODEL,
          inputText: prompt.text,
          spans,
        });
        surfaceEvents++;
        console.log(
          `[span-labels] ${prompt.id} emitted (${spans.length} spans)`,
        );
      } catch (err) {
        trace.complete({
          outcome: "error",
          promptLength: prompt.text.length,
          spanCount: 0,
          provider: PROVIDER,
          model: MODEL,
          inputText: prompt.text,
          spans: [],
        });
        console.warn(
          `[span-labels] ${prompt.id} errored: ${(err as Error).message}`,
        );
      }
    });
  }

  return {
    surface: "span-labels",
    promptCount: prompts.length,
    surfaceEventsEmitted: surfaceEvents,
    llmEventsEmitted: 0,
  };
}
