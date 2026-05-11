export type EvalType =
  | "span_labeling_judge"
  | "span_labeling_f1"
  | "recommendation";

export type Outcome = "passed" | "regression" | "setup_error";

export type Provider = "groq" | "openai";

export interface SpanLabelingJudgeMetrics {
  avgScore: number;
  maxScore: 25;
  scoreDistribution: {
    excellent: number;
    good: number;
    acceptable: number;
    poor: number;
    failing: number;
  };
  avgCategoryScores?: {
    coverage: number;
    precision: number;
    granularity: number;
    taxonomy: number;
    technicalSpecs: number;
  };
  latencyStats?: { avg: number; p50: number; p95: number; p99: number };
  judgeModel: string;
}

export interface SpanLabelingF1Metrics {
  overallF1: number;
  overallPrecision: number;
  overallRecall: number;
  perCategoryF1: Record<string, number>;
  baselineCommit?: string;
}

export interface RecommendationMetrics {
  driftDetectedCount: number;
  totalPrompts: number;
  newPromptsCount: number;
  baselineName: string;
}

export type EvalMetrics =
  | SpanLabelingJudgeMetrics
  | SpanLabelingF1Metrics
  | RecommendationMetrics;

export interface EvalCompletedProperties {
  evalType: EvalType;
  outcome: Outcome;
  errorMessage?: string;
  commit: string;
  runId?: string;
  provider?: Provider | null;
  sourceFile?: string;
  durationMs: number;
  promptCount: number;
  errorCount: number;
  metrics: EvalMetrics;
}
