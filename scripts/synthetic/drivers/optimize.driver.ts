/**
 * Emits one `optimize.completed` event plus the 4 underlying `llm.call.completed`
 * events that a real `/api/optimize` request produces. Provider/model values
 * mirror server/src/config/modelConfig.ts as of this commit:
 *   - optimize_shot_interpreter   → openai / gpt-4o-mini-2024-07-18
 *   - optimize_standard           → openai / gpt-4o-2024-08-06
 *   - optimize_quality_assessment → openai / gpt-4o-mini
 *   - optimize_intent_check       → openai / gpt-4o-mini-2024-07-18
 */

import { OptimizeTelemetryService } from "../../../server/src/services/observability/OptimizeTelemetryService.js";
import { LlmCallTelemetryService } from "../../../server/src/services/observability/LlmCallTelemetryService.js";
import {
  jitter,
  runInSyntheticContext,
  syntheticDistinctId,
  type DriverSummary,
  type HarnessPrompt,
} from "../utils/request-helper.js";

interface DriverDeps {
  optimize: OptimizeTelemetryService;
  llm: LlmCallTelemetryService;
}

interface LlmStage {
  executionType: string;
  model: string;
  stageName: "shot_interpreter" | "strategy" | "constitutional" | "intent_lock";
  baseMs: number;
}

const STAGES: LlmStage[] = [
  {
    executionType: "optimize_shot_interpreter",
    model: "gpt-4o-mini-2024-07-18",
    stageName: "shot_interpreter",
    baseMs: 280,
  },
  {
    executionType: "optimize_standard",
    model: "gpt-4o-2024-08-06",
    stageName: "strategy",
    baseMs: 2200,
  },
  {
    executionType: "optimize_quality_assessment",
    model: "gpt-4o-mini",
    stageName: "constitutional",
    baseMs: 350,
  },
  {
    executionType: "optimize_intent_check",
    model: "gpt-4o-mini-2024-07-18",
    stageName: "intent_lock",
    baseMs: 220,
  },
];

export async function driveOptimize(
  deps: DriverDeps,
  prompts: HarnessPrompt[],
): Promise<DriverSummary> {
  const distinctId = syntheticDistinctId();
  let surfaceEvents = 0;
  let llmEvents = 0;

  for (let i = 0; i < prompts.length; i++) {
    const prompt = prompts[i]!;
    const requestId = `synthetic-optimize-${prompt.id}`;

    runInSyntheticContext(requestId, () => {
      const trace = deps.optimize.startOptimizeTrace(requestId, distinctId);

      for (const stage of STAGES) {
        const durMs = jitter(stage.baseMs, i + stage.baseMs);
        trace.recordLlmCall();
        trace.recordStage(stage.stageName, durMs);
        deps.llm.record({
          executionType: stage.executionType,
          provider: "openai",
          model: stage.model,
          durationMs: durMs,
          promptTokens: 120 + (i % 30),
          completionTokens: 80 + (i % 20),
          totalTokens: 200 + (i % 50),
          finishReason: "stop",
          outcome: "success",
          userId: distinctId,
        });
        llmEvents++;
      }

      trace.complete({
        outcome: "success",
        targetModel: null,
        mode: "video",
        promptLength: prompt.text.length,
        outputLength: prompt.text.length + jitter(180, i),
        lockedSpanCount: 0,
        hasContext: false,
        hasBrainstormContext: false,
        hasShotPlan: false,
        useConstitutionalAI: true,
      });
      surfaceEvents++;
    });

    console.log(`[optimize] ${prompt.id} emitted (1 surface + 4 llm)`);
  }

  return {
    surface: "optimize",
    promptCount: prompts.length,
    surfaceEventsEmitted: surfaceEvents,
    llmEventsEmitted: llmEvents,
  };
}
