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

/**
 * One per-prompt example surfaced from an eval run. Lets PostHog dashboards
 * show WHAT each prompt produced, not just aggregate scores — the user can
 * scroll through individual cases and judge quality directly.
 *
 * Shape is shared across evalTypes; each type populates what it has:
 *   - span_labeling_f1   → predicted + groundTruth (for comparison)
 *   - span_labeling_judge → spans + judgeTotalScore + judgeNotes
 *   - recommendation     → drifted flag (and any drift details)
 */
export interface EvalExample {
  promptId: string;
  /** Input prompt text (judge eval); absent for f1 which uses promptId only. */
  input?: string;
  /** Model output spans (judge); for f1, see `predicted`. */
  spans?: Array<{ text: string; role: string }>;
  /** F1: spans the model returned. */
  predicted?: Array<{ text: string; role: string }>;
  /** F1: ground-truth spans the model was scored against. */
  groundTruth?: Array<{ text: string; role: string }>;
  /** Judge: total score 0–25. */
  judgeTotalScore?: number;
  /** Judge: human-readable summary of why this prompt scored this way. */
  judgeNotes?: string;
  /** Recommendation: did this prompt's recommendation drift from baseline. */
  drifted?: boolean;
  /** Per-prompt error message; absent on success. */
  error?: string;
}

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
  /**
   * Per-prompt examples for quality review on the Eval Health dashboard.
   * Optional — older runs / partial runs may omit. PostHog has a 1MB limit
   * per property; a 67-prompt golden set ≈ 70KB, well under.
   */
  examples?: EvalExample[];
}
