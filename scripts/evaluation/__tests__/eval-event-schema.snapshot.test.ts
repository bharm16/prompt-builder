import { describe, it, expect } from "vitest";
import type {
  EvalCompletedProperties,
  SpanLabelingJudgeMetrics,
  SpanLabelingF1Metrics,
  RecommendationMetrics,
} from "../eval-event-types.js";

describe("eval.completed event schema", () => {
  it("matches the span_labeling_judge schema", () => {
    const event: EvalCompletedProperties = {
      evalType: "span_labeling_judge",
      outcome: "passed",
      commit: "abc1234",
      runId: "987654",
      provider: "openai",
      sourceFile: "data/evaluation-prompts-latest.json",
      durationMs: 123456,
      promptCount: 50,
      errorCount: 0,
      metrics: {
        avgScore: 21.3,
        maxScore: 25,
        scoreDistribution: {
          excellent: 24,
          good: 18,
          acceptable: 6,
          poor: 2,
          failing: 0,
        },
        avgCategoryScores: {
          coverage: 4.2,
          precision: 4.5,
          granularity: 4.1,
          taxonomy: 4.4,
          technicalSpecs: 4.0,
        },
        latencyStats: { avg: 250, p50: 230, p95: 410, p99: 520 },
        judgeModel: "gpt-4o",
      } satisfies SpanLabelingJudgeMetrics,
    };

    expect(event).toMatchSnapshot();
  });

  it("matches the span_labeling_f1 schema", () => {
    const event: EvalCompletedProperties = {
      evalType: "span_labeling_f1",
      outcome: "regression",
      errorMessage: "F1 for category 'lighting' dropped from 0.82 to 0.74",
      commit: "abc1234",
      runId: "987654",
      provider: "groq",
      durationMs: 78900,
      promptCount: 30,
      errorCount: 1,
      metrics: {
        overallF1: 0.81,
        overallPrecision: 0.85,
        overallRecall: 0.77,
        perCategoryF1: {
          shot: 0.88,
          subject: 0.92,
          lighting: 0.74,
          camera: 0.85,
        },
        baselineCommit: "def5678",
      } satisfies SpanLabelingF1Metrics,
    };

    expect(event).toMatchSnapshot();
  });

  it("matches the recommendation schema", () => {
    const event: EvalCompletedProperties = {
      evalType: "recommendation",
      outcome: "passed",
      commit: "abc1234",
      durationMs: 4500,
      promptCount: 30,
      errorCount: 0,
      metrics: {
        driftDetectedCount: 0,
        totalPrompts: 30,
        newPromptsCount: 0,
        baselineName: "default",
      } satisfies RecommendationMetrics,
    };

    expect(event).toMatchSnapshot();
  });
});
