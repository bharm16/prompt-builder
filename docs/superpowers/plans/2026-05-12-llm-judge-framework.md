# LLM Judge Framework Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a pull-based LLM judge that scores live `optimize.completed`, `suggestions.completed`, and `label-spans.completed` events on per-surface rubrics, emits `quality.scored` events back to PostHog, and is calibration-gated against hand-scored sets (ρ ≥ 0.7).

**Architecture:** A nightly tsx script (`scripts/quality-judge/run-judge.ts`) polls PostHog for recent un-scored events, extracts each event's content fields, runs GPT-4o-2024-08-06 against the surface's markdown rubric, and emits `quality.scored` via a generalized version of the existing `scripts/evaluation/posthog-emitter.ts`. Rubrics live as plain markdown (snapshot-tested). Calibration is enforced in CI: any rubric change must hold ρ ≥ 0.7 against a frozen set of 30 hand-scored entries per surface or the merge is blocked.

**Tech Stack:** Node 20+ ESM, tsx, TypeScript, `openai@^6.15.0` (already installed), `posthog-node@^5.33.4` (already installed, used for emit only), PostHog Query HTTP API (HogQL, used for read), Vitest snapshots, GitHub Actions cron.

**Spec:** [`docs/superpowers/specs/2026-05-12-llm-judge-framework-design.md`](../specs/2026-05-12-llm-judge-framework-design.md)

---

## Worktree note

If this plan is being executed in a git worktree (Conductor.build or similar), **do not run npm start / dev / server / test:e2e** — those touch shared ports. Use `npx tsc --noEmit`, `npm run lint`, and `npm run test:unit` for verification. The judge runner itself never boots the server, so `NODE_ENV=test` is unnecessary for its own smoke test.

---

## File inventory — what each file owns

| File                                                                  | Status   | Responsibility                                                                                   |
| --------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------ |
| `scripts/quality-judge/judge-event-types.ts`                          | NEW      | `QualityScoredProperties`, `QualityScoredSurface`, per-surface dimension key arrays              |
| `scripts/quality-judge/pricing.ts`                                    | NEW      | Per-model `$/1K tokens` table + `computeCostUsd(model, tokensIn, tokensOut)` helper              |
| `scripts/quality-judge/rubric-loader.ts`                              | NEW      | `loadRubric(surface)`, `rubricVersionFor(surface)` — reads MD file, derives 8-char sha256 hash   |
| `scripts/quality-judge/judge-client.ts`                               | NEW      | Wraps OpenAI client; `runJudge({rubric, surface, inputContent, outputContent})` returns scores   |
| `scripts/quality-judge/posthog-query-client.ts`                       | NEW      | Thin HogQL wrapper. `fetchEventsToScore()`, `fetchAlreadyScoredIds()` via PostHog HTTP query API |
| `scripts/quality-judge/content-extractors.ts`                         | NEW      | Pure: maps `*.completed` properties → `{inputContent, outputContent}` per surface; skip-if-empty |
| `scripts/quality-judge/correlation.ts`                                | NEW      | Pure: `spearmanCorrelation(a,b)`, `meanAbsoluteError(a,b)`                                       |
| `scripts/quality-judge/run-judge.ts`                                  | NEW      | Entry point. Orchestrates: load rubric → fetch events → extract content → judge → emit           |
| `scripts/quality-judge/calibration/run-calibration.ts`                | NEW      | Loads calibration JSON, runs judge, computes ρ + MAE, exits non-zero if ρ < 0.7                  |
| `scripts/quality-judge/rubrics/optimize.md`                           | NEW      | Optimize rubric — 5 dimensions, 0–5 each. Fed verbatim to the judge LLM.                         |
| `scripts/quality-judge/rubrics/suggestions.md`                        | NEW      | Suggestions rubric.                                                                              |
| `scripts/quality-judge/rubrics/span-labeling.md`                      | NEW      | Span Labeling rubric.                                                                            |
| `scripts/quality-judge/calibration/optimize.calibration.json`         | NEW      | 30 hand-scored entries (input + output + human dimensions + total + notes + author)              |
| `scripts/quality-judge/calibration/suggestions.calibration.json`      | NEW      | 30 entries.                                                                                      |
| `scripts/quality-judge/calibration/span-labeling.calibration.json`    | NEW      | 30 entries.                                                                                      |
| `scripts/quality-judge/__tests__/judge-event-schema.snapshot.test.ts` | NEW      | Snapshot the `quality.scored` shape per surface. Diff visible in PRs.                            |
| `scripts/quality-judge/__tests__/pricing.test.ts`                     | NEW      | Pricing table → known $ for known token counts.                                                  |
| `scripts/quality-judge/__tests__/rubric-prompt.snapshot.test.ts`      | NEW      | Snapshot of each rubric markdown body (locks the prompt).                                        |
| `scripts/quality-judge/__tests__/content-extractors.test.ts`          | NEW      | Per-surface extraction; skip-if-empty cases.                                                     |
| `scripts/quality-judge/__tests__/correlation.test.ts`                 | NEW      | Property tests for Spearman + MAE on known fixtures.                                             |
| `scripts/quality-judge/__tests__/rubric-loader.test.ts`               | NEW      | `rubricVersionFor()` is whitespace-stable; same content → same hash.                             |
| `scripts/quality-judge/__tests__/run-judge.smoke.test.ts`             | NEW      | Mocked OpenAI + mocked PostHog query/emit; asserts orchestration shape + idempotency skipping.   |
| `scripts/evaluation/posthog-emitter.ts`                               | MODIFIED | Generalize: `emit({distinctId, event, properties})` instead of hardcoded `"eval.completed"`.     |
| `scripts/evaluation/__tests__/posthog-emitter.test.ts`                | MODIFIED | Update calls to pass `event: "eval.completed"` explicitly.                                       |
| `scripts/evaluation/golden-set-relaxed-f1.ts`                         | MODIFIED | Pass `event: "eval.completed"` through new arg.                                                  |
| `scripts/evaluation/span-labeling-evaluation.ts`                      | MODIFIED | Pass `event: "eval.completed"` (two call sites).                                                 |
| `scripts/evaluation/recommendation-eval.ts`                           | MODIFIED | Pass `event: "eval.completed"` through new arg.                                                  |
| `.github/workflows/quality-judge.yml`                                 | NEW      | Nightly cron + workflow_dispatch.                                                                |
| `.github/workflows/quality-judge-calibration.yml`                     | NEW      | Triggered on PRs touching `scripts/quality-judge/rubrics/**` or `**/calibration/**`. CI gate.    |
| `package.json`                                                        | MODIFIED | Add `judge:run`, `judge:calibrate` npm scripts.                                                  |
| `docs/architecture/observability.md`                                  | MODIFIED | Document `quality.scored`: schema, source fields per surface, dashboard tile IDs.                |

---

## Task ordering rationale

A few things drive the order:

1. **Pure modules before I/O.** `pricing`, `correlation`, `content-extractors`, `judge-event-types`, `rubric-loader` are all pure — they unblock testing the I/O layers later via mocks.
2. **Emitter generalization is its own commit, early.** Modifying the shared emitter touches four eval scripts that are not part of this feature. Isolating that change makes it bisectable and reviewable.
3. **Optimize end-to-end before Suggestions/Span Labeling.** Get one surface fully working (rubric + calibration + run-judge + smoke test passing) before duplicating the pattern. Catches design flaws early.
4. **Workflows after the code runs locally.** Authoring `quality-judge.yml` before the runner exists is dead code.
5. **Dashboards/alerts last.** Those are PostHog MCP work that requires real `quality.scored` events to exist.

---

## Task 1: `pricing.ts` + tests

**Files:**

- Create: `scripts/quality-judge/pricing.ts`
- Create: `scripts/quality-judge/__tests__/pricing.test.ts`

- [ ] **Step 1.1: Write the failing test**

Create `scripts/quality-judge/__tests__/pricing.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { computeCostUsd, PRICING } from "../pricing.js";

describe("pricing", () => {
  it("computes cost for gpt-4o-2024-08-06 at known token counts", () => {
    // $2.50 / 1M input tokens, $10.00 / 1M output tokens (OpenAI list price 2024-08-06)
    // 1000 in + 500 out → $0.0025 + $0.005 = $0.0075
    expect(computeCostUsd("gpt-4o-2024-08-06", 1000, 500)).toBeCloseTo(
      0.0075,
      6,
    );
  });

  it("returns 0 for an unknown model rather than throwing", () => {
    expect(computeCostUsd("unknown-model-xyz", 1000, 500)).toBe(0);
  });

  it("exposes the pricing table for snapshot review", () => {
    expect(PRICING).toMatchSnapshot();
  });
});
```

- [ ] **Step 1.2: Run the test — verify it fails**

```bash
npx vitest run scripts/quality-judge/__tests__/pricing.test.ts
```

Expected: FAIL — `Cannot find module '../pricing.js'`.

- [ ] **Step 1.3: Implement `pricing.ts`**

Create `scripts/quality-judge/pricing.ts`:

```typescript
/**
 * Per-model $/1K-token pricing for the LLM judge framework.
 *
 * Prices are OpenAI list prices as of 2026-05-12. When OpenAI changes pricing,
 * update this table; cost-tracking dashboards re-aggregate on the next judge run.
 */

export interface ModelPricing {
  /** USD per 1,000 input tokens. */
  inputPer1k: number;
  /** USD per 1,000 output tokens. */
  outputPer1k: number;
}

export const PRICING: Record<string, ModelPricing> = {
  // $2.50 / 1M input, $10.00 / 1M output
  "gpt-4o-2024-08-06": { inputPer1k: 0.0025, outputPer1k: 0.01 },
  // Kept for parity with span-labeling-evaluation.ts's --fast mode.
  "gpt-4o-mini": { inputPer1k: 0.00015, outputPer1k: 0.0006 },
};

export function computeCostUsd(
  model: string,
  tokensIn: number,
  tokensOut: number,
): number {
  const entry = PRICING[model];
  if (!entry) return 0;
  return (
    (tokensIn / 1000) * entry.inputPer1k +
    (tokensOut / 1000) * entry.outputPer1k
  );
}
```

- [ ] **Step 1.4: Run the test — verify it passes**

```bash
npx vitest run scripts/quality-judge/__tests__/pricing.test.ts -u
```

The `-u` writes the initial pricing-table snapshot. Expected: PASS, with one new snapshot file written under `__tests__/__snapshots__/`.

- [ ] **Step 1.5: Commit**

```bash
git add scripts/quality-judge/pricing.ts scripts/quality-judge/__tests__/pricing.test.ts scripts/quality-judge/__tests__/__snapshots__/pricing.test.ts.snap
git commit -m "feat(quality-judge): pricing table + cost helper"
```

---

## Task 2: `judge-event-types.ts` + schema snapshot test

**Files:**

- Create: `scripts/quality-judge/judge-event-types.ts`
- Create: `scripts/quality-judge/__tests__/judge-event-schema.snapshot.test.ts`

- [ ] **Step 2.1: Write the failing schema snapshot test**

Create `scripts/quality-judge/__tests__/judge-event-schema.snapshot.test.ts`:

```typescript
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
      source: "dogfood",
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
```

- [ ] **Step 2.2: Run the test — verify it fails**

```bash
npx vitest run scripts/quality-judge/__tests__/judge-event-schema.snapshot.test.ts
```

Expected: FAIL — `Cannot find module '../judge-event-types.js'`.

- [ ] **Step 2.3: Implement `judge-event-types.ts`**

Create `scripts/quality-judge/judge-event-types.ts`:

```typescript
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
```

- [ ] **Step 2.4: Run the test — write snapshot**

```bash
npx vitest run scripts/quality-judge/__tests__/judge-event-schema.snapshot.test.ts -u
```

Expected: PASS. Verify the generated snapshot file shows all four shapes (dimension keys + 3 surface events).

- [ ] **Step 2.5: Type check the new module**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 2.6: Commit**

```bash
git add scripts/quality-judge/judge-event-types.ts scripts/quality-judge/__tests__/judge-event-schema.snapshot.test.ts scripts/quality-judge/__tests__/__snapshots__/judge-event-schema.snapshot.test.ts.snap
git commit -m "feat(quality-judge): event types + per-surface dimension keys"
```

---

## Task 3: Generalize `posthog-emitter.ts`

This task changes the emitter and updates **four** existing call sites in `scripts/evaluation/`. Doing it as its own commit keeps the diff small and bisectable.

**Files:**

- Modify: `scripts/evaluation/posthog-emitter.ts`
- Modify: `scripts/evaluation/__tests__/posthog-emitter.test.ts`
- Modify: `scripts/evaluation/golden-set-relaxed-f1.ts`
- Modify: `scripts/evaluation/span-labeling-evaluation.ts`
- Modify: `scripts/evaluation/recommendation-eval.ts`

- [ ] **Step 3.1: Update the existing test to reflect the new shape**

Edit `scripts/evaluation/__tests__/posthog-emitter.test.ts`. Replace the `emit(...)` call inside `it("returns a no-op stub when POSTHOG_API_KEY is unset")` with the new shape:

```typescript
expect(() =>
  emitter.emit({
    distinctId: "test",
    event: "eval.completed",
    properties: {
      evalType: "span_labeling_f1",
      outcome: "passed",
      commit: "abc",
      durationMs: 1,
      promptCount: 1,
      errorCount: 0,
      metrics: {
        overallF1: 1,
        overallPrecision: 1,
        overallRecall: 1,
        perCategoryF1: {},
      },
    },
  }),
).not.toThrow();
```

- [ ] **Step 3.2: Run the test — verify it fails**

```bash
npx vitest run scripts/evaluation/__tests__/posthog-emitter.test.ts
```

Expected: FAIL — the new shape doesn't match the old `EmitArgs` (which extends `EvalCompletedProperties` and has no `event` / `properties` fields).

- [ ] **Step 3.3: Generalize the emitter**

Edit `scripts/evaluation/posthog-emitter.ts`. Replace the entire file with:

```typescript
import { PostHog } from "posthog-node";
import { randomUUID } from "node:crypto";
import { userInfo } from "node:os";

export interface EmitArgs {
  distinctId: string;
  event: string;
  properties: Record<string, unknown>;
}

export interface IEvalEmitter {
  emit(args: EmitArgs): void;
  shutdown(): Promise<void>;
}

class EvalEmitterReal implements IEvalEmitter {
  private readonly client: PostHog;

  constructor(apiKey: string, host?: string) {
    this.client = new PostHog(apiKey, {
      ...(host ? { host } : {}),
      flushAt: 1,
      flushInterval: 1000,
    });
  }

  emit(args: EmitArgs): void {
    try {
      this.client.capture({
        distinctId: args.distinctId,
        event: args.event,
        properties: args.properties,
      });
    } catch {
      // never throw upstream
    }
  }

  async shutdown(): Promise<void> {
    await this.client.shutdown();
  }
}

class EvalEmitterNoop implements IEvalEmitter {
  emit(): void {}
  async shutdown(): Promise<void> {}
}

export function createEvalEmitter(): IEvalEmitter {
  const apiKey = process.env.POSTHOG_API_KEY;
  if (!apiKey || apiKey.trim().length === 0) {
    return new EvalEmitterNoop();
  }
  return new EvalEmitterReal(apiKey, process.env.POSTHOG_HOST);
}

export function resolveDistinctId(): string {
  const runId = process.env.GITHUB_RUN_ID;
  if (runId) return `ci-${runId}`;

  try {
    const username = userInfo().username;
    if (username) return `local-${username}`;
  } catch {
    // fall through
  }

  return `anon-${randomUUID()}`;
}
```

Note: the import of `EvalCompletedProperties` is removed — emitter no longer knows about the eval-specific shape.

- [ ] **Step 3.4: Update `golden-set-relaxed-f1.ts` call site**

In `scripts/evaluation/golden-set-relaxed-f1.ts`, find the `emitter.emit({...})` call (around line 481). Wrap the existing properties under a `properties:` key and add `event: "eval.completed"`. Replace:

```typescript
emitter.emit({
  distinctId: resolveDistinctId(),
  evalType: "span_labeling_f1",
  outcome,
  // ... rest of properties
});
```

with:

```typescript
emitter.emit({
  distinctId: resolveDistinctId(),
  event: "eval.completed",
  properties: {
    evalType: "span_labeling_f1",
    outcome,
    // ... rest of properties (same fields as before, indented one level deeper)
  },
});
```

- [ ] **Step 3.5: Update `span-labeling-evaluation.ts` call sites (two of them)**

Same shape transformation at line ~2042 and line ~2072 in `scripts/evaluation/span-labeling-evaluation.ts`. Both calls move their existing fields under `properties:` and add `event: "eval.completed"`.

- [ ] **Step 3.6: Update `recommendation-eval.ts` call site**

Same transformation at line ~641 in `scripts/evaluation/recommendation-eval.ts`.

- [ ] **Step 3.7: Run all eval tests — verify the test passes and nothing else broke**

```bash
npx vitest run scripts/evaluation/
```

Expected: PASS for `posthog-emitter.test.ts`, `eval-event-schema.snapshot.test.ts`, and any other eval tests. No snapshot diffs.

- [ ] **Step 3.8: Type check the whole repo**

```bash
npx tsc --noEmit
```

Expected: 0 errors. If `recommendation-eval.ts` or others fail compilation, the call-site refactor missed something — fix it.

- [ ] **Step 3.9: Commit**

```bash
git add scripts/evaluation/posthog-emitter.ts scripts/evaluation/__tests__/posthog-emitter.test.ts scripts/evaluation/golden-set-relaxed-f1.ts scripts/evaluation/span-labeling-evaluation.ts scripts/evaluation/recommendation-eval.ts
git commit -m "refactor(eval-emitter): generalize emit() to take event + properties"
```

---

## Task 4: `correlation.ts` (pure math)

**Files:**

- Create: `scripts/quality-judge/correlation.ts`
- Create: `scripts/quality-judge/__tests__/correlation.test.ts`

`★ Insight ─────────────────────────────────────`
Spearman rank correlation is sensitive to tied ranks (which calibration sets will have — multiple events can score 20/25). The standard "average rank for ties" approach is the only one that gives a correct ρ. Naive implementations that use raw index ordering quietly produce wrong numbers, which would silently undermine the calibration gate.
`─────────────────────────────────────────────────`

- [ ] **Step 4.1: Write the failing test**

Create `scripts/quality-judge/__tests__/correlation.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { spearmanCorrelation, meanAbsoluteError } from "../correlation.js";

describe("spearmanCorrelation", () => {
  it("returns 1.0 for perfectly monotonic increasing data", () => {
    expect(spearmanCorrelation([1, 2, 3, 4, 5], [10, 20, 30, 40, 50])).toBe(1);
  });

  it("returns -1.0 for perfectly monotonic decreasing data", () => {
    expect(spearmanCorrelation([1, 2, 3, 4, 5], [50, 40, 30, 20, 10])).toBe(-1);
  });

  it("handles tied ranks (average-rank method)", () => {
    // [10, 10, 20] both tied at lowest → ranks [1.5, 1.5, 3]
    // [5, 5, 9]  same tie pattern → ρ should be 1.0
    expect(spearmanCorrelation([10, 10, 20], [5, 5, 9])).toBeCloseTo(1.0, 6);
  });

  it("returns a value between -1 and 1 for arbitrary data", () => {
    const rho = spearmanCorrelation(
      [3, 1, 4, 1, 5, 9, 2, 6],
      [2, 7, 1, 8, 2, 8, 1, 8],
    );
    expect(rho).toBeGreaterThanOrEqual(-1);
    expect(rho).toBeLessThanOrEqual(1);
  });

  it("throws on mismatched-length arrays", () => {
    expect(() => spearmanCorrelation([1, 2], [1])).toThrow();
  });
});

describe("meanAbsoluteError", () => {
  it("returns 0 for identical arrays", () => {
    expect(meanAbsoluteError([1, 2, 3], [1, 2, 3])).toBe(0);
  });

  it("computes the mean of absolute differences", () => {
    // |1-2| + |2-4| + |3-6| = 1 + 2 + 3 = 6 ; mean = 2
    expect(meanAbsoluteError([1, 2, 3], [2, 4, 6])).toBe(2);
  });

  it("throws on mismatched-length arrays", () => {
    expect(() => meanAbsoluteError([1, 2], [1])).toThrow();
  });
});
```

- [ ] **Step 4.2: Run the test — verify it fails**

```bash
npx vitest run scripts/quality-judge/__tests__/correlation.test.ts
```

Expected: FAIL — module missing.

- [ ] **Step 4.3: Implement `correlation.ts`**

Create `scripts/quality-judge/correlation.ts`:

```typescript
/**
 * Spearman rank correlation with tie-aware ranking (average-rank method).
 * Required by the calibration gate at ρ ≥ 0.7.
 */
function rankAverageTies(xs: number[]): number[] {
  const indexed = xs.map((v, i) => ({ v, i }));
  indexed.sort((a, b) => a.v - b.v);

  const ranks = new Array<number>(xs.length);
  let i = 0;
  while (i < indexed.length) {
    let j = i;
    while (j + 1 < indexed.length && indexed[j + 1].v === indexed[i].v) {
      j += 1;
    }
    // 1-based ranks; average across the tie group [i..j]
    const avg = (i + j + 2) / 2;
    for (let k = i; k <= j; k += 1) {
      ranks[indexed[k].i] = avg;
    }
    i = j + 1;
  }
  return ranks;
}

function pearson(xs: number[], ys: number[]): number {
  const n = xs.length;
  const meanX = xs.reduce((a, b) => a + b, 0) / n;
  const meanY = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let denX = 0;
  let denY = 0;
  for (let i = 0; i < n; i += 1) {
    const dx = xs[i] - meanX;
    const dy = ys[i] - meanY;
    num += dx * dy;
    denX += dx * dx;
    denY += dy * dy;
  }
  if (denX === 0 || denY === 0) return 0;
  return num / Math.sqrt(denX * denY);
}

export function spearmanCorrelation(xs: number[], ys: number[]): number {
  if (xs.length !== ys.length) {
    throw new Error(
      `spearmanCorrelation: length mismatch (${xs.length} vs ${ys.length})`,
    );
  }
  if (xs.length === 0) return 0;
  return pearson(rankAverageTies(xs), rankAverageTies(ys));
}

export function meanAbsoluteError(xs: number[], ys: number[]): number {
  if (xs.length !== ys.length) {
    throw new Error(
      `meanAbsoluteError: length mismatch (${xs.length} vs ${ys.length})`,
    );
  }
  if (xs.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < xs.length; i += 1) {
    sum += Math.abs(xs[i] - ys[i]);
  }
  return sum / xs.length;
}
```

- [ ] **Step 4.4: Run the test — verify it passes**

```bash
npx vitest run scripts/quality-judge/__tests__/correlation.test.ts
```

Expected: PASS.

- [ ] **Step 4.5: Commit**

```bash
git add scripts/quality-judge/correlation.ts scripts/quality-judge/__tests__/correlation.test.ts
git commit -m "feat(quality-judge): tie-aware Spearman + MAE helpers"
```

---

## Task 5: `content-extractors.ts`

**Files:**

- Create: `scripts/quality-judge/content-extractors.ts`
- Create: `scripts/quality-judge/__tests__/content-extractors.test.ts`

- [ ] **Step 5.1: Write the failing test**

Create `scripts/quality-judge/__tests__/content-extractors.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import {
  extractInputContent,
  extractOutputContent,
  isJudgeable,
} from "../content-extractors.js";

describe("extractInputContent", () => {
  it("projects optimize input fields", () => {
    const event = {
      properties: {
        inputPrompt: "wide shot of a cat",
        targetModel: "sora",
        mode: "creative",
        hasContext: true,
        hasShotPlan: false,
        useConstitutionalAI: true,
        extraneous: "ignored",
      },
    };
    expect(extractInputContent(event, "optimize")).toEqual({
      inputPrompt: "wide shot of a cat",
      targetModel: "sora",
      mode: "creative",
      hasContext: true,
      hasShotPlan: false,
      useConstitutionalAI: true,
    });
  });

  it("projects suggestions input fields", () => {
    const event = {
      properties: {
        highlightedText: "cat",
        fullPrompt: "wide shot of a cat",
        highlightedCategory: "subject",
      },
    };
    expect(extractInputContent(event, "suggestions")).toEqual({
      highlightedText: "cat",
      fullPrompt: "wide shot of a cat",
      highlightedCategory: "subject",
    });
  });

  it("projects span-labeling input fields", () => {
    const event = { properties: { inputText: "wide shot of a cat" } };
    expect(extractInputContent(event, "span-labeling")).toEqual({
      inputText: "wide shot of a cat",
    });
  });
});

describe("extractOutputContent", () => {
  it("projects optimize output", () => {
    const event = { properties: { outputPrompt: "Wide shot, ginger cat..." } };
    expect(extractOutputContent(event, "optimize")).toEqual({
      outputPrompt: "Wide shot, ginger cat...",
    });
  });

  it("projects suggestions output", () => {
    const event = {
      properties: { suggestions: ["tabby cat", "kitten", "feline"] },
    };
    expect(extractOutputContent(event, "suggestions")).toEqual({
      suggestions: ["tabby cat", "kitten", "feline"],
    });
  });

  it("projects span-labeling output", () => {
    const event = {
      properties: {
        spans: [{ text: "wide shot", category: "shot" }],
      },
    };
    expect(extractOutputContent(event, "span-labeling")).toEqual({
      spans: [{ text: "wide shot", category: "shot" }],
    });
  });
});

describe("isJudgeable", () => {
  it("returns false for optimize with null outputPrompt", () => {
    expect(
      isJudgeable({ properties: { outputPrompt: null } }, "optimize"),
    ).toBe(false);
  });

  it("returns false for suggestions with empty array", () => {
    expect(
      isJudgeable({ properties: { suggestions: [] } }, "suggestions"),
    ).toBe(false);
  });

  it("returns false for span-labeling with empty spans", () => {
    expect(isJudgeable({ properties: { spans: [] } }, "span-labeling")).toBe(
      false,
    );
  });

  it("returns true for optimize with a non-empty outputPrompt", () => {
    expect(
      isJudgeable(
        { properties: { outputPrompt: "Wide shot, ginger cat" } },
        "optimize",
      ),
    ).toBe(true);
  });
});
```

- [ ] **Step 5.2: Run — verify FAIL**

```bash
npx vitest run scripts/quality-judge/__tests__/content-extractors.test.ts
```

- [ ] **Step 5.3: Implement `content-extractors.ts`**

Create `scripts/quality-judge/content-extractors.ts`:

```typescript
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
```

- [ ] **Step 5.4: Run — verify PASS**

```bash
npx vitest run scripts/quality-judge/__tests__/content-extractors.test.ts
```

- [ ] **Step 5.5: Commit**

```bash
git add scripts/quality-judge/content-extractors.ts scripts/quality-judge/__tests__/content-extractors.test.ts
git commit -m "feat(quality-judge): per-surface content extractors"
```

---

## Task 6: `rubric-loader.ts` + skeleton `optimize.md`

This task lands the rubric loading mechanics. The Optimize rubric _body_ is authored fully in Task 7; here we just need a placeholder so the loader can be tested.

**Files:**

- Create: `scripts/quality-judge/rubrics/optimize.md` (placeholder body)
- Create: `scripts/quality-judge/rubric-loader.ts`
- Create: `scripts/quality-judge/__tests__/rubric-loader.test.ts`

- [ ] **Step 6.1: Write the failing test**

Create `scripts/quality-judge/__tests__/rubric-loader.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import {
  loadRubric,
  rubricVersionFor,
  __testHashRubricContent,
} from "../rubric-loader.js";

describe("rubric-loader", () => {
  it("loads a non-empty optimize rubric", async () => {
    const text = await loadRubric("optimize");
    expect(text.length).toBeGreaterThan(0);
  });

  it("rubricVersionFor returns an 8-char hex string", async () => {
    const v = await rubricVersionFor("optimize");
    expect(v).toMatch(/^[0-9a-f]{8}$/);
  });

  it("rubricVersionFor is whitespace-stable", () => {
    expect(__testHashRubricContent("hello world\n")).toBe(
      __testHashRubricContent("  hello  world  \n"),
    );
  });

  it("same content yields the same hash", () => {
    expect(__testHashRubricContent("abc")).toBe(__testHashRubricContent("abc"));
  });
});
```

- [ ] **Step 6.2: Create placeholder rubric body**

Create `scripts/quality-judge/rubrics/optimize.md`:

```markdown
# Optimize Quality Rubric (v0 placeholder)

This file is a placeholder. The full rubric is authored in Task 7.
```

- [ ] **Step 6.3: Run — verify FAIL**

```bash
npx vitest run scripts/quality-judge/__tests__/rubric-loader.test.ts
```

Expected: FAIL — `Cannot find module '../rubric-loader.js'`.

- [ ] **Step 6.4: Implement `rubric-loader.ts`**

Create `scripts/quality-judge/rubric-loader.ts`:

```typescript
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import type { QualityScoredSurface } from "./judge-event-types.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function rubricPath(surface: QualityScoredSurface): string {
  return join(__dirname, "rubrics", `${surface}.md`);
}

function normalize(s: string): string {
  // Collapse arbitrary whitespace so trivial whitespace edits don't bump the version.
  return s.replace(/\s+/g, " ").trim();
}

export function __testHashRubricContent(content: string): string {
  return createHash("sha256")
    .update(normalize(content))
    .digest("hex")
    .slice(0, 8);
}

export async function loadRubric(
  surface: QualityScoredSurface,
): Promise<string> {
  return readFile(rubricPath(surface), "utf8");
}

export async function rubricVersionFor(
  surface: QualityScoredSurface,
): Promise<string> {
  const content = await loadRubric(surface);
  return __testHashRubricContent(content);
}
```

- [ ] **Step 6.5: Run — verify PASS**

```bash
npx vitest run scripts/quality-judge/__tests__/rubric-loader.test.ts
```

- [ ] **Step 6.6: Commit**

```bash
git add scripts/quality-judge/rubric-loader.ts scripts/quality-judge/rubrics/optimize.md scripts/quality-judge/__tests__/rubric-loader.test.ts
git commit -m "feat(quality-judge): rubric loader + whitespace-stable version hash"
```

---

## Task 7: Author the Optimize rubric

The Optimize rubric is the **prompt** the judge LLM sees. Its 5 dimensions must match `OPTIMIZE_DIMENSION_KEYS` exactly. The rubric markdown is concatenated verbatim to the judge call, so it must end with explicit JSON output instructions.

**Files:**

- Modify: `scripts/quality-judge/rubrics/optimize.md` (full replacement)
- Create: `scripts/quality-judge/__tests__/rubric-prompt.snapshot.test.ts`

- [ ] **Step 7.1: Write the snapshot test**

Create `scripts/quality-judge/__tests__/rubric-prompt.snapshot.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { loadRubric } from "../rubric-loader.js";

describe("rubric prompts", () => {
  it("locks the optimize rubric content", async () => {
    expect(await loadRubric("optimize")).toMatchSnapshot();
  });

  it("locks the suggestions rubric content", async () => {
    expect(await loadRubric("suggestions")).toMatchSnapshot();
  });

  it("locks the span-labeling rubric content", async () => {
    expect(await loadRubric("span-labeling")).toMatchSnapshot();
  });
});
```

(Suggestions / span-labeling tests will FAIL until Tasks 11 / 12 land their rubric files — that is intentional. Use `it.skip` for those two cases for now, OR create empty placeholder rubric files like Task 6 did for Optimize.)

For cleanliness, **create the two placeholders now**:

```bash
echo "# Suggestions Quality Rubric (v0 placeholder)" > scripts/quality-judge/rubrics/suggestions.md
echo "# Span Labeling Quality Rubric (v0 placeholder)" > scripts/quality-judge/rubrics/span-labeling.md
```

- [ ] **Step 7.2: Replace `optimize.md` with the full rubric**

Overwrite `scripts/quality-judge/rubrics/optimize.md` with:

````markdown
# Optimize Quality Rubric (v1)

You are a senior video-generation prompt-engineer evaluating an automated optimization step.

The system takes a user's raw `inputPrompt` and produces a refined `outputPrompt` targeted at a specific video model (`targetModel`). You will score how well the output achieves a strong prompt **without losing the user's intent** or violating model-specific constraints.

You will be shown:

- `inputPrompt` — the raw user input (often terse)
- `targetModel` — which video model the output targets (e.g., `sora`, `veo`, `kling`, `luma`, `runway`)
- `mode` — the optimization mode the user selected
- `hasContext`, `hasShotPlan`, `useConstitutionalAI` — flags affecting the optimization
- `outputPrompt` — the refined prompt produced by the system

## Score each dimension on 0–5

### `fidelity` (0–5)

How faithfully the output preserves the user's stated intent — subject, action, mood, key visual references.

- **5:** All explicit user intent is preserved; nothing the user asked for is missing or contradicted.
- **3:** Mostly preserved; one minor element omitted or softened.
- **1:** A major user-intended element is missing, swapped, or contradicted.
- **0:** Output is essentially unrelated to the input, or contradicts the user's intent outright.

### `detailEnrichment` (0–5)

How well the output adds the cinematographic specificity a strong prompt needs (camera, lens, lighting, composition, motion) without inventing facts not implied by the input.

- **5:** Rich, plausible enrichment across camera/lighting/composition that fits the input.
- **3:** Some enrichment but several obvious axes (e.g., lighting) untouched.
- **1:** Minimal enrichment; output is barely longer than input.
- **0:** Enrichment is generic boilerplate, or invents details that contradict the input.

### `coherence` (0–5)

Whether the output reads as one coherent shot/scene description without contradictions or run-on tangents.

- **5:** Reads as a single, vivid, internally-consistent description.
- **3:** Mostly coherent; one weak transition or mild redundancy.
- **1:** Multiple contradictions or jarring topic shifts.
- **0:** Word salad / mid-thought truncation.

### `constraintCompliance` (0–5)

Does the output respect the target model's known constraints (length, formatting, prohibited terms, structural conventions)?

- **5:** Fully respects target-model conventions — length, structure, formatting.
- **3:** Mostly compliant; minor over-run on length or one stray formatting choice.
- **1:** Violates a clear convention (e.g., grossly over-long for the target model, or wrong shape).
- **0:** Violates multiple constraints; would be rejected by the target model.

### `brevityDiscipline` (0–5)

Did the optimizer hold the line on length, or did it bloat with filler ("cinematic", "stunning", "breathtaking")?

- **5:** Every word earns its place; no purple filler.
- **3:** A handful of filler adjectives; signal still strong.
- **1:** Heavy filler; signal-to-noise is poor.
- **0:** Output is mostly hype-adjective filler.

## Output format

Return **JSON only**. No prose before or after. Schema:

```json
{
  "dimensions": {
    "fidelity": 0,
    "detailEnrichment": 0,
    "coherence": 0,
    "constraintCompliance": 0,
    "brevityDiscipline": 0
  },
  "reasoning": "1-3 sentences explaining the dominant factors in this score."
}
```

The content to evaluate follows below the fence.
````

- [ ] **Step 7.3: Write the snapshot**

```bash
npx vitest run scripts/quality-judge/__tests__/rubric-prompt.snapshot.test.ts -u
```

Expected: PASS. Snapshot file now contains all three rubric bodies.

- [ ] **Step 7.4: Commit**

```bash
git add scripts/quality-judge/rubrics/optimize.md scripts/quality-judge/rubrics/suggestions.md scripts/quality-judge/rubrics/span-labeling.md scripts/quality-judge/__tests__/rubric-prompt.snapshot.test.ts scripts/quality-judge/__tests__/__snapshots__/rubric-prompt.snapshot.test.ts.snap
git commit -m "feat(quality-judge): Optimize rubric v1"
```

---

## Task 8: `judge-client.ts` — OpenAI judge wrapper

**Files:**

- Create: `scripts/quality-judge/judge-client.ts`
- Create: `scripts/quality-judge/__tests__/judge-client.test.ts`

`★ Insight ─────────────────────────────────────`
The judge prompt template is intentionally simple: rubric markdown concatenated with a fenced JSON block containing `{inputContent, outputContent}`. No template variables — that keeps rubric authoring as pure markdown editing and makes the `response_format: { type: "json_object" }` constraint enough to enforce parseable output. The smoke test should assert the rubric appears _verbatim_ in the OpenAI request so future template additions can't silently corrupt the prompt.
`─────────────────────────────────────────────────`

- [ ] **Step 8.1: Write the failing test**

Create `scripts/quality-judge/__tests__/judge-client.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

const createMock = vi.fn();

vi.mock("openai", () => ({
  default: class OpenAIMock {
    chat = { completions: { create: createMock } };
    constructor() {}
  },
}));

import { runJudge } from "../judge-client.js";
import { OPTIMIZE_DIMENSION_KEYS } from "../judge-event-types.js";

describe("runJudge", () => {
  beforeEach(() => {
    createMock.mockReset();
  });

  it("constructs a prompt containing the rubric verbatim and the surface content", async () => {
    createMock.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              dimensions: {
                fidelity: 5,
                detailEnrichment: 4,
                coherence: 4,
                constraintCompliance: 5,
                brevityDiscipline: 4,
              },
              reasoning: "Good.",
            }),
          },
        },
      ],
      usage: { prompt_tokens: 800, completion_tokens: 120 },
    });

    const result = await runJudge({
      rubric: "RUBRIC_MARKER_XYZ",
      surface: "optimize",
      inputContent: { inputPrompt: "INPUT_MARKER" },
      outputContent: { outputPrompt: "OUTPUT_MARKER" },
    });

    expect(createMock).toHaveBeenCalledOnce();
    const call = createMock.mock.calls[0][0];
    const userMessage = call.messages.find(
      (m: { role: string }) => m.role === "user",
    );
    expect(userMessage.content).toContain("RUBRIC_MARKER_XYZ");
    expect(userMessage.content).toContain("INPUT_MARKER");
    expect(userMessage.content).toContain("OUTPUT_MARKER");
    expect(call.response_format).toEqual({ type: "json_object" });
    expect(call.model).toBe("gpt-4o-2024-08-06");

    expect(result.dimensions).toEqual({
      fidelity: 5,
      detailEnrichment: 4,
      coherence: 4,
      constraintCompliance: 5,
      brevityDiscipline: 4,
    });
    expect(result.tokensIn).toBe(800);
    expect(result.tokensOut).toBe(120);
    expect(result.costUsd).toBeCloseTo(
      (800 / 1000) * 0.0025 + (120 / 1000) * 0.01,
      6,
    );
  });

  it("throws on malformed JSON output", async () => {
    createMock.mockResolvedValue({
      choices: [{ message: { content: "not json" } }],
      usage: { prompt_tokens: 100, completion_tokens: 10 },
    });
    await expect(
      runJudge({
        rubric: "r",
        surface: "optimize",
        inputContent: {},
        outputContent: {},
      }),
    ).rejects.toThrow();
  });

  it("rejects output missing a required dimension key", async () => {
    createMock.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              dimensions: {
                fidelity: 5,
                detailEnrichment: 4,
                coherence: 4,
                constraintCompliance: 5,
                // brevityDiscipline missing
              },
              reasoning: "x",
            }),
          },
        },
      ],
      usage: { prompt_tokens: 100, completion_tokens: 10 },
    });
    await expect(
      runJudge({
        rubric: "r",
        surface: "optimize",
        inputContent: {},
        outputContent: {},
      }),
    ).rejects.toThrow(/brevityDiscipline/);
  });

  it("clamps dimension values to integers 0–5", async () => {
    createMock.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              dimensions: {
                fidelity: 5,
                detailEnrichment: 4.7, // not an integer
                coherence: 4,
                constraintCompliance: 9, // out of range
                brevityDiscipline: -1, // out of range
              },
              reasoning: "x",
            }),
          },
        },
      ],
      usage: { prompt_tokens: 100, completion_tokens: 10 },
    });
    const r = await runJudge({
      rubric: "r",
      surface: "optimize",
      inputContent: {},
      outputContent: {},
    });
    // Use the dimension keys to assert each value is an integer in [0, 5].
    for (const k of OPTIMIZE_DIMENSION_KEYS) {
      const v = (r.dimensions as Record<string, number>)[k];
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(5);
    }
  });
});
```

- [ ] **Step 8.2: Run — verify FAIL**

```bash
npx vitest run scripts/quality-judge/__tests__/judge-client.test.ts
```

- [ ] **Step 8.3: Implement `judge-client.ts`**

Create `scripts/quality-judge/judge-client.ts`:

```typescript
import OpenAI from "openai";

import { computeCostUsd } from "./pricing.js";
import {
  dimensionKeysFor,
  type AnyDimensions,
  type QualityScoredSurface,
} from "./judge-event-types.js";

export interface JudgeInput {
  rubric: string;
  surface: QualityScoredSurface;
  inputContent: Record<string, unknown>;
  outputContent: Record<string, unknown>;
}

export interface JudgeOutput {
  dimensions: AnyDimensions;
  reasoning: string;
  tokensIn: number;
  tokensOut: number;
  costUsd: number;
}

const JUDGE_MODEL = "gpt-4o-2024-08-06";

let cachedClient: OpenAI | null = null;
function client(): OpenAI {
  if (!cachedClient) cachedClient = new OpenAI();
  return cachedClient;
}

function buildUserMessage(args: JudgeInput): string {
  const payload = JSON.stringify(
    { inputContent: args.inputContent, outputContent: args.outputContent },
    null,
    2,
  );
  return `${args.rubric}\n\n\`\`\`json\n${payload}\n\`\`\`\n`;
}

function clampInt0to5(v: unknown): number {
  if (typeof v !== "number" || Number.isNaN(v)) return 0;
  const rounded = Math.round(v);
  if (rounded < 0) return 0;
  if (rounded > 5) return 5;
  return rounded;
}

function normalizeDimensions(
  raw: unknown,
  surface: QualityScoredSurface,
): AnyDimensions {
  if (typeof raw !== "object" || raw === null) {
    throw new Error("Judge output: dimensions is not an object");
  }
  const obj = raw as Record<string, unknown>;
  const keys = dimensionKeysFor(surface);
  const out: Record<string, number> = {};
  for (const k of keys) {
    if (!(k in obj)) {
      throw new Error(`Judge output: missing dimension '${k}'`);
    }
    out[k] = clampInt0to5(obj[k]);
  }
  return out as AnyDimensions;
}

export async function runJudge(args: JudgeInput): Promise<JudgeOutput> {
  const response = await client().chat.completions.create({
    model: JUDGE_MODEL,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "You are evaluating the output of a video-prompt system. Return JSON only.",
      },
      { role: "user", content: buildUserMessage(args) },
    ],
  });

  const raw = response.choices[0]?.message?.content ?? "";
  let parsed: { dimensions?: unknown; reasoning?: unknown };
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`Judge output: not valid JSON: ${raw.slice(0, 200)}`);
  }
  const dimensions = normalizeDimensions(parsed.dimensions, args.surface);
  const reasoning =
    typeof parsed.reasoning === "string" ? parsed.reasoning : "";
  const tokensIn = response.usage?.prompt_tokens ?? 0;
  const tokensOut = response.usage?.completion_tokens ?? 0;
  return {
    dimensions,
    reasoning,
    tokensIn,
    tokensOut,
    costUsd: computeCostUsd(JUDGE_MODEL, tokensIn, tokensOut),
  };
}

export const JUDGE_MODEL_NAME = JUDGE_MODEL;
```

- [ ] **Step 8.4: Run — verify PASS**

```bash
npx vitest run scripts/quality-judge/__tests__/judge-client.test.ts
```

- [ ] **Step 8.5: Type check**

```bash
npx tsc --noEmit
```

- [ ] **Step 8.6: Commit**

```bash
git add scripts/quality-judge/judge-client.ts scripts/quality-judge/__tests__/judge-client.test.ts
git commit -m "feat(quality-judge): OpenAI judge client with output normalization"
```

---

## Task 9: `posthog-query-client.ts` — read events from PostHog

`★ Insight ─────────────────────────────────────`
The PostHog write SDK (`posthog-node`) is fire-and-forget; it doesn't expose query. The judge needs the **HogQL HTTP query endpoint** — `POST /api/projects/:project_id/query/` with `{ query: { kind: "HogQLQuery", query: "SELECT ..." } }`. This is REST-over-HTTP; we'll use `fetch` directly rather than pulling in another dep. Keeping the client tiny and pure-fetch lets it be mocked trivially in the smoke test.
`─────────────────────────────────────────────────`

**Files:**

- Create: `scripts/quality-judge/posthog-query-client.ts`
- Create: `scripts/quality-judge/__tests__/posthog-query-client.test.ts`

- [ ] **Step 9.1: Write the failing test**

Create `scripts/quality-judge/__tests__/posthog-query-client.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  createPostHogQueryClient,
  type PostHogQueryClient,
} from "../posthog-query-client.js";

const originalFetch = global.fetch;

describe("posthog-query-client", () => {
  beforeEach(() => {
    process.env.POSTHOG_PROJECT_API_KEY = "fake-personal-key";
    process.env.POSTHOG_PROJECT_ID = "123";
  });

  afterEach(() => {
    delete process.env.POSTHOG_PROJECT_API_KEY;
    delete process.env.POSTHOG_PROJECT_ID;
    global.fetch = originalFetch;
  });

  it("returns a noop client when keys are missing", async () => {
    delete process.env.POSTHOG_PROJECT_API_KEY;
    const client = createPostHogQueryClient();
    await expect(
      client.fetchEventsToScore("optimize.completed", 24, 1),
    ).resolves.toEqual([]);
    await expect(client.fetchAlreadyScoredIds([], "v", "m")).resolves.toEqual(
      new Set(),
    );
  });

  it("issues a HogQL query and maps results to events", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        results: [
          [
            "00000000-0000-0000-0000-000000000001",
            "optimize.completed",
            { inputPrompt: "x", outputPrompt: "y", source: "synthetic" },
          ],
        ],
      }),
    }) as unknown as typeof fetch;

    const client = createPostHogQueryClient();
    const events = await client.fetchEventsToScore("optimize.completed", 24, 1);
    expect(events).toEqual([
      {
        uuid: "00000000-0000-0000-0000-000000000001",
        event: "optimize.completed",
        properties: {
          inputPrompt: "x",
          outputPrompt: "y",
          source: "synthetic",
        },
      },
    ]);

    const call = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(call[0]).toContain("/api/projects/123/query");
    const body = JSON.parse(call[1].body);
    expect(body.query.kind).toBe("HogQLQuery");
    expect(body.query.query).toContain("optimize.completed");
  });

  it("returns a set of already-scored ids", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        results: [["id-1"], ["id-2"]],
      }),
    }) as unknown as typeof fetch;

    const client = createPostHogQueryClient();
    const seen = await client.fetchAlreadyScoredIds(
      ["id-1", "id-2", "id-3"],
      "v1",
      "gpt-4o-2024-08-06",
    );
    expect(seen).toEqual(new Set(["id-1", "id-2"]));
  });

  it("logs and returns empty when HTTP fails (best-effort)", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => "error",
    }) as unknown as typeof fetch;
    const client = createPostHogQueryClient();
    const events = await client.fetchEventsToScore("optimize.completed", 24, 1);
    expect(events).toEqual([]);
  });

  it("encodes per-source sampling: synth/dogfood always, user at userSampleRate", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ results: [] }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const client = createPostHogQueryClient();
    await client.fetchEventsToScore("optimize.completed", 24, 0.1);

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    const q = body.query.query as string;
    expect(q).toContain("'synthetic'");
    expect(q).toContain("'dogfood'");
    expect(q).toContain("'user'");
    // 10% sample → modulo 10
    expect(q).toContain("cityHash64(toString(uuid)) % 100 < 10");
  });
});
```

- [ ] **Step 9.2: Run — verify FAIL**

```bash
npx vitest run scripts/quality-judge/__tests__/posthog-query-client.test.ts
```

- [ ] **Step 9.3: Implement `posthog-query-client.ts`**

Create `scripts/quality-judge/posthog-query-client.ts`:

```typescript
export interface PostHogEventRow {
  uuid: string;
  event: string;
  properties: Record<string, unknown>;
}

export interface PostHogQueryClient {
  /**
   * Fetch events to score. Per spec § 1 sampling rule:
   *   - source IN ('synthetic','dogfood') → 100%
   *   - source = 'user' → userSampleRate fraction (default 0.10 pre-launch)
   *   - source IN ('ci','dev','unknown') → excluded
   */
  fetchEventsToScore(
    eventName: string,
    hoursBack: number,
    userSampleRate: number,
  ): Promise<PostHogEventRow[]>;

  fetchAlreadyScoredIds(
    candidateIds: string[],
    rubricVersion: string,
    judgeModel: string,
  ): Promise<Set<string>>;
}

const NOOP_CLIENT: PostHogQueryClient = {
  async fetchEventsToScore(_event: string, _hours: number, _rate: number) {
    return [];
  },
  async fetchAlreadyScoredIds() {
    return new Set();
  },
};

class HttpClient implements PostHogQueryClient {
  constructor(
    private readonly host: string,
    private readonly projectId: string,
    private readonly personalApiKey: string,
  ) {}

  private async query<T>(hogql: string): Promise<T[][] | null> {
    try {
      const res = await fetch(
        `${this.host}/api/projects/${this.projectId}/query/`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.personalApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            query: { kind: "HogQLQuery", query: hogql },
          }),
        },
      );
      if (!res.ok) {
        // eslint-disable-next-line no-console
        console.warn(
          `[quality-judge] PostHog query failed (${res.status}): ${await res.text()}`,
        );
        return null;
      }
      const json = (await res.json()) as { results?: T[][] };
      return json.results ?? null;
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn(`[quality-judge] PostHog query error: ${String(err)}`);
      return null;
    }
  }

  async fetchEventsToScore(
    eventName: string,
    hoursBack: number,
    userSampleRate: number,
  ): Promise<PostHogEventRow[]> {
    // Per-source sampling per spec § 1:
    //   synthetic + dogfood always included; user included at userSampleRate.
    const userPercent = Math.max(
      0,
      Math.min(100, Math.floor(userSampleRate * 100)),
    );
    const hogql = `
      SELECT uuid, event, properties
      FROM events
      WHERE event = '${eventName}'
        AND timestamp > now() - INTERVAL ${hoursBack} HOUR
        AND (
          properties.source IN ('synthetic', 'dogfood')
          OR (
            properties.source = 'user'
            AND cityHash64(toString(uuid)) % 100 < ${userPercent}
          )
        )
      ORDER BY timestamp DESC
      LIMIT 1000
    `;
    const rows = await this.query<unknown>(hogql);
    if (!rows) return [];
    return rows.map((r) => ({
      uuid: String(r[0]),
      event: String(r[1]),
      properties:
        typeof r[2] === "string"
          ? (JSON.parse(r[2]) as Record<string, unknown>)
          : ((r[2] as Record<string, unknown>) ?? {}),
    }));
  }

  async fetchAlreadyScoredIds(
    candidateIds: string[],
    rubricVersion: string,
    judgeModel: string,
  ): Promise<Set<string>> {
    if (candidateIds.length === 0) return new Set();
    const list = candidateIds
      .map((id) => `'${id.replace(/'/g, "")}'`)
      .join(",");
    const hogql = `
      SELECT properties.scoredEventId
      FROM events
      WHERE event = 'quality.scored'
        AND properties.scoredEventId IN (${list})
        AND properties.rubricVersion = '${rubricVersion}'
        AND properties.judgeModel = '${judgeModel}'
        AND timestamp > now() - INTERVAL 7 DAY
    `;
    const rows = await this.query<unknown>(hogql);
    if (!rows) return new Set();
    return new Set(rows.map((r) => String(r[0])));
  }
}

export function createPostHogQueryClient(): PostHogQueryClient {
  const personalApiKey = process.env.POSTHOG_PERSONAL_API_KEY;
  const projectId = process.env.POSTHOG_PROJECT_ID;
  if (!personalApiKey || !projectId) {
    // Fallback for tests where these are stubbed via POSTHOG_PROJECT_API_KEY
    // (kept for test compat); production reads POSTHOG_PERSONAL_API_KEY.
    const altKey = process.env.POSTHOG_PROJECT_API_KEY;
    if (!altKey || !projectId) return NOOP_CLIENT;
    const host = process.env.POSTHOG_HOST ?? "https://us.posthog.com";
    return new HttpClient(host, projectId, altKey);
  }
  const host = process.env.POSTHOG_HOST ?? "https://us.posthog.com";
  return new HttpClient(host, projectId, personalApiKey);
}
```

- [ ] **Step 9.4: Run — verify PASS**

```bash
npx vitest run scripts/quality-judge/__tests__/posthog-query-client.test.ts
```

- [ ] **Step 9.5: Commit**

```bash
git add scripts/quality-judge/posthog-query-client.ts scripts/quality-judge/__tests__/posthog-query-client.test.ts
git commit -m "feat(quality-judge): PostHog HogQL query client (read path)"
```

---

## Task 10: `run-judge.ts` orchestrator + smoke test

**Files:**

- Create: `scripts/quality-judge/run-judge.ts`
- Create: `scripts/quality-judge/__tests__/run-judge.smoke.test.ts`
- Modify: `package.json` — add `judge:run` script

- [ ] **Step 10.1: Write the failing smoke test**

Create `scripts/quality-judge/__tests__/run-judge.smoke.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const emitMock = vi.fn();
const shutdownMock = vi.fn(async () => undefined);
const judgeMock = vi.fn();
const fetchEventsMock = vi.fn();
const fetchScoredMock = vi.fn();

vi.mock("../../evaluation/posthog-emitter.js", () => ({
  createEvalEmitter: () => ({ emit: emitMock, shutdown: shutdownMock }),
  resolveDistinctId: () => "test",
}));

vi.mock("../judge-client.js", () => ({
  runJudge: judgeMock,
  JUDGE_MODEL_NAME: "gpt-4o-2024-08-06",
}));

vi.mock("../posthog-query-client.js", () => ({
  createPostHogQueryClient: () => ({
    fetchEventsToScore: fetchEventsMock,
    fetchAlreadyScoredIds: fetchScoredMock,
  }),
}));

import { runJudgeForSurface } from "../run-judge.js";

describe("run-judge orchestrator", () => {
  beforeEach(() => {
    emitMock.mockReset();
    shutdownMock.mockClear();
    judgeMock.mockReset();
    fetchEventsMock.mockReset();
    fetchScoredMock.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("emits a quality.scored event for a judgeable optimize event", async () => {
    fetchEventsMock.mockResolvedValue([
      {
        uuid: "e1",
        event: "optimize.completed",
        properties: {
          inputPrompt: "wide shot",
          outputPrompt: "Wide shot, ginger cat, soft side light",
          targetModel: "sora",
          mode: "creative",
          hasContext: false,
          hasShotPlan: false,
          useConstitutionalAI: false,
          source: "synthetic",
        },
      },
    ]);
    fetchScoredMock.mockResolvedValue(new Set());
    judgeMock.mockResolvedValue({
      dimensions: {
        fidelity: 5,
        detailEnrichment: 4,
        coherence: 4,
        constraintCompliance: 5,
        brevityDiscipline: 4,
      },
      reasoning: "ok",
      tokensIn: 800,
      tokensOut: 100,
      costUsd: 0.003,
    });

    await runJudgeForSurface("optimize", { hoursBack: 24, userSampleRate: 1 });

    expect(emitMock).toHaveBeenCalledOnce();
    const args = emitMock.mock.calls[0][0];
    expect(args.event).toBe("quality.scored");
    expect(args.properties.scoredEvent).toBe("optimize.completed");
    expect(args.properties.scoredEventId).toBe("e1");
    expect(args.properties.surface).toBe("optimize");
    expect(args.properties.totalScore).toBe(22);
    expect(args.properties.judgeModel).toBe("gpt-4o-2024-08-06");
    expect(args.properties.source).toBe("synthetic");
  });

  it("skips already-scored events (idempotency)", async () => {
    fetchEventsMock.mockResolvedValue([
      {
        uuid: "e1",
        event: "optimize.completed",
        properties: {
          inputPrompt: "x",
          outputPrompt: "y",
          source: "synthetic",
        },
      },
    ]);
    fetchScoredMock.mockResolvedValue(new Set(["e1"]));

    await runJudgeForSurface("optimize", { hoursBack: 24, userSampleRate: 1 });

    expect(judgeMock).not.toHaveBeenCalled();
    expect(emitMock).not.toHaveBeenCalled();
  });

  it("skips non-judgeable events (empty output)", async () => {
    fetchEventsMock.mockResolvedValue([
      {
        uuid: "e1",
        event: "optimize.completed",
        properties: {
          inputPrompt: "x",
          outputPrompt: null,
          source: "synthetic",
        },
      },
    ]);
    fetchScoredMock.mockResolvedValue(new Set());

    await runJudgeForSurface("optimize", { hoursBack: 24, userSampleRate: 1 });

    expect(judgeMock).not.toHaveBeenCalled();
    expect(emitMock).not.toHaveBeenCalled();
  });

  it("does not throw when the judge call fails (best-effort)", async () => {
    fetchEventsMock.mockResolvedValue([
      {
        uuid: "e1",
        event: "optimize.completed",
        properties: {
          inputPrompt: "x",
          outputPrompt: "y",
          source: "synthetic",
        },
      },
    ]);
    fetchScoredMock.mockResolvedValue(new Set());
    judgeMock.mockRejectedValue(new Error("openai 500"));

    await expect(
      runJudgeForSurface("optimize", { hoursBack: 24, userSampleRate: 1 }),
    ).resolves.not.toThrow();
    expect(emitMock).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 10.2: Run — verify FAIL**

```bash
npx vitest run scripts/quality-judge/__tests__/run-judge.smoke.test.ts
```

- [ ] **Step 10.3: Implement `run-judge.ts`**

Create `scripts/quality-judge/run-judge.ts`:

```typescript
import {
  createEvalEmitter,
  resolveDistinctId,
} from "../evaluation/posthog-emitter.js";

import {
  extractInputContent,
  extractOutputContent,
  isJudgeable,
} from "./content-extractors.js";
import { runJudge, JUDGE_MODEL_NAME } from "./judge-client.js";
import {
  createPostHogQueryClient,
  type PostHogQueryClient,
} from "./posthog-query-client.js";
import { loadRubric, rubricVersionFor } from "./rubric-loader.js";
import {
  scoredEventNameFor,
  sumDimensions,
  type QualityScoredSurface,
} from "./judge-event-types.js";

export interface RunJudgeOptions {
  hoursBack: number;
  /**
   * Fraction (0..1) of `source = 'user'` events to score.
   * Per spec § 1: 10% pre-launch (0.1). `synthetic` + `dogfood` are always 100%.
   */
  userSampleRate: number;
}

export async function runJudgeForSurface(
  surface: QualityScoredSurface,
  opts: RunJudgeOptions,
  // Injectable for tests; default to the real implementations
  deps?: { queryClient?: PostHogQueryClient },
): Promise<void> {
  const emitter = createEvalEmitter();
  const queryClient = deps?.queryClient ?? createPostHogQueryClient();
  try {
    const rubric = await loadRubric(surface);
    const rubricVersion = await rubricVersionFor(surface);
    const eventName = scoredEventNameFor(surface);

    const events = await queryClient.fetchEventsToScore(
      eventName,
      opts.hoursBack,
      opts.userSampleRate,
    );
    if (events.length === 0) {
      // eslint-disable-next-line no-console
      console.log(`[quality-judge] ${surface}: no events to score.`);
      return;
    }

    const seen = await queryClient.fetchAlreadyScoredIds(
      events.map((e) => e.uuid),
      rubricVersion,
      JUDGE_MODEL_NAME,
    );

    for (const event of events) {
      if (seen.has(event.uuid)) continue;
      if (!isJudgeable(event, surface)) continue;

      const startedAt = Date.now();
      try {
        const judged = await runJudge({
          rubric,
          surface,
          inputContent: extractInputContent(event, surface),
          outputContent: extractOutputContent(event, surface),
        });
        const totalScore = sumDimensions(judged.dimensions);
        emitter.emit({
          distinctId: resolveDistinctId(),
          event: "quality.scored",
          properties: {
            scoredEvent: event.event,
            scoredEventId: event.uuid,
            surface,
            rubricVersion,
            judgeModel: JUDGE_MODEL_NAME,
            judgeDurationMs: Date.now() - startedAt,
            judgeCostUsd: judged.costUsd,
            totalScore,
            dimensions: judged.dimensions,
            reasoning: judged.reasoning,
            source: event.properties.source ?? "unknown",
          },
        });
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn(
          `[quality-judge] ${surface} ${event.uuid}: judge failed: ${String(err)}`,
        );
      }
    }
  } finally {
    await emitter.shutdown();
  }
}

async function main(): Promise<void> {
  const args = new Set(process.argv.slice(2));
  const surfaces: QualityScoredSurface[] = args.has("--surface")
    ? [
        process.argv[
          process.argv.indexOf("--surface") + 1
        ] as QualityScoredSurface,
      ]
    : ["optimize", "suggestions", "span-labeling"];
  const hoursBack = Number(process.env.QUALITY_JUDGE_HOURS_BACK ?? 24);
  // Default 0.1 per spec § 1 ("10% user initially"). synth/dogfood always 100%.
  const userSampleRate = Number(
    process.env.QUALITY_JUDGE_USER_SAMPLE_RATE ?? 0.1,
  );

  for (const surface of surfaces) {
    // eslint-disable-next-line no-console
    console.log(`[quality-judge] running for ${surface}`);
    await runJudgeForSurface(surface, { hoursBack, userSampleRate });
  }
}

// Run when invoked directly via tsx
const invokedAsScript = import.meta.url === `file://${process.argv[1]}`;
if (invokedAsScript) {
  main().catch((err) => {
    // eslint-disable-next-line no-console
    console.error("[quality-judge] fatal:", err);
    process.exit(1);
  });
}
```

- [ ] **Step 10.4: Run — verify PASS**

```bash
npx vitest run scripts/quality-judge/__tests__/run-judge.smoke.test.ts
```

- [ ] **Step 10.5: Add `judge:run` npm script**

Edit `package.json`. Add to the `"scripts"` block (next to other `eval:*` entries):

```json
"judge:run": "tsx --tsconfig server/tsconfig.json scripts/quality-judge/run-judge.ts",
```

- [ ] **Step 10.6: Type check**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 10.7: Commit**

```bash
git add scripts/quality-judge/run-judge.ts scripts/quality-judge/__tests__/run-judge.smoke.test.ts package.json
git commit -m "feat(quality-judge): run-judge orchestrator + smoke test"
```

---

## Task 11: Author the Optimize calibration set + `run-calibration.ts`

This task involves **hand work** that no test can shortcut: scoring 30 real Optimize examples. The calibration set is the foundation of the trust gate. Bad examples → unreliable judge.

`★ Insight ─────────────────────────────────────`
The calibration set must cover the full quality range — not just "good" examples. If you only score 7-out-of-the-park optimizations, the judge could rank-correlate by random chance at ρ > 0.7. Aim for ~7 examples each at low (0–10 total), middle (11–17), and high (18–25), plus ~9 edge cases (very short prompts, contradictions, model-constraint violations). The Spearman test is meaningful only over a wide score range.
`─────────────────────────────────────────────────`

**Files:**

- Create: `scripts/quality-judge/calibration/optimize.calibration.json`
- Create: `scripts/quality-judge/calibration/run-calibration.ts`
- Create: `scripts/quality-judge/__tests__/calibration-shape.test.ts`
- Modify: `package.json` — add `judge:calibrate` npm script

- [ ] **Step 11.1: Write the calibration-shape test (locks JSON structure)**

Create `scripts/quality-judge/__tests__/calibration-shape.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { OPTIMIZE_DIMENSION_KEYS } from "../judge-event-types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const optimizePath = join(
  __dirname,
  "..",
  "calibration",
  "optimize.calibration.json",
);

describe("optimize calibration set", () => {
  const entries = JSON.parse(readFileSync(optimizePath, "utf8")) as Array<{
    scoredEvent: string;
    inputContent: Record<string, unknown>;
    outputContent: Record<string, unknown>;
    humanScore: number;
    humanDimensions: Record<string, number>;
    humanNotes: string;
    authoredAt: string;
    authoredBy: string;
  }>;

  it("contains at least 30 entries", () => {
    expect(entries.length).toBeGreaterThanOrEqual(30);
  });

  it("every entry uses scoredEvent = 'optimize.completed'", () => {
    for (const e of entries) {
      expect(e.scoredEvent).toBe("optimize.completed");
    }
  });

  it("every entry has all 5 optimize dimensions", () => {
    for (const e of entries) {
      for (const k of OPTIMIZE_DIMENSION_KEYS) {
        expect(e.humanDimensions[k]).toBeTypeOf("number");
        expect(e.humanDimensions[k]).toBeGreaterThanOrEqual(0);
        expect(e.humanDimensions[k]).toBeLessThanOrEqual(5);
      }
    }
  });

  it("humanScore equals the sum of dimensions", () => {
    for (const e of entries) {
      const sum = Object.values(e.humanDimensions).reduce((a, b) => a + b, 0);
      expect(e.humanScore).toBe(sum);
    }
  });

  it("covers the full quality range (min ≤ 10, max ≥ 18)", () => {
    const scores = entries.map((e) => e.humanScore);
    expect(Math.min(...scores)).toBeLessThanOrEqual(10);
    expect(Math.max(...scores)).toBeGreaterThanOrEqual(18);
  });

  it("inputContent includes the optimize input keys", () => {
    for (const e of entries) {
      expect(e.inputContent).toHaveProperty("inputPrompt");
      expect(e.inputContent).toHaveProperty("targetModel");
    }
  });

  it("outputContent includes outputPrompt", () => {
    for (const e of entries) {
      expect(e.outputContent).toHaveProperty("outputPrompt");
    }
  });
});
```

- [ ] **Step 11.2: Run — verify FAIL**

```bash
npx vitest run scripts/quality-judge/__tests__/calibration-shape.test.ts
```

Expected: FAIL — file doesn't exist.

- [ ] **Step 11.3: Author 30 Optimize calibration entries**

Create `scripts/quality-judge/calibration/optimize.calibration.json` with a JSON array of **at least 30 entries**. The schema for each entry:

```json
{
  "scoredEvent": "optimize.completed",
  "inputContent": {
    "inputPrompt": "<the user's raw prompt>",
    "targetModel": "<sora | veo | kling | luma | runway>",
    "mode": "<the optimize mode>",
    "hasContext": false,
    "hasShotPlan": false,
    "useConstitutionalAI": false
  },
  "outputContent": {
    "outputPrompt": "<the optimized output you are scoring>"
  },
  "humanScore": 17,
  "humanDimensions": {
    "fidelity": 4,
    "detailEnrichment": 3,
    "coherence": 4,
    "constraintCompliance": 3,
    "brevityDiscipline": 3
  },
  "humanNotes": "<1-2 sentence explanation of the dominant scoring factors>",
  "authoredAt": "2026-05-12",
  "authoredBy": "<your name>"
}
```

**Authoring guidance:**

1. **Source the 30 examples from real `optimize.completed` events** in PostHog (filter `source IN ('synthetic','dogfood')`) — or from the synthetic harness output if PostHog has too few. Do not invent examples; ungrounded entries calibrate the judge against fiction.
2. **Distribute coverage:** ~7 at total ≤ 10, ~7 at total 11–17, ~7 at total ≥ 18, ~9 edge cases (very short inputs, contradictions, model-constraint violations, hype-filler outputs).
3. **Score one dimension at a time** across all 30 entries, not entry-by-entry. Holding one dimension's bar steady across the whole set produces a calibrated set.
4. **Save a sanity-check Spearman against yourself:** for two entries pair-wise, would you rank them the same way again on a different day? If not, re-score.

This step is a **batch of work**, not a 5-minute step. Plan for a half-day of hand-scoring.

- [ ] **Step 11.4: Run the shape test — verify PASS**

```bash
npx vitest run scripts/quality-judge/__tests__/calibration-shape.test.ts
```

If any assertion fails (e.g., quality range too narrow), revise entries until the test passes.

- [ ] **Step 11.5: Implement `run-calibration.ts`**

Create `scripts/quality-judge/calibration/run-calibration.ts`:

```typescript
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { runJudge } from "../judge-client.js";
import { loadRubric } from "../rubric-loader.js";
import { spearmanCorrelation, meanAbsoluteError } from "../correlation.js";
import {
  sumDimensions,
  type QualityScoredSurface,
} from "../judge-event-types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

interface CalibrationEntry {
  scoredEvent: string;
  inputContent: Record<string, unknown>;
  outputContent: Record<string, unknown>;
  humanScore: number;
  humanDimensions: Record<string, number>;
  humanNotes: string;
  authoredAt: string;
  authoredBy: string;
}

async function loadCalibration(
  surface: QualityScoredSurface,
): Promise<CalibrationEntry[]> {
  const path = join(__dirname, `${surface}.calibration.json`);
  return JSON.parse(await readFile(path, "utf8")) as CalibrationEntry[];
}

async function runForSurface(surface: QualityScoredSurface): Promise<boolean> {
  const entries = await loadCalibration(surface);
  const rubric = await loadRubric(surface);

  const results = await Promise.all(
    entries.map(async (entry) => {
      try {
        const judged = await runJudge({
          rubric,
          surface,
          inputContent: entry.inputContent,
          outputContent: entry.outputContent,
        });
        return {
          humanScore: entry.humanScore,
          judgeScore: sumDimensions(judged.dimensions),
        };
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn(
          `[calibration] ${surface}: skipped entry — ${String(err)}`,
        );
        return null;
      }
    }),
  );

  const valid = results.filter(
    (r): r is { humanScore: number; judgeScore: number } => r !== null,
  );
  if (valid.length < 20) {
    // eslint-disable-next-line no-console
    console.error(
      `[calibration] ${surface}: too few valid entries (${valid.length}/${entries.length}); cannot judge`,
    );
    return false;
  }

  const rho = spearmanCorrelation(
    valid.map((r) => r.humanScore),
    valid.map((r) => r.judgeScore),
  );
  const mae = meanAbsoluteError(
    valid.map((r) => r.humanScore),
    valid.map((r) => r.judgeScore),
  );

  // eslint-disable-next-line no-console
  console.log(
    `[calibration] ${surface}: ρ=${rho.toFixed(3)}  MAE=${mae.toFixed(2)}  (n=${valid.length})`,
  );

  if (rho < 0.7) {
    // eslint-disable-next-line no-console
    console.error(`[calibration] ${surface}: FAILED — need ρ ≥ 0.7`);
    return false;
  }
  return true;
}

async function main(): Promise<void> {
  const requested = process.argv.slice(2);
  const surfaces: QualityScoredSurface[] = requested.length
    ? (requested as QualityScoredSurface[])
    : ["optimize", "suggestions", "span-labeling"];

  let allOk = true;
  for (const surface of surfaces) {
    const ok = await runForSurface(surface);
    if (!ok) allOk = false;
  }
  process.exit(allOk ? 0 : 1);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("[calibration] fatal:", err);
  process.exit(2);
});
```

- [ ] **Step 11.6: Add `judge:calibrate` npm script**

Edit `package.json`:

```json
"judge:calibrate": "tsx --tsconfig server/tsconfig.json scripts/quality-judge/calibration/run-calibration.ts",
```

- [ ] **Step 11.7: Run calibration locally and iterate until ρ ≥ 0.7**

```bash
OPENAI_API_KEY=sk-... npm run judge:calibrate -- optimize
```

Expected output looks like:

```
[calibration] optimize: ρ=0.812  MAE=2.14  (n=30)
```

If ρ < 0.7, choose **one** lever:

1. **Revise the rubric markdown** (most common — sharpen dimension definitions or examples).
2. **Re-score outlier entries** if your human scores were inconsistent.

Re-run after each change. Do not "pass" calibration by lowering the bar.

- [ ] **Step 11.8: Type check**

```bash
npx tsc --noEmit
```

- [ ] **Step 11.9: Commit**

```bash
git add scripts/quality-judge/calibration/optimize.calibration.json scripts/quality-judge/calibration/run-calibration.ts scripts/quality-judge/__tests__/calibration-shape.test.ts scripts/quality-judge/rubrics/optimize.md scripts/quality-judge/__tests__/__snapshots__/rubric-prompt.snapshot.test.ts.snap package.json
git commit -m "feat(quality-judge): Optimize calibration set (30 entries, ρ≥0.7) + run-calibration"
```

Note: if you revised `optimize.md` in step 11.7, you may need to re-bless its snapshot via `npx vitest run rubric-prompt.snapshot -u` before committing.

---

## Task 12: Suggestions rubric + calibration set

Repeat the Task-7 + Task-11 shape, scoped to Suggestions.

**Files:**

- Modify: `scripts/quality-judge/rubrics/suggestions.md` (replace placeholder)
- Create: `scripts/quality-judge/calibration/suggestions.calibration.json`
- Modify: `scripts/quality-judge/__tests__/calibration-shape.test.ts` (mirror checks for suggestions)

- [ ] **Step 12.1: Replace `suggestions.md` with the full rubric**

Overwrite `scripts/quality-judge/rubrics/suggestions.md`:

````markdown
# Suggestions Quality Rubric (v1)

You are evaluating the suggestions returned for a click-to-enhance interaction.

The user highlighted a span (`highlightedText`) within a larger prompt (`fullPrompt`), and the system returned a list of alternative phrases (`suggestions`) of the same semantic category (`highlightedCategory`).

You will be shown:

- `highlightedText` — the exact phrase the user selected
- `fullPrompt` — the surrounding prompt context
- `highlightedCategory` — the span's taxonomy category (subject, camera, lighting, etc.)
- `suggestions` — array of alternative phrases the system returned

## Score each dimension 0–5

### `relevance` (0–5)

Do the suggestions fit semantically into the same slot as the highlighted text inside the full prompt?

- **5:** All suggestions would slot in coherently; none would break the prompt.
- **3:** A few suggestions feel off-context but most fit.
- **1:** Most suggestions would break the prompt's grammar or sense.
- **0:** None of the suggestions belong in this slot.

### `diversity` (0–5)

Do the suggestions span a meaningful range of alternatives, or are they near-paraphrases of one another?

- **5:** Each suggestion is genuinely distinct — different specificity, mood, or angle.
- **3:** Two or three meaningfully distinct, the rest are paraphrases.
- **1:** Most suggestions are paraphrases of one base idea.
- **0:** All suggestions are trivially identical.

### `categoryFidelity` (0–5)

Do the suggestions belong to the taxonomy category indicated by `highlightedCategory`?

- **5:** All suggestions are clearly the same category.
- **3:** One suggestion drifts into a sibling category.
- **1:** Multiple suggestions are off-category.
- **0:** Most suggestions are off-category — the system misclassified the slot.

### `plausibility` (0–5)

Are the suggestions cinematographically real (terms a working director would say), or are they hallucinated jargon?

- **5:** All suggestions are recognizable, accurate terms.
- **3:** One or two suggestions sound fake or invented.
- **1:** Multiple suggestions are hallucinated.
- **0:** Mostly word salad.

### `qualityRange` (0–5)

The list should include some safe options and at least one bolder choice the user might not have considered.

- **5:** Mix of safe + bold; useful both for cautious users and experimentation.
- **3:** Mostly one tier — all safe or all daring.
- **1:** No interesting variation; would feel boring to scroll.
- **0:** Single tone repeated.

## Output format

Return **JSON only**:

```json
{
  "dimensions": {
    "relevance": 0,
    "diversity": 0,
    "categoryFidelity": 0,
    "plausibility": 0,
    "qualityRange": 0
  },
  "reasoning": "1-3 sentences."
}
```

The content to evaluate follows below the fence.
````

- [ ] **Step 12.2: Extend `calibration-shape.test.ts` to assert the Suggestions set**

Append to `scripts/quality-judge/__tests__/calibration-shape.test.ts`:

```typescript
import { SUGGESTIONS_DIMENSION_KEYS } from "../judge-event-types.js";

const suggestionsPath = join(
  __dirname,
  "..",
  "calibration",
  "suggestions.calibration.json",
);

describe("suggestions calibration set", () => {
  const entries = JSON.parse(readFileSync(suggestionsPath, "utf8")) as Array<{
    scoredEvent: string;
    inputContent: Record<string, unknown>;
    outputContent: Record<string, unknown>;
    humanScore: number;
    humanDimensions: Record<string, number>;
  }>;

  it("contains at least 30 entries", () => {
    expect(entries.length).toBeGreaterThanOrEqual(30);
  });

  it("every entry uses scoredEvent = 'suggestions.completed'", () => {
    for (const e of entries) {
      expect(e.scoredEvent).toBe("suggestions.completed");
    }
  });

  it("every entry has all 5 suggestions dimensions in 0–5", () => {
    for (const e of entries) {
      for (const k of SUGGESTIONS_DIMENSION_KEYS) {
        expect(e.humanDimensions[k]).toBeTypeOf("number");
        expect(e.humanDimensions[k]).toBeGreaterThanOrEqual(0);
        expect(e.humanDimensions[k]).toBeLessThanOrEqual(5);
      }
    }
  });

  it("humanScore equals the sum of dimensions", () => {
    for (const e of entries) {
      const sum = Object.values(e.humanDimensions).reduce((a, b) => a + b, 0);
      expect(e.humanScore).toBe(sum);
    }
  });

  it("covers the full quality range (min ≤ 10, max ≥ 18)", () => {
    const scores = entries.map((e) => e.humanScore);
    expect(Math.min(...scores)).toBeLessThanOrEqual(10);
    expect(Math.max(...scores)).toBeGreaterThanOrEqual(18);
  });

  it("inputContent includes the suggestions input keys", () => {
    for (const e of entries) {
      expect(e.inputContent).toHaveProperty("highlightedText");
      expect(e.inputContent).toHaveProperty("fullPrompt");
      expect(e.inputContent).toHaveProperty("highlightedCategory");
    }
  });

  it("outputContent includes a non-empty suggestions array", () => {
    for (const e of entries) {
      expect(Array.isArray(e.outputContent.suggestions)).toBe(true);
      expect((e.outputContent.suggestions as unknown[]).length).toBeGreaterThan(
        0,
      );
    }
  });
});
```

- [ ] **Step 12.3: Author 30 Suggestions calibration entries**

Create `scripts/quality-judge/calibration/suggestions.calibration.json` following the same authoring guidance as Task 11 step 3, scoped to suggestions surface. Schema per entry:

```json
{
  "scoredEvent": "suggestions.completed",
  "inputContent": {
    "highlightedText": "...",
    "fullPrompt": "...",
    "highlightedCategory": "subject"
  },
  "outputContent": {
    "suggestions": ["...", "...", "..."]
  },
  "humanScore": 17,
  "humanDimensions": {
    "relevance": 4,
    "diversity": 3,
    "categoryFidelity": 4,
    "plausibility": 3,
    "qualityRange": 3
  },
  "humanNotes": "...",
  "authoredAt": "2026-05-12",
  "authoredBy": "<your name>"
}
```

- [ ] **Step 12.4: Run the shape tests**

```bash
npx vitest run scripts/quality-judge/__tests__/calibration-shape.test.ts
```

Expected: PASS for both `optimize` and `suggestions` sets.

- [ ] **Step 12.5: Run calibration for suggestions and iterate until ρ ≥ 0.7**

```bash
OPENAI_API_KEY=sk-... npm run judge:calibrate -- suggestions
```

Iterate rubric + scores as in Task 11.

- [ ] **Step 12.6: Update the rubric snapshot**

```bash
npx vitest run scripts/quality-judge/__tests__/rubric-prompt.snapshot.test.ts -u
```

- [ ] **Step 12.7: Commit**

```bash
git add scripts/quality-judge/rubrics/suggestions.md scripts/quality-judge/calibration/suggestions.calibration.json scripts/quality-judge/__tests__/calibration-shape.test.ts scripts/quality-judge/__tests__/__snapshots__/rubric-prompt.snapshot.test.ts.snap
git commit -m "feat(quality-judge): Suggestions rubric v1 + calibration set (ρ≥0.7)"
```

---

## Task 13: Span Labeling rubric + calibration set

Same shape, scoped to Span Labeling.

**Files:**

- Modify: `scripts/quality-judge/rubrics/span-labeling.md`
- Create: `scripts/quality-judge/calibration/span-labeling.calibration.json`
- Modify: `scripts/quality-judge/__tests__/calibration-shape.test.ts`

- [ ] **Step 13.1: Replace `span-labeling.md` with the full rubric**

Overwrite `scripts/quality-judge/rubrics/span-labeling.md`:

````markdown
# Span Labeling Quality Rubric (v1)

You are evaluating a span-labeling pass on a video prompt. The system was asked to identify and categorize meaningful phrases (`spans`) inside `inputText`, where each span has a `text` and a `category` (e.g., `shot`, `subject`, `camera`, `lighting`, `mood`).

You will be shown:

- `inputText` — the raw prompt
- `spans` — array of `{ text, category }` the system returned

## Score each dimension 0–5

### `coverage` (0–5)

Did the system identify all the meaningful phrases that should be labeled?

- **5:** All meaningful spans labeled; nothing important missing.
- **3:** Most labeled; one or two important spans missed.
- **1:** Many important spans missed.
- **0:** Most of the prompt's meaningful content is unlabeled.

### `precision` (0–5)

Are the labeled spans actually labelable phrases — or did the system over-label trivial words?

- **5:** Every labeled span is a real, meaningful phrase.
- **3:** A handful of trivial/empty spans labeled.
- **1:** Many noise spans (function words, fillers).
- **0:** Output is dominated by noise spans.

### `categoryAccuracy` (0–5)

Did the system put each span into the correct taxonomy category?

- **5:** Every span's category is correct.
- **3:** A few categories wrong but most right.
- **1:** Many miscategorizations.
- **0:** Categories are essentially random.

### `granularity` (0–5)

Are span boundaries at the right level — neither too narrow (single words when a phrase exists) nor too wide (entire clause as one span)?

- **5:** Boundaries align with how a working editor would chunk the prompt.
- **3:** A handful of over- or under-segmented spans.
- **1:** Most spans are at the wrong granularity.
- **0:** Granularity is unusable.

### `boundaryCleanness` (0–5)

Do spans start and end at clean word boundaries, or do they leak punctuation, articles, or partial words?

- **5:** All boundaries are clean word-bounds.
- **3:** A few stray articles or trailing punctuation.
- **1:** Many spans have leaky boundaries.
- **0:** Boundaries are essentially arbitrary.

## Output format

Return **JSON only**:

```json
{
  "dimensions": {
    "coverage": 0,
    "precision": 0,
    "categoryAccuracy": 0,
    "granularity": 0,
    "boundaryCleanness": 0
  },
  "reasoning": "1-3 sentences."
}
```

The content to evaluate follows below the fence.
````

- [ ] **Step 13.2: Extend `calibration-shape.test.ts`**

Append to `scripts/quality-judge/__tests__/calibration-shape.test.ts`:

```typescript
import { SPAN_LABELING_DIMENSION_KEYS } from "../judge-event-types.js";

const spanLabelingPath = join(
  __dirname,
  "..",
  "calibration",
  "span-labeling.calibration.json",
);

describe("span-labeling calibration set", () => {
  const entries = JSON.parse(readFileSync(spanLabelingPath, "utf8")) as Array<{
    scoredEvent: string;
    inputContent: Record<string, unknown>;
    outputContent: Record<string, unknown>;
    humanScore: number;
    humanDimensions: Record<string, number>;
  }>;

  it("contains at least 30 entries", () => {
    expect(entries.length).toBeGreaterThanOrEqual(30);
  });

  it("every entry uses scoredEvent = 'label-spans.completed'", () => {
    for (const e of entries) {
      expect(e.scoredEvent).toBe("label-spans.completed");
    }
  });

  it("every entry has all 5 span-labeling dimensions in 0–5", () => {
    for (const e of entries) {
      for (const k of SPAN_LABELING_DIMENSION_KEYS) {
        expect(e.humanDimensions[k]).toBeTypeOf("number");
        expect(e.humanDimensions[k]).toBeGreaterThanOrEqual(0);
        expect(e.humanDimensions[k]).toBeLessThanOrEqual(5);
      }
    }
  });

  it("humanScore equals the sum of dimensions", () => {
    for (const e of entries) {
      const sum = Object.values(e.humanDimensions).reduce((a, b) => a + b, 0);
      expect(e.humanScore).toBe(sum);
    }
  });

  it("covers the full quality range (min ≤ 10, max ≥ 18)", () => {
    const scores = entries.map((e) => e.humanScore);
    expect(Math.min(...scores)).toBeLessThanOrEqual(10);
    expect(Math.max(...scores)).toBeGreaterThanOrEqual(18);
  });

  it("inputContent includes inputText", () => {
    for (const e of entries) {
      expect(e.inputContent).toHaveProperty("inputText");
    }
  });

  it("outputContent includes a non-empty spans array", () => {
    for (const e of entries) {
      expect(Array.isArray(e.outputContent.spans)).toBe(true);
      expect((e.outputContent.spans as unknown[]).length).toBeGreaterThan(0);
    }
  });
});
```

- [ ] **Step 13.3: Author 30 Span Labeling calibration entries**

Create `scripts/quality-judge/calibration/span-labeling.calibration.json`. Same authoring guidance as Tasks 11/12. Each entry:

```json
{
  "scoredEvent": "label-spans.completed",
  "inputContent": { "inputText": "..." },
  "outputContent": {
    "spans": [
      { "text": "...", "category": "shot" },
      { "text": "...", "category": "subject" }
    ]
  },
  "humanScore": 17,
  "humanDimensions": {
    "coverage": 4,
    "precision": 3,
    "categoryAccuracy": 4,
    "granularity": 3,
    "boundaryCleanness": 3
  },
  "humanNotes": "...",
  "authoredAt": "2026-05-12",
  "authoredBy": "<your name>"
}
```

- [ ] **Step 13.4: Run all calibration-shape tests**

```bash
npx vitest run scripts/quality-judge/__tests__/calibration-shape.test.ts
```

- [ ] **Step 13.5: Calibrate**

```bash
OPENAI_API_KEY=sk-... npm run judge:calibrate -- span-labeling
```

Iterate to ρ ≥ 0.7.

- [ ] **Step 13.6: Update rubric snapshot**

```bash
npx vitest run scripts/quality-judge/__tests__/rubric-prompt.snapshot.test.ts -u
```

- [ ] **Step 13.7: Final all-three calibration run**

```bash
OPENAI_API_KEY=sk-... npm run judge:calibrate
```

Expected:

```
[calibration] optimize: ρ=0.8xx  MAE=...
[calibration] suggestions: ρ=0.7xx  MAE=...
[calibration] span-labeling: ρ=0.7xx  MAE=...
```

All three at ρ ≥ 0.7. Exit code 0.

- [ ] **Step 13.8: Commit**

```bash
git add scripts/quality-judge/rubrics/span-labeling.md scripts/quality-judge/calibration/span-labeling.calibration.json scripts/quality-judge/__tests__/calibration-shape.test.ts scripts/quality-judge/__tests__/__snapshots__/rubric-prompt.snapshot.test.ts.snap
git commit -m "feat(quality-judge): Span Labeling rubric v1 + calibration set (ρ≥0.7)"
```

---

## Task 14: GitHub Actions workflows

**Files:**

- Create: `.github/workflows/quality-judge.yml` (nightly + workflow_dispatch)
- Create: `.github/workflows/quality-judge-calibration.yml` (PR gate)

- [ ] **Step 14.1: Create the nightly run workflow**

Create `.github/workflows/quality-judge.yml`:

```yaml
name: Quality Judge (LLM scoring of live events)

# Pulls recent optimize.completed / suggestions.completed / label-spans.completed
# events from PostHog, scores each with GPT-4o-2024-08-06 against its rubric, and
# emits one quality.scored event per scored source event. See
# docs/superpowers/specs/2026-05-12-llm-judge-framework-design.md.

on:
  schedule:
    - cron: "0 8 * * *" # 08:00 UTC daily (one hour after span-labeling-eval)
  workflow_dispatch:
    inputs:
      surface:
        description: "Which surface to judge (empty = all)"
        required: false
        default: ""
        type: choice
        options:
          - ""
          - optimize
          - suggestions
          - span-labeling
      hoursBack:
        description: "Lookback window in hours"
        required: false
        default: "24"

jobs:
  judge:
    runs-on: ubuntu-latest
    timeout-minutes: 20
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "npm"

      - name: Install dependencies
        run: npm ci

      - name: Run judge
        env:
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
          POSTHOG_API_KEY: ${{ secrets.POSTHOG_API_KEY }}
          POSTHOG_PERSONAL_API_KEY: ${{ secrets.POSTHOG_PERSONAL_API_KEY }}
          POSTHOG_PROJECT_ID: ${{ secrets.POSTHOG_PROJECT_ID }}
          POSTHOG_HOST: ${{ secrets.POSTHOG_HOST }}
          QUALITY_JUDGE_HOURS_BACK: ${{ github.event.inputs.hoursBack || '24' }}
          # synth + dogfood always 100% (encoded in HogQL); user at 10% per spec § 1.
          QUALITY_JUDGE_USER_SAMPLE_RATE: "0.1"
          SURFACE: ${{ github.event.inputs.surface }}
          NODE_ENV: test
        run: |
          if [ -n "$SURFACE" ]; then
            npm run judge:run -- --surface "$SURFACE"
          else
            npm run judge:run
          fi
```

- [ ] **Step 14.2: Create the PR calibration gate workflow**

Create `.github/workflows/quality-judge-calibration.yml`:

```yaml
name: Quality Judge — Calibration Gate

# Required to pass before merging any PR that touches a rubric or calibration set.
# Runs each rubric's calibration; fails the PR if ρ < 0.7 for any surface.

on:
  pull_request:
    paths:
      - "scripts/quality-judge/rubrics/**"
      - "scripts/quality-judge/calibration/**"
      - "scripts/quality-judge/judge-client.ts"
      - "scripts/quality-judge/correlation.ts"

jobs:
  calibrate:
    runs-on: ubuntu-latest
    timeout-minutes: 20
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "npm"

      - name: Install dependencies
        run: npm ci

      - name: Run calibration (all surfaces)
        env:
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
          NODE_ENV: test
        run: npm run judge:calibrate
```

- [ ] **Step 14.3: Commit**

```bash
git add .github/workflows/quality-judge.yml .github/workflows/quality-judge-calibration.yml
git commit -m "ci(quality-judge): nightly judge run + PR calibration gate"
```

GitHub will surface YAML parse errors on the next push; no local pre-validation needed.

- [ ] **Step 14.4: Manual verification on PR**

Open a PR with the work landed so far. Confirm:

- The `quality-judge-calibration.yml` job runs and passes against the current calibration sets.
- The nightly `quality-judge.yml` workflow does NOT run on this PR (no path trigger, scheduled only).

If the calibration workflow fails to find `OPENAI_API_KEY` in CI, add the secret to the repo before merging.

---

## Task 15: Dashboard tiles (PostHog MCP, no code)

This task is **configuration work via PostHog MCP**, not code. Three new tiles per dashboard, sourced from `quality.scored`.

**Target dashboards** (from the spec § 10 success criteria):

- T2V Optimize Health — dashboard `1565688`
- Suggestions Health — dashboard `1571039`
- Span Labeling Health — dashboard `1571040`

`★ Insight ─────────────────────────────────────`
Don't try to author tiles before the first nightly run lands real `quality.scored` events. PostHog tile authoring against an event with zero data shows empty charts that look broken — the tile creator might wire a wrong dimension key (e.g., `properties.dimensions.fidelity` vs `properties.dimensions->>'fidelity'`) and never notice. Wait for the first nightly run, then build tiles against real data.
`─────────────────────────────────────────────────`

- [ ] **Step 15.1: Wait for first nightly judge run to produce events**

After the workflow from Task 14 runs once, confirm in PostHog that at least one `quality.scored` event exists per surface:

```sql
SELECT surface, count() FROM events WHERE event = 'quality.scored' GROUP BY surface
```

- [ ] **Step 15.2: Author the 3 tiles per dashboard**

For each of the three dashboards, add via PostHog MCP (`mcp__posthog__insight-create` + `dashboard-update` or equivalent):

**Tile A — Quality score trend (line chart):**

- Insight type: TrendsQuery
- Event: `quality.scored`
- Filter: `surface = '<surface-name>'`
- Series: one per dimension key (5 series) — `avg(toFloat(properties.dimensions.<key>))`
- Display: linear daily breakdown, last 30 days

**Tile B — Lowest-scoring recent examples (HogQL table):**

```sql
SELECT
  q.timestamp,
  q.properties.scoredEventId,
  q.properties.totalScore,
  q.properties.reasoning,
  s.properties.inputPrompt,     -- (or inputText / highlightedText per surface)
  s.properties.outputPrompt     -- (or spans / suggestions per surface)
FROM events q
JOIN events s ON s.uuid = q.properties.scoredEventId
WHERE q.event = 'quality.scored'
  AND q.properties.surface = '<surface-name>'
  AND q.timestamp > now() - INTERVAL 7 DAY
ORDER BY toInt(q.properties.totalScore) ASC
LIMIT 20
```

**Tile C — Quality vs cost scatter:**

- Insight type: HogQLQuery, scatter chart
- X: `properties.judgeCostUsd`
- Y: `properties.totalScore`
- Filter: `surface = '<surface-name>'`, last 30 days

Repeat for all three surfaces (9 tiles total).

- [ ] **Step 15.3: Record tile IDs**

Note each created tile ID for documentation in Task 17.

---

## Task 16: Alerts (PostHog MCP, no code)

Four alerts per spec § 6. PostHog Alerts only support TrendsQuery insights (see #0 prior art).

- [ ] **Step 16.1: Wire the four alerts**

Create via PostHog MCP (`mcp__posthog__alert-create`):

| Alert                      | Insight Query                                                                                                                                                                        | Threshold      | Severity |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------- | -------- |
| Surface quality regression | TrendsQuery: avg(totalScore) by `surface`, daily, 7-day rolling window                                                                                                               | Δ ≥ 3 vs prev. | warn     |
| Judge cost spike           | TrendsQuery: sum(judgeCostUsd), daily                                                                                                                                                | > $5 / 24h     | warn     |
| Judge silent               | TrendsQuery: count(quality.scored), daily                                                                                                                                            | == 0 / 24h     | critical |
| Calibration drift          | Manual — re-run `npm run judge:calibrate` weekly and alert via PagerDuty/Slack if any surface drops below ρ=0.6. Out of scope for the PostHog MCP path; left as an ops runbook task. | n/a            | critical |

For Calibration drift specifically: add a paragraph to `docs/architecture/observability.md` instructing the operator to run `npm run judge:calibrate` weekly and what to do if it fails. The other three alerts go through PostHog.

- [ ] **Step 16.2: Force-test the "judge silent" alert**

Per spec § 10 success criteria: at least one alert must be exercised. Temporarily disable the nightly schedule (comment out the cron in `quality-judge.yml`) for one day, confirm the "Judge silent" alert fires, then re-enable. **Do this only after the alert has had 48 hours to baseline.**

---

## Task 17: Update `observability.md`

**Files:**

- Modify: `docs/architecture/observability.md`

- [ ] **Step 17.1: Add the `quality.scored` section**

Following the existing structure for other event docs (`eval.completed`, `optimize.completed`), add a new section after the "Eval telemetry" block:

````markdown
## Quality telemetry (`quality.scored`)

An LLM judge (GPT-4o-2024-08-06) runs nightly via [`scripts/quality-judge/run-judge.ts`](../../scripts/quality-judge/run-judge.ts). For each recent `optimize.completed` / `suggestions.completed` / `label-spans.completed` event with `source IN ('synthetic','dogfood','user')`, it loads the surface's markdown rubric, scores 5 dimensions 0–5, and emits one `quality.scored` event linked back to the source via `scoredEventId`.

Pre-launch (per the [Measurement Program](../superpowers/programs/measurement.md)) this is the primary quality signal: with zero real users, we judge the output ourselves.

### Event schema

[`scripts/quality-judge/judge-event-types.ts`](../../scripts/quality-judge/judge-event-types.ts) is the source of truth. Locked by [`judge-event-schema.snapshot.test.ts`](../../scripts/quality-judge/__tests__/judge-event-schema.snapshot.test.ts).

| Property          | Meaning                                                                                                        |
| ----------------- | -------------------------------------------------------------------------------------------------------------- |
| `scoredEvent`     | The source event name (`optimize.completed`, `suggestions.completed`, `label-spans.completed`)                 |
| `scoredEventId`   | PostHog `uuid` of the source event — join key                                                                  |
| `surface`         | `optimize` / `suggestions` / `span-labeling`                                                                   |
| `rubricVersion`   | 8-char sha256 prefix of the rubric markdown content; bumps on rubric change                                    |
| `judgeModel`      | `gpt-4o-2024-08-06`                                                                                            |
| `judgeDurationMs` | Wall-clock judge latency                                                                                       |
| `judgeCostUsd`    | OpenAI cost from `tokensIn × $/1K + tokensOut × $/1K` ([`pricing.ts`](../../scripts/quality-judge/pricing.ts)) |
| `totalScore`      | Sum of 5 dimensions, 0–25                                                                                      |
| `dimensions`      | Per-surface keyed object, each value 0–5 integer                                                               |
| `reasoning`       | Verbatim LLM judge explanation                                                                                 |
| `source`          | Carried from the source event                                                                                  |

### Dashboard tiles

| Dashboard            | Tile A (trend) | Tile B (low scorers) | Tile C (quality vs cost) |
| -------------------- | -------------- | -------------------- | ------------------------ |
| T2V Optimize Health  | `<tile-id-A1>` | `<tile-id-B1>`       | `<tile-id-C1>`           |
| Suggestions Health   | `<tile-id-A2>` | `<tile-id-B2>`       | `<tile-id-C2>`           |
| Span Labeling Health | `<tile-id-A3>` | `<tile-id-B3>`       | `<tile-id-C3>`           |

### Calibration

The judge is gated by hand-scored calibration sets ([`scripts/quality-judge/calibration/<surface>.calibration.json`](../../scripts/quality-judge/calibration/)) — Spearman ρ ≥ 0.7 against human scores. Re-run weekly:

```bash
OPENAI_API_KEY=sk-... npm run judge:calibrate
```
````

Any PR touching `scripts/quality-judge/rubrics/**` or `**/calibration/**` runs this in CI (`quality-judge-calibration.yml`) and cannot merge below the threshold. If a weekly local run drops below ρ=0.6 for a surface, re-author calibration entries or revise the rubric.

### How to query

Per-surface 7-day average score trend:

```sql
SELECT
  surface,
  toDate(timestamp) AS day,
  avg(toFloat(properties.totalScore)) AS avg_score
FROM events
WHERE event = 'quality.scored'
  AND timestamp > now() - INTERVAL 7 DAY
GROUP BY surface, day
ORDER BY day ASC
```

Worst-scoring optimize outputs in the last 24h, joined back to source content:

```sql
SELECT
  q.properties.totalScore,
  q.properties.reasoning,
  s.properties.inputPrompt,
  s.properties.outputPrompt
FROM events q
JOIN events s ON s.uuid = q.properties.scoredEventId
WHERE q.event = 'quality.scored'
  AND q.properties.surface = 'optimize'
  AND q.timestamp > now() - INTERVAL 24 HOUR
ORDER BY toInt(q.properties.totalScore) ASC
LIMIT 10
```

````

Replace `<tile-id-...>` placeholders with the actual tile IDs recorded in Task 15.

- [ ] **Step 17.2: Update the "Content fields" table**

In the existing "Content fields (quality review, not just counts)" section, add a row:

```markdown
| `quality.scored`        | `reasoning`, `dimensions`, `totalScore`, `scoredEventId` (joins to source) | LLM judge output linked back to the source event so dashboards can sort by quality. |
````

- [ ] **Step 17.3: Verify doc builds (markdown lint, if any)**

```bash
# No formal docs build, but verify links are valid in the rendered output if a Markdown previewer is available.
grep -n "tile-id" docs/architecture/observability.md
```

There should be no remaining `<tile-id-...>` placeholders.

- [ ] **Step 17.4: Commit**

```bash
git add docs/architecture/observability.md
git commit -m "docs(observability): document quality.scored event + tiles + calibration"
```

---

## Final verification

After all tasks complete, run the full validation sequence from CLAUDE.md "Validation Order Before Handoff":

- [ ] **Step F.1: Type check**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step F.2: Lint**

```bash
npm run lint:all
```

Expected: 0 errors.

- [ ] **Step F.3: Unit tests**

```bash
npm run test:unit
```

Expected: PASS. The new `scripts/quality-judge/__tests__/` files should all show in the run; eval tests unchanged.

- [ ] **Step F.4: Calibration**

```bash
OPENAI_API_KEY=sk-... npm run judge:calibrate
```

Expected: all three surfaces ρ ≥ 0.7, exit code 0.

- [ ] **Step F.5: One-off live judge run**

Verify against real PostHog data:

```bash
OPENAI_API_KEY=sk-... POSTHOG_PERSONAL_API_KEY=phx_... POSTHOG_PROJECT_ID=... npm run judge:run -- --surface optimize
```

Confirm:

- Stdout shows events being scored.
- A new `quality.scored` event appears in PostHog within ~1 minute.

- [ ] **Step F.6: Confirm spec success criteria**

Walk through spec § 10 line-by-line:

- [ ] Three rubric markdowns exist; each scores ρ ≥ 0.7 on its calibration set.
- [ ] `run-judge.ts` runs against PostHog and emits `quality.scored` events linked back via `scoredEventId`.
- [ ] All three Health dashboards have the 3 quality tiles.
- [ ] Four alerts wired; "judge silent" exercised in a forced-regression test.
- [ ] After the first nightly run, every `*.completed` event with `source IN ('synthetic','dogfood')` in the last 24h has a matching `quality.scored` event.
- [ ] Judge cost over 7 days < $5.
- [ ] `docs/architecture/observability.md` documents the event + tile IDs.

If any item is unmet, file a follow-up task in the spec rather than retro-fitting the plan.

---

## Roll-back plan

If a regression is found post-merge:

1. **Stop the runner only**: disable the `quality-judge.yml` cron schedule. The framework stops emitting; nothing else changes. No user-facing impact since this is read-only telemetry.
2. **Roll back a bad rubric**: revert the offending `scripts/quality-judge/rubrics/*.md` commit. The CI calibration gate will block any re-merge below ρ=0.7. Old `quality.scored` events stay in PostHog under their `rubricVersion`, so the regression is visible side-by-side with the previous version.
3. **Generalized emitter regression**: revert the Task 3 commit. The eval call-sites compile-fail at the wrap, which is the signal — re-running `tsc --noEmit` after revert is the diagnostic.

The framework's pull-based design means no rollback for `quality.scored` is needed at the source-event side — those events were unaffected. Only the judge layer is reversible.
