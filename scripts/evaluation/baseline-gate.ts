/**
 * Baseline regression gate for span labeling evaluation.
 *
 * Pure module: takes a current evaluation report and a previously-blessed
 * baseline, returns a pass/fail verdict with itemized regressions. No I/O,
 * no LLM calls — fully unit-testable.
 *
 * Wire this into any eval pipeline (LLM-as-judge or RelaxedF1 against the
 * golden set) by passing the report's `summary` and `byCategory` fields.
 */

export interface CategoryMetrics {
  f1: number;
  precision: number;
  recall: number;
  support: number;
}

export interface EvaluationReport {
  summary: {
    relaxedF1: number;
    precision: number;
    recall: number;
    taxonomyAccuracy: number;
  };
  byCategory: Record<string, CategoryMetrics>;
}

export interface Baseline {
  /** ISO timestamp the baseline was blessed. */
  blessedAt: string;
  /** Provider this baseline applies to (e.g., "groq", "openai"). */
  provider: string;
  /** Optional commit SHA for traceability. */
  commit?: string;
  summary: EvaluationReport["summary"];
  byCategory: Record<string, CategoryMetrics>;
}

export interface GateOptions {
  /**
   * Maximum allowed F1 drop (absolute, in [0,1]) for the overall metric
   * before flagging a regression. Default: 0.02 (2 percentage points).
   */
  overallF1Tolerance?: number;
  /**
   * Maximum allowed F1 drop (absolute) for any single category.
   * Categories with low support amplify noise, so we use a stricter
   * gate on overall + a looser gate per category. Default: 0.05.
   */
  perCategoryF1Tolerance?: number;
  /**
   * Categories with support < this threshold are skipped to avoid noise
   * from rare labels. Default: 5.
   */
  minSupportForGate?: number;
  /**
   * Maximum allowed drop in taxonomy accuracy. Default: 0.03.
   */
  taxonomyAccuracyTolerance?: number;
}

export interface Regression {
  kind: "overall_f1" | "category_f1" | "taxonomy_accuracy";
  /** Category id, or "overall" for non-category regressions. */
  scope: string;
  baseline: number;
  current: number;
  delta: number;
  /** Configured tolerance the delta exceeded. */
  tolerance: number;
  /** Sample size the comparison is based on (categories only). */
  support?: number;
}

export interface GateResult {
  passed: boolean;
  regressions: Regression[];
  /** Categories present in baseline but missing from current report. */
  missingCategories: string[];
  /** Categories present in current report but new since baseline. */
  newCategories: string[];
}

const DEFAULTS: Required<GateOptions> = {
  overallF1Tolerance: 0.02,
  perCategoryF1Tolerance: 0.05,
  minSupportForGate: 5,
  taxonomyAccuracyTolerance: 0.03,
};

/**
 * Compare a current evaluation report against a baseline. Returns pass/fail
 * with itemized regressions for each metric that breached its tolerance.
 *
 * Design notes:
 * - Asymmetric tolerance: drops are regressions, gains are not. We never
 *   "regress" because the model got better.
 * - Per-category gate uses absolute F1 delta, not relative. A drop from 0.95
 *   to 0.90 is a regression even though it's only ~5% relative.
 * - Low-support categories are skipped — a single misclassification on a
 *   3-span category swings F1 by 33%, which is statistical noise.
 */
export function compareToBaseline(
  current: EvaluationReport,
  baseline: Baseline,
  options: GateOptions = {},
): GateResult {
  const opts: Required<GateOptions> = { ...DEFAULTS, ...options };
  const regressions: Regression[] = [];

  // Overall F1 gate
  {
    const baselineF1 = baseline.summary.relaxedF1;
    const currentF1 = current.summary.relaxedF1;
    const delta = baselineF1 - currentF1;
    if (delta > opts.overallF1Tolerance) {
      regressions.push({
        kind: "overall_f1",
        scope: "overall",
        baseline: baselineF1,
        current: currentF1,
        delta,
        tolerance: opts.overallF1Tolerance,
      });
    }
  }

  // Taxonomy accuracy gate
  {
    const baselineAcc = baseline.summary.taxonomyAccuracy;
    const currentAcc = current.summary.taxonomyAccuracy;
    const delta = baselineAcc - currentAcc;
    if (delta > opts.taxonomyAccuracyTolerance) {
      regressions.push({
        kind: "taxonomy_accuracy",
        scope: "overall",
        baseline: baselineAcc,
        current: currentAcc,
        delta,
        tolerance: opts.taxonomyAccuracyTolerance,
      });
    }
  }

  // Per-category gates
  const baselineCategories = Object.keys(baseline.byCategory);
  const currentCategories = Object.keys(current.byCategory);
  const missingCategories: string[] = [];
  const newCategories = currentCategories.filter(
    (c) => !(c in baseline.byCategory),
  );

  for (const category of baselineCategories) {
    const baselineMetrics = baseline.byCategory[category];
    const currentMetrics = current.byCategory[category];

    if (!currentMetrics) {
      missingCategories.push(category);
      continue;
    }

    if (!baselineMetrics) continue; // type narrowing

    // Skip low-support categories — too noisy for a hard gate.
    if (baselineMetrics.support < opts.minSupportForGate) continue;

    const delta = baselineMetrics.f1 - currentMetrics.f1;
    if (delta > opts.perCategoryF1Tolerance) {
      regressions.push({
        kind: "category_f1",
        scope: category,
        baseline: baselineMetrics.f1,
        current: currentMetrics.f1,
        delta,
        tolerance: opts.perCategoryF1Tolerance,
        support: baselineMetrics.support,
      });
    }
  }

  return {
    passed: regressions.length === 0,
    regressions,
    missingCategories,
    newCategories,
  };
}

/**
 * Format a gate result as a human-readable report. Designed for CI logs
 * where a developer needs to immediately understand what regressed.
 */
export function formatGateResult(result: GateResult): string {
  const lines: string[] = [];

  if (result.passed) {
    lines.push("✅ Span labeling regression gate: PASSED");
  } else {
    lines.push("❌ Span labeling regression gate: FAILED");
    lines.push("");
    lines.push(`Regressions (${result.regressions.length}):`);
    for (const r of result.regressions) {
      const baselineStr = r.baseline.toFixed(3);
      const currentStr = r.current.toFixed(3);
      const deltaStr = `-${r.delta.toFixed(3)}`;
      const supportStr =
        r.support !== undefined ? ` (support=${r.support})` : "";
      lines.push(
        `  • ${r.kind} [${r.scope}]${supportStr}: ${baselineStr} → ${currentStr} (${deltaStr}, tolerance=${r.tolerance})`,
      );
    }
  }

  if (result.missingCategories.length > 0) {
    lines.push("");
    lines.push(
      `⚠ Categories in baseline but missing from current report: ${result.missingCategories.join(", ")}`,
    );
  }

  if (result.newCategories.length > 0) {
    lines.push("");
    lines.push(
      `ℹ New categories not in baseline (re-bless required): ${result.newCategories.join(", ")}`,
    );
  }

  return lines.join("\n");
}

/**
 * Build a Baseline from a freshly-computed evaluation report. Used when
 * blessing new numbers (e.g., after an intentional model upgrade).
 */
export function buildBaseline(
  report: EvaluationReport,
  meta: { provider: string; commit?: string },
): Baseline {
  return {
    blessedAt: new Date().toISOString(),
    provider: meta.provider,
    ...(meta.commit !== undefined && { commit: meta.commit }),
    summary: report.summary,
    byCategory: report.byCategory,
  };
}
