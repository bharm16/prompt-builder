/**
 * Emits one `suggestions.completed` event per prompt by invoking the live
 * EnhancementV2Engine. Underlying `llm.call.completed` events are emitted
 * by the AIModelService telemetry hook — no fake records here.
 */

import { EnhancementV2Engine } from "../../../server/src/services/enhancement/v2/EnhancementV2Engine.js";
import type {
  EnhancementV2RequestContext,
  EnhancementV2Execution,
} from "../../../server/src/services/enhancement/v2/types.js";
import { VideoPromptService } from "../../../server/src/services/video-prompt-analysis/index.js";
import { AIServiceVideoPromptLlmGateway } from "../../../server/src/services/video-prompt-analysis/services/llm/VideoPromptLlmGateway.js";
import { SuggestionDiversityEnforcer } from "../../../server/src/services/enhancement/services/SuggestionDeduplicator.js";
import type { AIModelService } from "../../../server/src/services/ai-model/index.js";
import type { SuggestionsTelemetryService } from "../../../server/src/services/observability/SuggestionsTelemetryService.js";
import {
  runInSyntheticContext,
  syntheticDistinctId,
  type DriverSummary,
  type HarnessPrompt,
} from "../utils/request-helper.js";

interface DriverDeps {
  suggestions: SuggestionsTelemetryService;
  aiService: AIModelService;
}

const POLICY_VERSION = "2026-03-v2a";

/**
 * Map harness fixture tags to canonical taxonomy IDs that match registered
 * SlotPolicies. Without this mapping, tags like "lighting"/"setting"/"camera.shot"
 * miss exact registry matches and fall back to the subject policy — which then
 * rejects all candidates as family_miss because they aren't subject identities.
 */
const TAG_TO_POLICY_ID: Record<string, string> = {
  subject: "subject",
  "subject.identity": "subject.identity",
  "subject.appearance": "subject.appearance",
  action: "action",
  "action.movement": "action.movement",
  lighting: "lighting.source",
  "lighting.source": "lighting.source",
  "lighting.quality": "lighting.quality",
  "lighting.timeOfDay": "lighting.timeOfDay",
  setting: "environment.location",
  environment: "environment.location",
  "environment.location": "environment.location",
  "camera.movement": "camera.movement",
  "camera.shot": "shot.type",
  "camera.angle": "camera.angle",
  "camera.speed": "camera.focus",
  "camera.lens": "camera.lens",
  "camera.focus": "camera.focus",
  style: "style",
  "style.aesthetic": "style.aesthetic",
  "style.colorGrade": "style.colorGrade",
  "style.filmStock": "style.filmStock",
};

function mapTagToPolicy(tag: string): string {
  return TAG_TO_POLICY_ID[tag] ?? "subject";
}

function buildContext(
  prompt: HarnessPrompt,
  highlightedCategory: string,
): EnhancementV2RequestContext {
  const words = prompt.text.split(/\s+/).filter((w) => w.length > 0);
  const highlightedText = words.slice(0, 2).join(" ");
  const idx = prompt.text.indexOf(highlightedText);
  const contextBefore = idx > 0 ? prompt.text.slice(0, idx) : "";
  const contextAfter =
    idx >= 0 ? prompt.text.slice(idx + highlightedText.length) : "";

  return {
    highlightedText,
    contextBefore,
    contextAfter,
    fullPrompt: prompt.text,
    originalUserPrompt: prompt.text,
    brainstormContext: null,
    highlightedCategory,
    highlightedCategoryConfidence: 1,
    isPlaceholder: false,
    isVideoPrompt: true,
    phraseRole: highlightedCategory,
    highlightWordCount: highlightedText.split(/\s+/).length,
    videoConstraints: null,
    modelTarget: null,
    promptSection: null,
    spanAnchors: "",
    nearbySpanHints: "",
    lockedSpanCategories: [],
    debug: false,
  };
}

export async function driveSuggestions(
  deps: DriverDeps,
  prompts: HarnessPrompt[],
): Promise<DriverSummary> {
  const distinctId = syntheticDistinctId();
  let surfaceEvents = 0;

  const videoPromptService = new VideoPromptService({
    videoPromptLlmGateway: new AIServiceVideoPromptLlmGateway(deps.aiService),
  });
  const diversityEnforcer = new SuggestionDiversityEnforcer(deps.aiService);
  const v2Engine = new EnhancementV2Engine({
    aiService: deps.aiService,
    videoPromptService,
    diversityEnforcer,
    policyVersion: POLICY_VERSION,
  });

  for (let i = 0; i < prompts.length; i++) {
    const prompt = prompts[i]!;
    const requestId = `synthetic-suggestions-${prompt.id}`;
    const highlightedCategory = mapTagToPolicy(prompt.tags[0] ?? "subject");

    await runInSyntheticContext(requestId, async () => {
      const trace = deps.suggestions.startSuggestionsTrace(
        requestId,
        distinctId,
      );
      const context = buildContext(prompt, highlightedCategory);

      try {
        const execution: EnhancementV2Execution =
          await v2Engine.execute(context);
        const suggestionTexts = execution.finalSuggestions.map((s) => s.text);

        trace.complete({
          outcome: "success",
          promptLength: prompt.text.length,
          suggestionCount: suggestionTexts.length,
          highlightedCategory,
          isVideoPrompt: true,
          isPlaceholder: false,
          modelTarget: null,
          promptSection: null,
          phraseRole: highlightedCategory,
          policyVersion: POLICY_VERSION,
          categoryId: execution.debug.categoryId,
          engineMode: execution.debug.mode,
          modelCallCount: execution.debug.modelCallCount,
          fallbackApplied: false,
          debug: false,
          highlightedText: context.highlightedText,
          fullPrompt: prompt.text,
          suggestions: suggestionTexts,
        });
        surfaceEvents++;
        const dbg = execution.debug;
        console.log(
          `[suggestions] ${prompt.id} (cat=${dbg.categoryId} mode=${dbg.mode}) → ${suggestionTexts.length} suggestions | stages=${JSON.stringify(dbg.stageCounts)} rejects=${JSON.stringify(dbg.rejectionSummary)}`,
        );
      } catch (err) {
        trace.complete({
          outcome: "error",
          promptLength: prompt.text.length,
          suggestionCount: 0,
          highlightedCategory,
          isVideoPrompt: true,
          isPlaceholder: false,
          modelTarget: null,
          promptSection: null,
          phraseRole: highlightedCategory,
          policyVersion: POLICY_VERSION,
          categoryId: null,
          engineMode: null,
          modelCallCount: 0,
          fallbackApplied: false,
          debug: false,
          highlightedText: context.highlightedText,
          fullPrompt: prompt.text,
          suggestions: [],
        });
        console.warn(
          `[suggestions] ${prompt.id} errored: ${(err as Error).message}`,
        );
      }
    });
  }

  return {
    surface: "suggestions",
    promptCount: prompts.length,
    surfaceEventsEmitted: surfaceEvents,
    llmEventsEmitted: 0,
  };
}
