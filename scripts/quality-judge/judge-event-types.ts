import type { TelemetrySource } from "../../shared/types/telemetry.js";

export type QualityScoredSurface = "optimize" | "suggestions" | "span-labeling";

export type ScoredEventName =
  | "optimize.completed"
  | "suggestions.completed"
  | "label-spans.completed";

export const OPTIMIZE_DIMENSION_KEYS = [
  "fidelity",
  "detailEnrichment",
  "coherence",
  "constraintCompliance",
  "brevityDiscipline",
] as const;

export const SUGGESTIONS_DIMENSION_KEYS = [
  "relevance",
  "diversity",
  "categoryFidelity",
  "plausibility",
  "qualityRange",
] as const;

export const SPAN_LABELING_DIMENSION_KEYS = [
  "coverage",
  "precision",
  "categoryAccuracy",
  "granularity",
  "boundaryCleanness",
] as const;

export type OptimizeDimension = (typeof OPTIMIZE_DIMENSION_KEYS)[number];
export type SuggestionsDimension = (typeof SUGGESTIONS_DIMENSION_KEYS)[number];
export type SpanLabelingDimension =
  (typeof SPAN_LABELING_DIMENSION_KEYS)[number];

export type OptimizeDimensions = Record<OptimizeDimension, number>;
export type SuggestionsDimensions = Record<SuggestionsDimension, number>;
export type SpanLabelingDimensions = Record<SpanLabelingDimension, number>;

export type AnyDimensions =
  | OptimizeDimensions
  | SuggestionsDimensions
  | SpanLabelingDimensions;

export interface QualityScoredProperties {
  scoredEvent: ScoredEventName;
  scoredEventId: string;
  surface: QualityScoredSurface;
  rubricVersion: string;
  judgeModel: string;
  judgeDurationMs: number;
  judgeCostUsd: number;
  totalScore: number;
  dimensions: AnyDimensions;
  reasoning: string;
  source: TelemetrySource;
}

export function dimensionKeysFor(
  surface: QualityScoredSurface,
): readonly string[] {
  switch (surface) {
    case "optimize":
      return OPTIMIZE_DIMENSION_KEYS;
    case "suggestions":
      return SUGGESTIONS_DIMENSION_KEYS;
    case "span-labeling":
      return SPAN_LABELING_DIMENSION_KEYS;
  }
}

export function scoredEventNameFor(
  surface: QualityScoredSurface,
): ScoredEventName {
  switch (surface) {
    case "optimize":
      return "optimize.completed";
    case "suggestions":
      return "suggestions.completed";
    case "span-labeling":
      return "label-spans.completed";
  }
}

export function sumDimensions(dimensions: AnyDimensions): number {
  return Object.values(dimensions).reduce((acc, v) => acc + v, 0);
}
