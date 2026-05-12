import { describe, it, expect } from "vitest";
import type {
  QualityScoredProperties,
  OptimizeDimensions,
  SuggestionsDimensions,
  SpanLabelingDimensions,
} from "../judge-event-types.js";
import {
  OPTIMIZE_DIMENSION_KEYS,
  SUGGESTIONS_DIMENSION_KEYS,
  SPAN_LABELING_DIMENSION_KEYS,
} from "../judge-event-types.js";

describe("quality.scored event schema", () => {
  it("locks the dimension keys per surface", () => {
    expect({
      optimize: OPTIMIZE_DIMENSION_KEYS,
      suggestions: SUGGESTIONS_DIMENSION_KEYS,
      spanLabeling: SPAN_LABELING_DIMENSION_KEYS,
    }).toMatchSnapshot();
  });

  it("matches the optimize quality.scored shape", () => {
    const dimensions: OptimizeDimensions = {
      fidelity: 4,
      detailEnrichment: 5,
      coherence: 4,
      constraintCompliance: 5,
      brevityDiscipline: 3,
    };
    const event: QualityScoredProperties = {
      scoredEvent: "optimize.completed",
      scoredEventId: "00000000-0000-0000-0000-000000000001",
      surface: "optimize",
      rubricVersion: "abc12345",
      judgeModel: "gpt-4o-2024-08-06",
      judgeDurationMs: 850,
      judgeCostUsd: 0.0073,
      totalScore: 21,
      dimensions,
      reasoning: "Strong fidelity; slight constraint margin.",
      source: "synthetic",
    };
    expect(event).toMatchSnapshot();
  });

  it("matches the suggestions quality.scored shape", () => {
    const dimensions: SuggestionsDimensions = {
      relevance: 4,
      diversity: 3,
      categoryFidelity: 5,
      plausibility: 4,
      qualityRange: 3,
    };
    const event: QualityScoredProperties = {
      scoredEvent: "suggestions.completed",
      scoredEventId: "00000000-0000-0000-0000-000000000002",
      surface: "suggestions",
      rubricVersion: "def67890",
      judgeModel: "gpt-4o-2024-08-06",
      judgeDurationMs: 720,
      judgeCostUsd: 0.0041,
      totalScore: 19,
      dimensions,
      reasoning: "Reasonable spread; one alternative weakly relevant.",
      source: "synthetic",
    };
    expect(event).toMatchSnapshot();
  });

  it("matches the span-labeling quality.scored shape", () => {
    const dimensions: SpanLabelingDimensions = {
      coverage: 5,
      precision: 4,
      categoryAccuracy: 5,
      granularity: 4,
      boundaryCleanness: 4,
    };
    const event: QualityScoredProperties = {
      scoredEvent: "label-spans.completed",
      scoredEventId: "00000000-0000-0000-0000-000000000003",
      surface: "span-labeling",
      rubricVersion: "fedcba98",
      judgeModel: "gpt-4o-2024-08-06",
      judgeDurationMs: 940,
      judgeCostUsd: 0.0058,
      totalScore: 22,
      dimensions,
      reasoning: "All major spans labeled; one boundary off by one word.",
      source: "user",
    };
    expect(event).toMatchSnapshot();
  });
});
