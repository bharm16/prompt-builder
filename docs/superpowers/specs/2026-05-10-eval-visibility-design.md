# Eval Visibility — Design Spec

**Date:** 2026-05-10
**Program:** Sub-project #0 of the [Measurement Program](../programs/measurement.md)
**Estimate:** 2–3 days
**Branch:** off `main`
**Feature flag:** none — gated by `POSTHOG_API_KEY` presence (matches existing server convention)

---

## 0. Why

Three eval scripts in [`scripts/evaluation/`](../../../scripts/evaluation) produce rich structured output today — per-category F1 scores, LLM-as-judge dimension scores, recommendation snapshots — but their results are buried in GitHub Actions artifacts with 30-day retention. Nobody clicks through to find them. The nightly Groq run at 07:00 UTC (`.github/workflows/span-labeling-eval.yml`) already executes; its data dies in storage.

This sub-project plumbs those results into PostHog as `eval.completed` events, builds an "Eval Health" dashboard, and adds regression alerts. The data already exists — this is wiring, not invention. It ships the first real signal on the program's dashboard, validating the broader [Measurement Program](../programs/measurement.md) decomposition before any further investment.

---

## 1. Locked architectural decisions

| Decision                 | Choice                                                               | Reason                                                                                                                                                                                                                                       |
| ------------------------ | -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Event shape              | **One `eval.completed` event with `evalType` discriminator**         | Three evals share the same outer shape (run on commit, gate result, metrics, duration). Discriminator lets cross-eval queries work naturally ("show all regressions today"); adding new evals later is one enum value, not a new event type. |
| Per-eval metrics typing  | Discriminated union via `evalType`                                   | Top-level fields (`outcome`, `commit`, `durationMs`, etc.) are flat and typed; `metrics` is polymorphic with strict types per discriminator value.                                                                                           |
| Emission location        | End of each eval's `main()`, after gate result computed              | One point per script. Survives both pass and fail paths via `try/finally`.                                                                                                                                                                   |
| Shared PostHog client    | New helper `scripts/evaluation/posthog-emitter.ts`                   | Three scripts use one client; mirrors the server pattern (`server/src/infrastructure/PostHogClient.ts`) — no-op stub when `POSTHOG_API_KEY` is unset.                                                                                        |
| Local dev behavior       | No-op when `POSTHOG_API_KEY` unset                                   | Painless local eval runs; CI sets the key.                                                                                                                                                                                                   |
| Failure mode             | Best-effort, fire-and-forget. Emission failures never fail the eval. | Telemetry must not break the gate. Errors logged at `debug` only.                                                                                                                                                                            |
| Workflow integration     | Add `POSTHOG_API_KEY` to the env block in `span-labeling-eval.yml`   | One line per job. Existing nightly cron inherits emission for free.                                                                                                                                                                          |
| Recommendation eval cron | **Not added here** — recommendation eval remains manual              | Adding cron is a separate decision; once events flow, the dashboard tile is just sparse until manual runs happen.                                                                                                                            |
| Source discriminator     | **Not required for this sub-project**                                | `eval.completed` is a distinct event name from `optimize.completed`/`suggestions.completed`/`llm.call.completed`. No risk of mixing. Source discriminator (deferred #1) is a sidecar for operational telemetry, not relevant here.           |
| Dashboard target         | Same PostHog project as T2V Optimize Health (`417445`)               | One project; one MCP context; team already knows where to look.                                                                                                                                                                              |

---

## 2. The contract

When any of the three eval scripts completes (passed, regression, or setup error), exactly one PostHog event named `eval.completed` is emitted with the schema below. The event is best-effort — failure to emit does not change the eval's exit code.

```typescript
type EvalType = "span_labeling_judge" | "span_labeling_f1" | "recommendation";
type Outcome = "passed" | "regression" | "setup_error";
type Provider = "groq" | "openai";

interface SpanLabelingJudgeMetrics {
  avgScore: number; // 0–25
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

interface SpanLabelingF1Metrics {
  overallF1: number;
  overallPrecision: number;
  overallRecall: number;
  perCategoryF1: Record<string, number>;
  baselineCommit?: string;
}

interface RecommendationMetrics {
  driftDetectedCount: number;
  totalPrompts: number;
  newPromptsCount: number;
  baselineName: string;
}

{
  event: "eval.completed",
  distinctId: string,                   // "ci-<runId>" for workflow runs, "local-<username>" otherwise, "anon-<uuid>" fallback
  timestamp: ISO8601,
  properties: {
    // Discriminator + outcome
    evalType: EvalType,
    outcome: Outcome,
    errorMessage?: string,              // present when outcome = "setup_error" or "regression"

    // Provenance
    commit: string,                     // from --commit flag / GIT_COMMIT env / "unknown"
    runId?: string,                     // GitHub Actions GITHUB_RUN_ID when in CI
    provider?: Provider | null,         // for span_labeling_*; null/absent for recommendation
    sourceFile?: string,                // prompt fixture path

    // Top-line numbers
    durationMs: number,
    promptCount: number,
    errorCount: number,                 // per-prompt errors during the eval run

    // Polymorphic per-eval metrics
    metrics: SpanLabelingJudgeMetrics | SpanLabelingF1Metrics | RecommendationMetrics,
  },
}
```

The schema is a contract. A snapshot test (§ 4) makes drift visible in PR diffs.

**Property naming:** `*Ms` suffix on durations, `*Count` suffix on counters, `*F1`/`*Score` on metric values, `evalType` (camelCase) for the discriminator.

---

## 3. Architecture

Three new files, four modified. None touch the server's DI container — these are scripts-only changes.

```
scripts/evaluation/
  posthog-emitter.ts                         (NEW)
                                             — IEvalEmitter interface (emit, shutdown)
                                             — Real implementation wraps posthog-node
                                             — No-op stub when POSTHOG_API_KEY is unset
                                             — Mirrors server/src/infrastructure/PostHogClient.ts
  eval-event-types.ts                        (NEW)
                                             — Discriminated-union types for the event
                                             — Imported by the three eval scripts
  __tests__/
    posthog-emitter.test.ts                  (NEW)
    eval-event-schema.snapshot.test.ts       (NEW)

  span-labeling-evaluation.ts                (MODIFIED)
                                             — Constructs emitter in main()
                                             — try/finally: emit eval.completed with SpanLabelingJudgeMetrics
                                             — Calls emitter.shutdown() before process exit
  golden-set-relaxed-f1.ts                   (MODIFIED)
                                             — Same shape; emits SpanLabelingF1Metrics with per-category F1
                                             — Outcome derived from gate result (passed | regression | setup_error)
  recommendation-eval.ts                     (MODIFIED)
                                             — Same shape; emits RecommendationMetrics
                                             — Outcome derived from drift detection
```

```
.github/workflows/span-labeling-eval.yml     (MODIFIED)
                                             — Adds POSTHOG_API_KEY: ${{ secrets.POSTHOG_API_KEY }} to each job's env block
                                             — One line × 3 jobs
```

### 3.1 The emitter shim

```typescript
// scripts/evaluation/posthog-emitter.ts
import { PostHog } from "posthog-node";

export interface EmitArgs {
  distinctId: string;
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
  metrics:
    | SpanLabelingJudgeMetrics
    | SpanLabelingF1Metrics
    | RecommendationMetrics;
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
  if (!apiKey?.trim()) return new EvalEmitterNoop();
  return new EvalEmitterReal(apiKey, process.env.POSTHOG_HOST);
}
```

### 3.2 `distinctId` convention

- **CI runs:** `"ci-<GITHUB_RUN_ID>"` when `process.env.GITHUB_RUN_ID` is set
- **Local runs:** `"local-<os.userInfo().username>"` otherwise
- **Fallback:** `"anon-<crypto.randomUUID()>"`

This separation lets dashboards filter "CI-only runs" or "ignore local manual runs" via a simple `distinctId LIKE 'ci-%'` query.

### 3.3 Integration pattern (illustrated for `golden-set-relaxed-f1.ts`)

```typescript
const emitter = createEvalEmitter();
const startedAt = Date.now();
let outcome: Outcome = "setup_error";
let metrics: SpanLabelingF1Metrics | undefined;
let errorMessage: string | undefined;

try {
  // ... existing eval logic ...
  metrics = buildMetrics(report);
  outcome = gateResult.passed ? "passed" : "regression";
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
      provider: opts.provider,
      runId: process.env.GITHUB_RUN_ID,
      durationMs: Date.now() - startedAt,
      promptCount: report?.totalPrompts ?? 0,
      errorCount: report?.errorCount ?? 0,
      metrics: metrics ?? buildEmptyMetrics(),
    });
    await emitter.shutdown();
  } catch {
    // never fail the eval on telemetry hiccup
  }
}
```

The same pattern in the other two scripts; only the `evalType` and `metrics` shape vary.

---

## 4. Tests

| Test                                                       | Asserts                                                                                                                   |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `posthog-emitter.test.ts`                                  | No-op stub returned when `POSTHOG_API_KEY` is unset; `emit()` errors swallowed and don't propagate; `shutdown()` flushes. |
| `eval-event-schema.snapshot.test.ts`                       | One snapshot per `evalType`. Sample events match. Schema drift visible in PR diffs.                                       |
| Integration test (extend one eval's existing tests if any) | Run one eval end-to-end with a mocked `IEvalEmitter`; assert `emit()` called once with expected outcome and shape.        |

Pre-existing tests for the eval scripts (if any) must still pass — telemetry is purely additive.

---

## 5. Dashboard — "Eval Health"

New PostHog dashboard in project `417445`. Tiles:

| Tile                        | Insight                                                                                         | Notes                                                                                     |
| --------------------------- | ----------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Per-category F1 over time   | Line chart, one line per category                                                               | Filter `evalType = "span_labeling_f1"`; provider breakdown optional.                      |
| F1 outcome breakdown        | Donut: passed / regression / setup_error per day                                                | Answers "how often does the gate trip?"                                                   |
| Judge avg score trend       | Line chart                                                                                      | Filter `evalType = "span_labeling_judge"`; 25-point scale.                                |
| Judge score distribution    | Stacked bar (excellent/good/acceptable/poor/failing over time) from `metrics.scoreDistribution` |                                                                                           |
| Recommendation drift events | Number tile + line trend                                                                        | Counts `eval.completed` where `evalType = "recommendation"` and `driftDetectedCount > 0`. |
| Latest eval runs            | Table of last 50 events with timestamp, evalType, outcome, commit                               | For quick "what just happened" lookups.                                                   |

Built via PostHog MCP after events start flowing (after the first nightly run hits merged code). Tile IDs documented in [`docs/architecture/observability.md`](../../architecture/observability.md) once stable.

---

## 6. Alerts

PostHog alerts wired against the new event stream:

| Alert                        | Trigger                                                 | Severity |
| ---------------------------- | ------------------------------------------------------- | -------- |
| F1 regression — any category | `metrics.perCategoryF1[*]` drops > 5% from previous run | warn     |
| Judge avg score regression   | `metrics.avgScore` drops > 0.5 from rolling 7-day avg   | warn     |
| Setup error                  | `outcome = "setup_error"` count > 0 in last 24h         | warn     |
| Gate failure streak          | `outcome = "regression"` count > 2 in last 24h          | critical |

Wired via PostHog MCP after the first dashboard tiles are in place. At least 2 of the 4 must be exercised in a forced-regression test to confirm delivery before declaring done.

---

## 7. Implementation flow

Suggested PR sequence:

1. **`posthog-emitter.ts` + types + tests** — emitter shim and shared types, snapshot test for event schema.
2. **Three eval scripts integrated** — emission added to span-labeling-evaluation, golden-set-relaxed-f1, recommendation-eval. Can be one PR (three commits) or three separate PRs.
3. **Workflow env addition** — one-line change to `span-labeling-eval.yml` adding `POSTHOG_API_KEY` to each job's env block. Add the GitHub Actions repo secret out-of-band.
4. **Dashboard + alerts** — no-code PR (PostHog MCP commands documented + `docs/architecture/observability.md` updated with tile IDs).

Each PR passes `tsc --noEmit`, lint, unit tests. None of these PRs touches DI config or server services, so the integration test gate in `CLAUDE.md` is not required.

---

## 8. Out of scope

- **Source discriminator on eval events** — eval events have a separate event name; no risk of mixing with user/synthetic traffic.
- **Cron schedule for recommendation eval** — current cadence is manual; adding cron is a separate decision.
- **Generating richer eval data than what exists today** — this sub-project surfaces what exists, doesn't change eval cadence or methodology.
- **Cross-surface dashboards** — this is the eval-specific dashboard. The cross-surface "everything health" dashboard is sub-project #4.
- **PR-time eval enforcement** — gating PR merge on eval results is a separate decision; today the workflow runs nightly only.
- **Linking eval runs to optimize traffic events** — correlating an F1 dip to a recent optimize-flow change requires tracing changes by commit; defer until needed.
- **LLM-effectiveness eval framework for non-eval surfaces** — judging live optimize/suggestion output quality is sub-project #3.

---

## 9. Risks

| Risk                                                               | Likelihood   | Mitigation                                                                                                                              |
| ------------------------------------------------------------------ | ------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| `POSTHOG_API_KEY` missing from repo secrets                        | Medium       | Step 3 of implementation flow makes this explicit. Verify in a `workflow_dispatch` run before merging.                                  |
| Discriminated-union schema drifts from dashboard query assumptions | Medium       | Snapshot test (§ 4) makes schema changes visible in PR diffs. Tile IDs documented in `observability.md` after creation.                 |
| posthog-node startup adds eval latency                             | Low          | Client construction is cheap; shutdown bound to ~1s typical. Eval runs are 5–15 min; ms-level overhead is invisible.                    |
| Telemetry emission throws and breaks the eval                      | Low          | All emission wrapped in `try/catch` at the emitter level plus an outer `try` block at the call site. Tests assert errors are swallowed. |
| Recommendation eval is manual; tile sparse                         | Acknowledged | Documented as out-of-scope; tile becomes useful once cron is added (separate sub-project).                                              |
| Event volume exceeds PostHog free-tier limits                      | Low          | Three evals × ~1 run/day = 3 events/day from CI. Local runs add bounded volume. Well within limits.                                     |
| Polymorphic `metrics` shape confuses PostHog property breakdown UI | Low          | Top-level fields are flat (and most queries operate on those). The `metrics` object is opaque-but-queryable via dot-path in HogQL.      |

---

## 10. Success criteria

- Three eval types emit `eval.completed` events with the schema in § 2; snapshot test asserts the shape for each `evalType`.
- The next nightly run after merge produces events visible in PostHog project `417445` (filterable by `evalType` and `outcome`).
- "Eval Health" dashboard exists with at least the 6 tiles in § 5; documented in `docs/architecture/observability.md` with tile IDs.
- At least 2 of 4 alerts in § 6 wired and exercised via a forced regression / setup error.
- Within 7 days of merge, the per-category F1 trend tile shows daily data points from the nightly cron.
- Zero impact to eval gate behavior — every eval that passed before this lands still passes (telemetry is purely additive).
- Schema documented in `docs/architecture/observability.md` matching the existing `optimize.completed` / `suggestions.completed` pattern.
