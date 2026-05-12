import type { QualityScoredSurface } from "./judge-event-types.js";

export interface RawPostHogEvent {
  properties: Record<string, unknown>;
}

const OPTIMIZE_INPUT_KEYS = [
  "inputPrompt",
  "targetModel",
  "mode",
  "hasContext",
  "hasShotPlan",
  "useConstitutionalAI",
] as const;

const SUGGESTIONS_INPUT_KEYS = [
  "highlightedText",
  "fullPrompt",
  "highlightedCategory",
] as const;

const SPAN_LABELING_INPUT_KEYS = ["inputText"] as const;

function projectKeys(
  props: Record<string, unknown>,
  keys: readonly string[],
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of keys) {
    if (k in props) out[k] = props[k];
  }
  return out;
}

export function extractInputContent(
  event: RawPostHogEvent,
  surface: QualityScoredSurface,
): Record<string, unknown> {
  switch (surface) {
    case "optimize":
      return projectKeys(event.properties, OPTIMIZE_INPUT_KEYS);
    case "suggestions":
      return projectKeys(event.properties, SUGGESTIONS_INPUT_KEYS);
    case "span-labeling":
      return projectKeys(event.properties, SPAN_LABELING_INPUT_KEYS);
  }
}

export function extractOutputContent(
  event: RawPostHogEvent,
  surface: QualityScoredSurface,
): Record<string, unknown> {
  switch (surface) {
    case "optimize":
      return { outputPrompt: event.properties.outputPrompt };
    case "suggestions":
      return { suggestions: event.properties.suggestions };
    case "span-labeling":
      return { spans: event.properties.spans };
  }
}

export function isJudgeable(
  event: RawPostHogEvent,
  surface: QualityScoredSurface,
): boolean {
  const props = event.properties;
  switch (surface) {
    case "optimize":
      return (
        typeof props.outputPrompt === "string" && props.outputPrompt.length > 0
      );
    case "suggestions":
      return Array.isArray(props.suggestions) && props.suggestions.length > 0;
    case "span-labeling":
      return Array.isArray(props.spans) && props.spans.length > 0;
  }
}
