# Eval Visibility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Spec:** [`docs/superpowers/specs/2026-05-10-eval-visibility-design.md`](../specs/2026-05-10-eval-visibility-design.md)
**Program:** Part of the [Measurement Program](../programs/measurement.md) — sub-project #0

**Goal:** Pipe three existing eval scripts into PostHog as `eval.completed` events, build the "Eval Health" dashboard, wire regression alerts.

**Architecture:** Each eval script constructs an `IEvalEmitter` instance, runs its existing logic inside a `try/finally`, and emits one `eval.completed` event in the `finally` block (success, regression, or setup error). The emitter wraps `posthog-node` with a no-op stub when `POSTHOG_API_KEY` is unset. Schema is locked by per-`evalType` snapshot tests. The existing nightly workflow inherits emission via one env-var addition. Dashboard and alerts are wired post-deploy via PostHog MCP.

**Tech Stack:** TypeScript, vitest, tsx, posthog-node (already a project dep from T2V telemetry), GitHub Actions, PostHog MCP.

---

## File Structure

**New:**

- `scripts/evaluation/eval-event-types.ts` — discriminated-union types for `eval.completed`
- `scripts/evaluation/posthog-emitter.ts` — `IEvalEmitter` interface, real + no-op implementations, `resolveDistinctId()` helper
- `scripts/evaluation/__tests__/posthog-emitter.test.ts` — emitter behavior + distinctId resolution
- `scripts/evaluation/__tests__/eval-event-schema.snapshot.test.ts` — schema snapshots, one per `evalType`

**Modified:**

- `scripts/evaluation/golden-set-relaxed-f1.ts` — emit in `main()`
- `scripts/evaluation/span-labeling-evaluation.ts` — emit in `main()`
- `scripts/evaluation/recommendation-eval.ts` — emit in `main()`
- `.github/workflows/span-labeling-eval.yml` — add `POSTHOG_API_KEY` env to 3 jobs
- `docs/architecture/observability.md` — add `eval.completed` section

**No change:** `server/package.json` already includes `posthog-node` (shipped with T2V telemetry); reused.

---

## Tasks

### Task 0: Verify test discovery for `scripts/evaluation/__tests__/`

The eval scripts live outside `server/`; the vitest config may not include them in the default test glob. Confirm before writing real tests so we don't burn time on a missing-tests-not-failing situation.

**Files:**

- Create temporarily: `scripts/evaluation/__tests__/discovery.test.ts`

- [ ] **Step 1: Write a trivial discovery test**

```typescript
// scripts/evaluation/__tests__/discovery.test.ts
import { describe, it, expect } from "vitest";

describe("test discovery", () => {
  it("runs", () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 2: Run unit tests filtered to this path**

```bash
npm run test:unit -- scripts/evaluation
```

Expected: 1 test PASS, OR "No test files found" if the glob excludes `scripts/`.

- [ ] **Step 3: If "No test files found", adjust the test config**

Open the unit test config (`config/test/vitest.unit.config.js` or similar; search via `find config -name 'vitest*'`). Add `"scripts/**/__tests__/**/*.test.ts"` to the `test.include` array if missing. Re-run step 2 to verify.

- [ ] **Step 4: Delete the discovery test**

```bash
rm scripts/evaluation/__tests__/discovery.test.ts
```

(Keep the directory; later tasks add real tests here.)

- [ ] **Step 5: Do not commit**

This task is a verification gate. Any config change rides along with Task 2's commit.

---

### Task 1: Event types

Define the discriminated-union types everything downstream uses.

**Files:**

- Create: `scripts/evaluation/eval-event-types.ts`

- [ ] **Step 1: Create the types file**

```typescript
// scripts/evaluation/eval-event-types.ts

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
```

- [ ] **Step 2: Verify types compile**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Do not commit yet — types ship with the emitter in Task 2.**

---

### Task 2: PostHog emitter (TDD)

The shared helper all three eval scripts use.

**Files:**

- Create: `scripts/evaluation/posthog-emitter.ts`
- Test: `scripts/evaluation/__tests__/posthog-emitter.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// scripts/evaluation/__tests__/posthog-emitter.test.ts
import { describe, it, expect, afterEach } from "vitest";
import { createEvalEmitter, resolveDistinctId } from "../posthog-emitter.js";

describe("createEvalEmitter", () => {
  const originalKey = process.env.POSTHOG_API_KEY;
  afterEach(() => {
    if (originalKey === undefined) {
      delete process.env.POSTHOG_API_KEY;
    } else {
      process.env.POSTHOG_API_KEY = originalKey;
    }
  });

  it("returns a no-op stub when POSTHOG_API_KEY is unset", async () => {
    delete process.env.POSTHOG_API_KEY;
    const emitter = createEvalEmitter();
    expect(() =>
      emitter.emit({
        distinctId: "test",
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
      }),
    ).not.toThrow();
    await emitter.shutdown();
  });

  it("returns a no-op stub when POSTHOG_API_KEY is empty whitespace", async () => {
    process.env.POSTHOG_API_KEY = "   ";
    const emitter = createEvalEmitter();
    await expect(emitter.shutdown()).resolves.not.toThrow();
  });
});

describe("resolveDistinctId", () => {
  const originalRunId = process.env.GITHUB_RUN_ID;
  afterEach(() => {
    if (originalRunId === undefined) {
      delete process.env.GITHUB_RUN_ID;
    } else {
      process.env.GITHUB_RUN_ID = originalRunId;
    }
  });

  it("returns ci-<runId> when GITHUB_RUN_ID is set", () => {
    process.env.GITHUB_RUN_ID = "12345";
    expect(resolveDistinctId()).toBe("ci-12345");
  });

  it("returns local-<username> when GITHUB_RUN_ID is unset", () => {
    delete process.env.GITHUB_RUN_ID;
    expect(resolveDistinctId()).toMatch(/^local-/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm run test:unit -- scripts/evaluation/__tests__/posthog-emitter
```

Expected: FAIL with "Cannot find module '../posthog-emitter.js'".

- [ ] **Step 3: Implement the emitter**

```typescript
// scripts/evaluation/posthog-emitter.ts
import { PostHog } from "posthog-node";
import { randomUUID } from "node:crypto";
import { userInfo } from "node:os";

import type { EvalCompletedProperties } from "./eval-event-types.js";

export interface EmitArgs extends EvalCompletedProperties {
  distinctId: string;
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
      flushAt: 1, // evals are low-volume; flush eagerly
      flushInterval: 1000,
    });
  }

  emit(args: EmitArgs): void {
    try {
      const { distinctId, ...properties } = args;
      this.client.capture({
        distinctId,
        event: "eval.completed",
        properties,
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

- [ ] **Step 4: Run tests to verify pass**

```bash
npm run test:unit -- scripts/evaluation/__tests__/posthog-emitter
```

Expected: 4 tests PASS.

- [ ] **Step 5: Type check**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
git add scripts/evaluation/eval-event-types.ts \
        scripts/evaluation/posthog-emitter.ts \
        scripts/evaluation/__tests__/posthog-emitter.test.ts
# Stage any vitest config change from Task 0, if applicable.
git commit -m "feat(eval-visibility): IEvalEmitter shim + event types"
```

---

### Task 3: Snapshot tests for event schema

Lock the schema for each `evalType` so future drift is visible in PR diffs.

**Files:**

- Test: `scripts/evaluation/__tests__/eval-event-schema.snapshot.test.ts`

- [ ] **Step 1: Write the snapshot test**

```typescript
// scripts/evaluation/__tests__/eval-event-schema.snapshot.test.ts
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
```

- [ ] **Step 2: Run to create the snapshots**

```bash
npm run test:unit -- scripts/evaluation/__tests__/eval-event-schema.snapshot
```

Expected: 3 tests PASS (first run writes the snapshot file).

- [ ] **Step 3: Verify the snapshot file**

```bash
cat scripts/evaluation/__tests__/__snapshots__/eval-event-schema.snapshot.test.ts.snap
```

Expected: three sections, one per `evalType`.

- [ ] **Step 4: Commit**

```bash
git add scripts/evaluation/__tests__/eval-event-schema.snapshot.test.ts \
        scripts/evaluation/__tests__/__snapshots__/
git commit -m "test(eval-visibility): snapshot tests lock eval.completed schemas"
```

---

### Task 4: Integrate emission into `golden-set-relaxed-f1.ts`

Highest priority of the three integrations because the nightly cron will populate the dashboard from this script.

**Files:**

- Modify: `scripts/evaluation/golden-set-relaxed-f1.ts`

- [ ] **Step 1: Read the existing main flow**

```bash
grep -n "async function main\|process.exit\|parseArgs\|gateResult\|compareToBaseline\|EvaluationReport" scripts/evaluation/golden-set-relaxed-f1.ts
```

Expected: identifies entry point, gate result computation, report shape, and exit calls. Note the exact property names on the report object — `overallF1`, `perCategoryF1`, `totalPrompts`, `errorCount` may be named differently in the actual code. Adapt the integration accordingly in step 3.

- [ ] **Step 2: Add imports**

In the imports block near the top of `scripts/evaluation/golden-set-relaxed-f1.ts`:

```typescript
import { createEvalEmitter, resolveDistinctId } from "./posthog-emitter.js";
import type { Outcome, SpanLabelingF1Metrics } from "./eval-event-types.js";
```

- [ ] **Step 3: Wrap `main()` body with try/finally + emission**

Locate `main()` (or the top-level async IIFE). Replace its body with this structure, preserving all existing logic between the comments:

```typescript
async function main(): Promise<void> {
  const opts = parseArgs(process.argv.slice(2));
  const emitter = createEvalEmitter();
  const startedAt = Date.now();
  let outcome: Outcome = "setup_error";
  let metrics: SpanLabelingF1Metrics | undefined;
  let errorMessage: string | undefined;
  let promptCount = 0;
  let errorCount = 0;

  try {
    // <<< EXISTING LOGIC up to the point where `report` and `gateResult` are computed >>>

    promptCount = report.totalPrompts;
    errorCount = report.errorCount;
    metrics = {
      overallF1: report.overallF1,
      overallPrecision: report.overallPrecision,
      overallRecall: report.overallRecall,
      perCategoryF1: report.perCategoryF1,
      baselineCommit: baseline?.commit,
    };
    if (opts.bless) {
      outcome = "passed";
    } else {
      outcome = gateResult.passed ? "passed" : "regression";
      if (!gateResult.passed) {
        errorMessage = gateResult.message ?? "regression detected";
      }
    }

    // <<< EXISTING console output + process.exit(...) calls >>>
  } catch (err) {
    errorMessage = err instanceof Error ? err.message : String(err);
    outcome = "setup_error";
    throw err;
  } finally {
    try {
      emitter.emit({
        distinctId: resolveDistinctId(),
        evalType: "span_labeling_f1",
        outcome,
        errorMessage,
        commit: opts.commit ?? "unknown",
        provider: opts.provider === "auto" ? undefined : opts.provider,
        runId: process.env.GITHUB_RUN_ID,
        durationMs: Date.now() - startedAt,
        promptCount,
        errorCount,
        metrics: metrics ?? {
          overallF1: 0,
          overallPrecision: 0,
          overallRecall: 0,
          perCategoryF1: {},
        },
      });
      await emitter.shutdown();
    } catch {
      // never fail the eval on telemetry hiccup
    }
  }
}
```

If actual property names diverge from `report.overallF1` etc., adapt by adding a small local mapping function. Do not widen types or import server-side types into the script.

- [ ] **Step 4: Type check**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 5: Smoke test — no API key (no-op path)**

```bash
unset POSTHOG_API_KEY
npm run eval:golden-set -- --provider groq
```

Expected: existing behavior unchanged; no PostHog network calls; exit code matches gate result.

- [ ] **Step 6: Smoke test — with API key (real path)**

```bash
export POSTHOG_API_KEY="$(grep '^POSTHOG_API_KEY=' .env | cut -d= -f2)"
npm run eval:golden-set -- --provider groq
```

Then check PostHog project `417445`:

```sql
SELECT timestamp, properties.evalType, properties.outcome, properties.metrics.overallF1
FROM events
WHERE event = 'eval.completed'
  AND timestamp > now() - INTERVAL 5 MINUTE
ORDER BY timestamp DESC
LIMIT 5
```

Expected: 1 row with `evalType = "span_labeling_f1"`, outcome matching the local gate result.

- [ ] **Step 7: Commit**

```bash
git add scripts/evaluation/golden-set-relaxed-f1.ts
git commit -m "feat(eval-visibility): emit eval.completed from golden-set-relaxed-f1"
```

---

### Task 5: Integrate emission into `span-labeling-evaluation.ts`

Same pattern as Task 4. Different `evalType` and metrics shape.

**Files:**

- Modify: `scripts/evaluation/span-labeling-evaluation.ts`

- [ ] **Step 1: Read the existing main flow**

```bash
grep -n "async function main\|process.exit\|snapshot\|judge\|writeSnapshot\|summary" scripts/evaluation/span-labeling-evaluation.ts
```

Expected: identifies entry point, where `snapshot.summary` is built, the judge model id, and exit paths.

- [ ] **Step 2: Add imports**

```typescript
import { createEvalEmitter, resolveDistinctId } from "./posthog-emitter.js";
import type { Outcome, SpanLabelingJudgeMetrics } from "./eval-event-types.js";
```

- [ ] **Step 3: Wrap `main()` body**

Replace `main()`'s body with this structure, preserving existing logic:

```typescript
async function main(): Promise<void> {
  const opts = parseArgs(process.argv.slice(2));
  const emitter = createEvalEmitter();
  const startedAt = Date.now();
  let outcome: Outcome = "setup_error";
  let metrics: SpanLabelingJudgeMetrics | undefined;
  let errorMessage: string | undefined;
  let promptCount = 0;
  let errorCount = 0;

  try {
    // <<< EXISTING LOGIC up to and including snapshot.summary being computed >>>

    promptCount = snapshot.results.length;
    errorCount = snapshot.summary.errorCount;
    metrics = {
      avgScore: snapshot.summary.avgScore,
      maxScore: 25,
      scoreDistribution: snapshot.summary
        .scoreDistribution as SpanLabelingJudgeMetrics["scoreDistribution"],
      avgCategoryScores: snapshot.summary.avgCategoryScores
        ? {
            coverage: snapshot.summary.avgCategoryScores.coverage,
            precision: snapshot.summary.avgCategoryScores.precision,
            granularity: snapshot.summary.avgCategoryScores.granularity,
            taxonomy: snapshot.summary.avgCategoryScores.taxonomy,
            technicalSpecs:
              snapshot.summary.avgCategoryScores.technicalSpecs ?? 0,
          }
        : undefined,
      latencyStats: snapshot.summary.latencyStats,
      judgeModel: snapshot.judgeModel ?? "gpt-4o",
    };
    // Span-labeling-judge has no gate; outcome is "passed" unless errors dominate.
    outcome = errorCount > promptCount * 0.2 ? "setup_error" : "passed";
    if (outcome === "setup_error") {
      errorMessage = `error rate exceeded threshold (${errorCount}/${promptCount})`;
    }

    // <<< EXISTING exit logic >>>
  } catch (err) {
    errorMessage = err instanceof Error ? err.message : String(err);
    outcome = "setup_error";
    throw err;
  } finally {
    try {
      emitter.emit({
        distinctId: resolveDistinctId(),
        evalType: "span_labeling_judge",
        outcome,
        errorMessage,
        commit: process.env.GIT_COMMIT ?? "unknown",
        runId: process.env.GITHUB_RUN_ID,
        sourceFile: opts.promptsFile,
        durationMs: Date.now() - startedAt,
        promptCount,
        errorCount,
        metrics: metrics ?? {
          avgScore: 0,
          maxScore: 25,
          scoreDistribution: {
            excellent: 0,
            good: 0,
            acceptable: 0,
            poor: 0,
            failing: 0,
          },
          judgeModel: "unknown",
        },
      });
      await emitter.shutdown();
    } catch {
      // never fail the eval on telemetry hiccup
    }
  }
}
```

Adapt field names to the actual `snapshot.summary` shape per `scripts/evaluation/types.ts:200-239`. `technicalSpecs` may be named differently — the type definitions are authoritative.

- [ ] **Step 4: Type check**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 5: Smoke test — no API key**

```bash
unset POSTHOG_API_KEY
npx tsx scripts/evaluation/span-labeling-evaluation.ts --sample 5
```

Expected: existing behavior unchanged.

- [ ] **Step 6: Smoke test — real key**

```bash
export POSTHOG_API_KEY="$(grep '^POSTHOG_API_KEY=' .env | cut -d= -f2)"
npx tsx scripts/evaluation/span-labeling-evaluation.ts --sample 5
```

PostHog query:

```sql
SELECT timestamp, properties.evalType, properties.metrics.avgScore
FROM events
WHERE event = 'eval.completed'
  AND properties.evalType = 'span_labeling_judge'
  AND timestamp > now() - INTERVAL 5 MINUTE
LIMIT 5
```

Expected: 1 row with non-null `avgScore`.

- [ ] **Step 7: Commit**

```bash
git add scripts/evaluation/span-labeling-evaluation.ts
git commit -m "feat(eval-visibility): emit eval.completed from span-labeling-evaluation"
```

---

### Task 6: Integrate emission into `recommendation-eval.ts`

Same pattern. Different `evalType`.

**Files:**

- Modify: `scripts/evaluation/recommendation-eval.ts`

- [ ] **Step 1: Read the existing main flow**

```bash
grep -n "async function main\|process.exit\|driftDetected\|gateResult\|compareSnapshot\|newPrompts" scripts/evaluation/recommendation-eval.ts
```

Expected: identifies entry point, drift detection result shape, and new-prompts handling.

- [ ] **Step 2: Add imports**

```typescript
import { createEvalEmitter, resolveDistinctId } from "./posthog-emitter.js";
import type { Outcome, RecommendationMetrics } from "./eval-event-types.js";
```

- [ ] **Step 3: Wrap `main()` body**

```typescript
async function main(): Promise<void> {
  const opts = parseArgs(process.argv.slice(2));
  const emitter = createEvalEmitter();
  const startedAt = Date.now();
  let outcome: Outcome = "setup_error";
  let metrics: RecommendationMetrics | undefined;
  let errorMessage: string | undefined;
  let promptCount = 0;
  let errorCount = 0;

  try {
    // <<< EXISTING LOGIC up to drift detection complete >>>

    promptCount = result.totalPrompts;
    errorCount = result.errorCount ?? 0;
    metrics = {
      driftDetectedCount: result.driftCount,
      totalPrompts: result.totalPrompts,
      newPromptsCount: result.newPromptsCount ?? 0,
      baselineName: opts.baseline ?? "default",
    };
    if (result.driftCount > 0) {
      outcome = "regression";
      errorMessage = `${result.driftCount} prompt(s) drifted from baseline`;
    } else {
      outcome = "passed";
    }

    // <<< EXISTING exit logic >>>
  } catch (err) {
    errorMessage = err instanceof Error ? err.message : String(err);
    outcome = "setup_error";
    throw err;
  } finally {
    try {
      emitter.emit({
        distinctId: resolveDistinctId(),
        evalType: "recommendation",
        outcome,
        errorMessage,
        commit: process.env.GIT_COMMIT ?? "unknown",
        runId: process.env.GITHUB_RUN_ID,
        durationMs: Date.now() - startedAt,
        promptCount,
        errorCount,
        metrics: metrics ?? {
          driftDetectedCount: 0,
          totalPrompts: 0,
          newPromptsCount: 0,
          baselineName: "unknown",
        },
      });
      await emitter.shutdown();
    } catch {
      // never fail the eval on telemetry hiccup
    }
  }
}
```

Adapt to actual result property names.

- [ ] **Step 4: Type check + smoke test (no key)**

```bash
npx tsc --noEmit
unset POSTHOG_API_KEY
npm run eval:recommendation
```

Expected: 0 type errors; existing behavior unchanged.

- [ ] **Step 5: Smoke test (real key)**

```bash
export POSTHOG_API_KEY="$(grep '^POSTHOG_API_KEY=' .env | cut -d= -f2)"
npm run eval:recommendation
```

PostHog query:

```sql
SELECT timestamp, properties.evalType, properties.metrics.driftDetectedCount
FROM events
WHERE event = 'eval.completed' AND properties.evalType = 'recommendation'
  AND timestamp > now() - INTERVAL 5 MINUTE
LIMIT 5
```

Expected: 1 row.

- [ ] **Step 6: Commit**

```bash
git add scripts/evaluation/recommendation-eval.ts
git commit -m "feat(eval-visibility): emit eval.completed from recommendation-eval"
```

---

### Task 7: Add `POSTHOG_API_KEY` to the CI workflow

The nightly workflow has three jobs: `groq-eval`, `weekly-multi-provider`, `workflow-dispatch-openai`. Each needs the env var.

**Files:**

- Modify: `.github/workflows/span-labeling-eval.yml`

- [ ] **Step 1: Add the repo secret out-of-band**

In GitHub Settings → Secrets and variables → Actions, add a secret named `POSTHOG_API_KEY` with the value matching the server's production env (`phc_pmJDnB...`). Confirm via `gh secret list`.

- [ ] **Step 2: Edit the workflow file**

In each of the three `Run golden-set evaluation` steps' `env:` blocks, add this line alongside the existing `GROQ_API_KEY`, `OPENAI_API_KEY`, `NODE_ENV` lines:

```yaml
POSTHOG_API_KEY: ${{ secrets.POSTHOG_API_KEY }}
```

The three locations (line numbers approximate — verify after opening):

- `groq-eval` job, `Run golden-set evaluation (Groq)` step
- `weekly-multi-provider` job, `Run golden-set evaluation (${{ matrix.provider }})` step
- `workflow-dispatch-openai` job, `Run golden-set evaluation (OpenAI)` step

- [ ] **Step 3: Validate YAML**

```bash
npx js-yaml .github/workflows/span-labeling-eval.yml > /dev/null
```

Expected: parses without error.

- [ ] **Step 4: Trigger a workflow_dispatch from your branch**

```bash
git push origin <your-branch>
gh workflow run "Span Labeling Golden-Set Eval" --ref <your-branch> -f provider=groq
gh run watch
```

When complete, verify the run logs show `POSTHOG_API_KEY: ***` (redacted but present) in the env block.

- [ ] **Step 5: Verify event arrival**

```sql
SELECT timestamp, properties.runId, properties.outcome, properties.metrics.overallF1
FROM events
WHERE event = 'eval.completed'
  AND timestamp > now() - INTERVAL 15 MINUTE
ORDER BY timestamp DESC
LIMIT 5
```

Expected: 1 row with `runId` matching the just-completed workflow's run id.

- [ ] **Step 6: Commit**

```bash
git add .github/workflows/span-labeling-eval.yml
git commit -m "ci(eval-visibility): pass POSTHOG_API_KEY to eval jobs"
```

---

### Task 8: Document the event in `observability.md`

Mirror the existing pattern for `optimize.completed`, `suggestions.completed`, `llm.call.completed`.

**Files:**

- Modify: `docs/architecture/observability.md`

- [ ] **Step 1: Locate the end of the Suggestions telemetry section**

```bash
grep -n "## Suggestions telemetry" docs/architecture/observability.md
```

The file currently ends right after that section. Append the new section there.

- [ ] **Step 2: Append the Eval telemetry section**

````markdown
---

## Eval telemetry (`eval.completed`)

**What it answers:** how often does each eval run, what does it produce, when does it regress. One event fires per `scripts/evaluation/*` run (passing, regressing, or setup-error). Three discriminator values today: `span_labeling_judge`, `span_labeling_f1`, `recommendation`.

**Project / dashboard:** Same project as Optimize (`417445`). Dashboard "Eval Health" — id TBD (fill in after Task 10).

### Event schema

Emitted by [`scripts/evaluation/posthog-emitter.ts`](../../scripts/evaluation/posthog-emitter.ts). The schema is locked by snapshot tests at [`scripts/evaluation/__tests__/eval-event-schema.snapshot.test.ts`](../../scripts/evaluation/__tests__/eval-event-schema.snapshot.test.ts) — one snapshot per `evalType`.

Top-level event properties:

- `evalType` — `"span_labeling_judge" | "span_labeling_f1" | "recommendation"` — discriminator
- `outcome` — `"passed" | "regression" | "setup_error"`
- `errorMessage` — present only when `outcome !== "passed"`
- `commit` — Git SHA the eval ran against; `"unknown"` if not provided
- `runId` — present only when run from GitHub Actions (matches `GITHUB_RUN_ID`)
- `provider` — `"groq" | "openai" | null` for span-labeling evals; absent for recommendation
- `sourceFile` — path to prompt fixture (optional)
- `durationMs`, `promptCount`, `errorCount` — wall-clock + counts
- `metrics` — polymorphic by `evalType`:
  - `span_labeling_judge` → `{ avgScore, maxScore: 25, scoreDistribution, avgCategoryScores?, latencyStats?, judgeModel }`
  - `span_labeling_f1` → `{ overallF1, overallPrecision, overallRecall, perCategoryF1, baselineCommit? }`
  - `recommendation` → `{ driftDetectedCount, totalPrompts, newPromptsCount, baselineName }`

`distinctId` convention: `ci-<GITHUB_RUN_ID>` in CI, `local-<username>` locally, `anon-<uuid>` fallback. Use `LIKE 'ci-%'` to filter CI-only runs.

### How to query

Outcome breakdown last 7 days:

```sql
SELECT
  properties.evalType AS evalType,
  properties.outcome AS outcome,
  count() AS n
FROM events
WHERE event = 'eval.completed'
  AND timestamp > now() - INTERVAL 7 DAY
GROUP BY evalType, outcome
ORDER BY evalType, outcome
```

Overall F1 trend by day:

```sql
SELECT
  toStartOfDay(timestamp) AS day,
  avg(properties.metrics.overallF1) AS avg_f1,
  count() AS runs
FROM events
WHERE event = 'eval.completed'
  AND properties.evalType = 'span_labeling_f1'
  AND timestamp > now() - INTERVAL 30 DAY
GROUP BY day
ORDER BY day DESC
```

### Open follow-ups

- **Eval Health dashboard tiles** — built after first nightly run produces data (Task 10).
- **PostHog alerts** — wired after dashboard exists (Task 11).
- **Recommendation eval cron** — currently manual; add a workflow to run on schedule once dashboard signal is interesting.
````

- [ ] **Step 3: Verify formatting**

Open the file in any Markdown previewer or run:

```bash
npx prettier --check docs/architecture/observability.md
```

Expected: passes (or shows formatting fixes Prettier will apply automatically).

- [ ] **Step 4: Commit**

```bash
git add docs/architecture/observability.md
git commit -m "docs(observability): event schema for eval.completed"
```

---

### Task 9: Production smoke test

The natural validation is the next nightly cron. To force it sooner, trigger `workflow_dispatch` on `main`.

- [ ] **Step 1: Trigger a workflow_dispatch run on main**

```bash
gh workflow run "Span Labeling Golden-Set Eval" --ref main -f provider=groq
gh run watch
```

- [ ] **Step 2: Verify event landed**

```sql
SELECT
  timestamp,
  properties.evalType,
  properties.outcome,
  properties.runId,
  properties.commit,
  properties.metrics.overallF1
FROM events
WHERE event = 'eval.completed'
  AND timestamp > now() - INTERVAL 15 MINUTE
ORDER BY timestamp DESC
```

Expected: at least one row with `evalType = "span_labeling_f1"` and `runId` matching the just-triggered workflow.

- [ ] **Step 3: If no event arrived, debug in order**

1. Check the workflow run logs for `POSTHOG_API_KEY: ***` in the env block (present-but-redacted).
2. Search the run output for `Telemetry` or `posthog` to find emitter errors.
3. Confirm `POSTHOG_HOST` is set or that the default (`us.i.posthog.com`) is correct for the project.
4. If the script emitted but the event isn't in PostHog, confirm the MCP session is on org `019e1071-cc96-0000-e1ef-1ccfb297b6c0` (Vidra) and project `417445`.

- [ ] **Step 4: No commit — verification only.**

---

### Task 10: Build "Eval Health" dashboard (PostHog MCP, no code)

Build the dashboard tiles via the PostHog MCP. Not a code task — it's MCP-driven configuration. The plan documents what to build; the engineer (or Claude in a session) executes via the MCP.

- [ ] **Step 1: Switch PostHog MCP context to the right project**

```
mcp__posthog__switch-organization 019e1071-cc96-0000-e1ef-1ccfb297b6c0
mcp__posthog__switch-project 417445
```

- [ ] **Step 2: Create the dashboard**

Use `mcp__posthog__dashboard-create` with:

- name: `"Eval Health"`
- description: `"Operational health of the three eval pipelines (span-labeling-judge, span-labeling-f1, recommendation)."`

Record the dashboard ID returned for step 5.

- [ ] **Step 3: Create insights — six tiles**

For each tile below, use `mcp__posthog__insight-create` then `mcp__posthog__dashboard-update` to add it to the dashboard. Record the insight ID of each.

**Tile 1 — Per-category F1 over time.** HogQL:

```sql
SELECT
  toStartOfDay(timestamp) AS day,
  avg(JSONExtractFloat(properties.metrics, 'perCategoryF1', 'shot')) AS shot,
  avg(JSONExtractFloat(properties.metrics, 'perCategoryF1', 'subject')) AS subject,
  avg(JSONExtractFloat(properties.metrics, 'perCategoryF1', 'lighting')) AS lighting,
  avg(JSONExtractFloat(properties.metrics, 'perCategoryF1', 'camera')) AS camera,
  avg(JSONExtractFloat(properties.metrics, 'perCategoryF1', 'style')) AS style
FROM events
WHERE event = 'eval.completed' AND properties.evalType = 'span_labeling_f1'
  AND timestamp > now() - INTERVAL 30 DAY
GROUP BY day
ORDER BY day
```

(HogQL syntax for nested-property access may vary — adapt using `mcp__posthog__hogql-schema` if needed.)

**Tile 2 — F1 outcome breakdown.** Donut: count by `properties.outcome` filtered `evalType = "span_labeling_f1"`, last 7 days.

**Tile 3 — Judge avg score trend.** Line chart of `avg(properties.metrics.avgScore)` filtered `evalType = "span_labeling_judge"`, last 30 days.

**Tile 4 — Judge score distribution.** Stacked bar by day from `properties.metrics.scoreDistribution.{excellent,good,acceptable,poor,failing}`.

**Tile 5 — Recommendation drift events.** Number tile + line trend: `count()` where `evalType = "recommendation" AND properties.metrics.driftDetectedCount > 0`.

**Tile 6 — Latest eval runs.** Table: timestamp, evalType, outcome, commit, durationMs — last 50 rows ordered by timestamp DESC.

- [ ] **Step 4: Verify the dashboard renders**

Open `https://us.posthog.com/project/417445/dashboard/<dashboard-id>` in a browser. All 6 tiles should render (may be sparse data until more runs accumulate).

- [ ] **Step 5: Record IDs in observability.md**

Update `docs/architecture/observability.md`'s "Eval telemetry" section: replace "id TBD (fill in after Task 10)" with the actual dashboard ID, and add a tile table mirroring the T2V Optimize Health dashboard's pattern:

```markdown
### Tiles

| Tile                      | Insight ID | URL                                                         |
| ------------------------- | ---------- | ----------------------------------------------------------- |
| Per-category F1 over time | `<id>`     | [view](https://us.posthog.com/project/417445/insights/<id>) |

| ...
```

- [ ] **Step 6: Commit docs update**

```bash
git add docs/architecture/observability.md
git commit -m "docs(observability): link Eval Health dashboard tiles"
```

---

### Task 11: Wire PostHog alerts

Spec § 6: four alerts. At least 2 must be exercised.

- [ ] **Step 1: F1 regression — any category**

Use `mcp__posthog__alert-create`:

- insight: tile 1 (Per-category F1) insight ID from Task 10
- threshold: any category metric drops > 5% from previous run
- severity: warn
- notification target: pick what's already wired (e.g., the team Slack channel used elsewhere in this PostHog project, or email)

- [ ] **Step 2: Judge avg score regression**

- insight: tile 3 (Judge avg score) insight ID
- threshold: avg score drops > 0.5 from rolling 7-day avg
- severity: warn

- [ ] **Step 3: Setup-error alert**

Create a new insight: `count()` where `event = "eval.completed" AND properties.outcome = "setup_error"` last 24h. Alert when value > 0. Severity: warn.

- [ ] **Step 4: Gate-failure streak (critical)**

Create a new insight: `count()` where `event = "eval.completed" AND properties.outcome = "regression"` last 24h. Alert when value > 2. Severity: critical.

- [ ] **Step 5: Exercise two alerts**

Pick the easiest two to test:

- **Setup-error alert:** locally run an eval with `POSTHOG_API_KEY` set but everything else broken (e.g., `GROQ_API_KEY=""`). The script's catch block emits `outcome: "setup_error"`. Watch for the alert to fire.
- **F1 regression alert:** corrupt a baseline file locally (e.g., bump `golden-set-baselines/groq.json`'s F1 values up by 0.2 in a single category) and run the eval. Restore the baseline before committing.

Each must trigger the wired notification.

- [ ] **Step 6: Document alerts in observability.md**

Add an "Alerts" subsection to "Eval telemetry":

```markdown
### Alerts

| Alert                  | Trigger                                     | Severity | Notification |
| ---------------------- | ------------------------------------------- | -------- | ------------ |
| F1 regression          | any `perCategoryF1` drops > 5% run-over-run | warn     | <channel>    |
| Judge score regression | `avgScore` drops > 0.5 vs 7-day avg         | warn     | <channel>    |
| Setup error            | `outcome = "setup_error"` count > 0 in 24h  | warn     | <channel>    |
| Gate failure streak    | `outcome = "regression"` count > 2 in 24h   | critical | <channel>    |
```

- [ ] **Step 7: Commit**

```bash
git add docs/architecture/observability.md
git commit -m "docs(observability): document Eval Health alerts"
```

---

## Self-review checklist (against spec § 10 success criteria)

- [ ] Three eval types emit `eval.completed` events with correct schema — Tasks 3, 4, 5, 6
- [ ] Next nightly run after merge produces events visible in project `417445` — Tasks 7, 9
- [ ] "Eval Health" dashboard exists with 6 tiles, documented in observability.md — Task 10
- [ ] At least 2 of 4 alerts exercised — Task 11 step 5
- [ ] Per-category F1 trend tile shows daily data within 7 days — observable post-deploy
- [ ] Zero impact to eval gate behavior — Tasks 4–6 no-key smoke tests + Task 9
- [ ] Schema documented in `observability.md` — Tasks 8, 10, 11

---

## Notes on field-name adaptation in Tasks 4–6

The integration code in tasks 4–6 references property names on the eval scripts' internal report/result objects (e.g., `report.overallF1`, `snapshot.summary.avgCategoryScores.technicalSpecs`, `result.driftCount`). These names are inferred from the type definitions in `scripts/evaluation/types.ts` and the README — but the actual property names in the runtime code may differ slightly (camelCase vs snake_case, `errors` vs `errorCount`).

**Protocol:** in step 1 of each integration task, the engineer reads the existing script to confirm exact names. If names diverge, adapt the integration mapping in place — do not widen the discriminated-union types in `eval-event-types.ts` to accommodate runtime shape. The types are the contract; the script's local mapping is what conforms.

---

## Risks specific to execution

| Risk                                                                                               | Mitigation                                                                                       |
| -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `npm run test:unit` glob doesn't include `scripts/**/__tests__/`                                   | Task 0 catches this before any real test is written.                                             |
| Existing eval scripts have very different `main()` shapes (e.g., not async, no top-level function) | Tasks 4–6 step 1 read the file first; adapt the try/finally wrapper to whatever exists.          |
| Property names in runtime reports differ from what's assumed                                       | Documented in "Notes on field-name adaptation" above.                                            |
| Snapshot test conflicts with Prettier                                                              | First-run creates the snapshot; commit it alongside the test file so subsequent runs are stable. |
| GitHub Actions secret `POSTHOG_API_KEY` not yet added                                              | Task 7 step 1 makes this an explicit prerequisite.                                               |
| Eval emits but PostHog org/project context wrong                                                   | Task 9 step 3 has a debug ordering.                                                              |
