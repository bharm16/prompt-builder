/**
 * Emits one `suggestions.completed` event plus 1 underlying `llm.call.completed`
 * event per prompt. Provider/model mirrors server/src/config/modelConfig.ts:
 *   - enhance_suggestions → qwen / qwen/qwen3-32b (fallback: openai)
 */

import { SuggestionsTelemetryService } from "../../../server/src/services/observability/SuggestionsTelemetryService.js";
import { LlmCallTelemetryService } from "../../../server/src/services/observability/LlmCallTelemetryService.js";
import {
  jitter,
  runInSyntheticContext,
  syntheticDistinctId,
  type DriverSummary,
  type HarnessPrompt,
} from "../utils/request-helper.js";

interface DriverDeps {
  suggestions: SuggestionsTelemetryService;
  llm: LlmCallTelemetryService;
}

export async function driveSuggestions(
  deps: DriverDeps,
  prompts: HarnessPrompt[],
): Promise<DriverSummary> {
  const distinctId = syntheticDistinctId();
  let surfaceEvents = 0;
  let llmEvents = 0;

  for (let i = 0; i < prompts.length; i++) {
    const prompt = prompts[i]!;
    const requestId = `synthetic-suggestions-${prompt.id}`;
    const category = prompt.tags[0] ?? "subject";

    runInSyntheticContext(requestId, () => {
      const trace = deps.suggestions.startSuggestionsTrace(
        requestId,
        distinctId,
      );

      trace.recordStage("video_context", jitter(8, i));
      trace.recordStage("span_context", jitter(12, i + 1));
      trace.recordStage("cache", jitter(3, i + 2));

      const v2Ms = jitter(1200, i + 3);
      trace.recordStage("v2_engine", v2Ms);
      trace.recordStage("post_processing", jitter(6, i + 4));

      deps.llm.record({
        executionType: "enhance_suggestions",
        provider: "qwen",
        model: "qwen/qwen3-32b",
        durationMs: v2Ms,
        promptTokens: 220 + (i % 40),
        completionTokens: 180 + (i % 30),
        totalTokens: 400 + (i % 70),
        finishReason: "stop",
        outcome: "success",
        userId: distinctId,
      });
      llmEvents++;

      const highlightedText = prompt.text.split(" ").slice(0, 2).join(" ");
      const suggestions = synthesizeSuggestions(category, i);
      trace.complete({
        outcome: "success",
        promptLength: prompt.text.length,
        suggestionCount: suggestions.length,
        highlightedCategory: category,
        isVideoPrompt: true,
        isPlaceholder: false,
        modelTarget: null,
        promptSection: null,
        phraseRole: null,
        policyVersion: "2026-03-v2a",
        categoryId: category,
        engineMode: "guided_llm",
        modelCallCount: 1,
        fallbackApplied: false,
        debug: false,
        highlightedText,
        fullPrompt: prompt.text,
        suggestions,
      });
      surfaceEvents++;
    });

    console.log(`[suggestions] ${prompt.id} emitted (1 surface + 1 llm)`);
  }

  return {
    surface: "suggestions",
    promptCount: prompts.length,
    surfaceEventsEmitted: surfaceEvents,
    llmEventsEmitted: llmEvents,
  };
}

/**
 * Synthesizes plausible alternative phrases for a given taxonomy category.
 * Deterministic per (category, index) so dashboards show stable content.
 */
function synthesizeSuggestions(category: string, index: number): string[] {
  const pool: Record<string, string[]> = {
    subject: ["young woman", "weathered fisherman", "lone traveler", "child"],
    "camera.movement": [
      "slow dolly forward",
      "aerial pullback",
      "smooth pan right",
      "handheld follow",
    ],
    "camera.shot": [
      "medium close-up",
      "wide establishing",
      "extreme close-up",
      "over-the-shoulder",
    ],
    "camera.speed": ["slow motion", "time-lapse", "real-time", "ramped motion"],
    lighting: [
      "golden hour",
      "soft tungsten",
      "moody neon",
      "harsh midday sun",
    ],
    setting: [
      "misty forest",
      "rain-slicked street",
      "desert mesa",
      "neon-lit alley",
    ],
    style: [
      "anamorphic film",
      "Wes Anderson pastel",
      "vintage 16mm",
      "high-contrast B&W",
    ],
    action: ["walks slowly", "leaps forward", "spins gracefully", "leans in"],
  };
  const options = pool[category] ?? pool.subject!;
  // Rotate the start position by index so different prompts surface different
  // suggestions while staying within the deterministic pool.
  const start = index % options.length;
  return [
    options[start]!,
    options[(start + 1) % options.length]!,
    options[(start + 2) % options.length]!,
    options[(start + 3) % options.length]!,
  ];
}
