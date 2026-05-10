# T2V Optimize Operational Telemetry — Design Spec

**Date:** 2026-05-09
**Owner:** Observability pod (no formal pod — single-engineer scope)
**Estimate:** ~1 week (M3a-1 only — emission + first dashboard; LLM-call extension and other endpoints deferred)
**Branch:** off `main`
**Feature flag:** none — controlled by presence of `POSTHOG_API_KEY` env var (no-op stub when absent)

---

## 0. Why

The T2V optimize pipeline (`POST /api/optimize`) fires up to four LLM calls per click — shot interpreter, strategy optimize, optional constitutional review, and optional model compilation — plus deterministic intent-lock and prompt-lint passes. The total cost in latency and money per click is unobserved in any way the team can query.

The repo has substantial Prometheus instrumentation in `server/src/infrastructure/MetricsService.ts` (HTTP duration, LLM API calls/duration/tokens/cost, cache hits, enhancement-pipeline timing, optimization quality gate), exposed via a `/metrics` endpoint. Nothing scrapes it. The metrics are emitted into a void; the team has no dashboard or alerting surface that would let them notice if the pipeline regressed in latency, cost, or success rate.

This spec installs the smallest end-to-end measurement surface that produces actionable answers within a week: a single PostHog event per Optimize click, with stage-level timing, surfaced through a PostHog dashboard. PostHog is the chosen target because it is already MCP-connected in the development environment — a force multiplier that puts data in front of human eyes and Claude tooling on day one without standing up new infrastructure (Grafana, hosted Prometheus, etc.).

Once this lands and runs for one week, the question "is the 4+ LLM call cost per Optimize click justified?" becomes answerable. Until then, any T2V simplification is flying blind.

## 1. Locked architectural decisions

| Decision                               | Choice                                                                                  | Reason                                                                                                                                                                        |
| -------------------------------------- | --------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Surfacing target                       | **PostHog** (server-side events via `posthog-node`)                                     | Already MCP-connected; existing PostHog skills (`posthog:querying-posthog-data`, `posthog:investigate-metric`) make data immediately useful; no new infrastructure to host.   |
| Event granularity                      | **Single fat event per Optimize call** (`optimize.completed`)                           | Approach A from brainstorm — answers the M3 brief on day one with the simplest schema; LLM-level events deferred to a follow-up.                                              |
| Existing `prom-client` instrumentation | **Leave as-is.** Don't delete in this spec.                                             | Decoupling creation from deletion: ship the new path, confirm it meets the need, then schedule a separate cleanup PR. The existing instrumentation is harmless until removed. |
| Local-dev behavior with no API key     | **No-op stub** when `POSTHOG_API_KEY` is unset                                          | Painless local boot; production sets the key. No feature flag needed.                                                                                                         |
| Failure mode                           | **Best-effort, fire-and-forget.** Telemetry never fails or slows the request.           | Telemetry is non-essential; PostHog outage must not break user flow. Errors logged at `debug` level only.                                                                     |
| Sampling                               | **None initially.**                                                                     | Optimize is a user-initiated, low-frequency action. Sampling is a follow-up if event volume becomes a cost concern.                                                           |
| Identity                               | `distinctId = req.userId` (Firebase UID) when present, `anon-<uuid>` fallback otherwise | Reuses existing auth middleware; degrades gracefully for unauthenticated paths.                                                                                               |
| Scope                                  | **`/api/optimize` only.** Suggestions / enhance / span-labeling deferred.               | Smaller surface, faster ship, validates schema before extending.                                                                                                              |

## 2. The contract

When a user fires `POST /api/optimize`, exactly one PostHog event named `optimize.completed` is emitted at the end of the request lifecycle (success, error, or aborted). The event carries enough properties to answer:

- How long did this Optimize click take, broken down by stage?
- How many LLM calls did it actually make?
- Did the cache hit?
- Which target model was requested?
- Did the request succeed, error (where?), or get aborted?
- What input shape (prompt length, locked-span count, has-context, has-shot-plan, etc.) does this slice into?

Querying that data is via PostHog SQL or insight builder. The dashboard built atop those queries is the deliverable that earns the spec its keep — emission alone is half the work.

## 3. Event schema — `optimize.completed`

```ts
{
  event: "optimize.completed",
  distinctId: string,                    // userId, or "anon-<uuid>"
  timestamp: ISO8601,
  properties: {
    // Correlation
    requestId: string,                   // req.id
    userId: string | null,

    // Outcome
    outcome: "success" | "error" | "aborted",
    errorMessage?: string,
    errorStage?:
      | "shot_interpreter" | "strategy" | "constitutional"
      | "intent_lock" | "compilation" | "prompt_lint" | "cache",

    // Top-line numbers
    durationMs: number,                  // wall-clock end-to-end
    llmCallCount: number,                // counter incremented at each aiService.execute call site
    cacheHit: boolean,                   // when true, all stage timings are null
    targetModel: string | null,
    mode: "video",

    // Input shape (cohort dimensions)
    promptLength: number,
    outputLength: number,                // length of returned optimized prompt; 0 on error
    lockedSpanCount: number,
    hasContext: boolean,
    hasBrainstormContext: boolean,
    hasShotPlan: boolean,                // pre-supplied, not interpreted
    useConstitutionalAI: boolean,

    // Per-stage wall-clock timing in ms; null if stage was skipped or didn't reach
    stages: {
      shotInterpreterMs: number | null,
      strategyOptimizeMs: number | null,   // includes domainContent generation if any
      constitutionalMs: number | null,
      intentLockMs: number | null,
      compilationMs: number | null,
      promptLintMs: number | null,
    },
  },
}
```

The schema is a contract. Future PRs that add or remove properties go through code review with an explicit note. A snapshot test (§8) makes drift visible in diffs.

**Property naming conventions:**

- `*Ms` suffix on duration values (numeric, milliseconds, integer-rounded for stage timings).
- `*Count` suffix on counters.
- `has*` prefix on boolean dimensions describing input shape.
- `outcome` is the canonical success/error indicator; `errorStage` is null on success.

## 4. Server-side architecture

Three new files, three modified.

```
server/src/infrastructure/
  PostHogClient.ts                       (NEW)
                                         — IPostHogClient interface (capture, shutdown).
                                         — Real implementation wraps posthog-node.
                                         — No-op stub when POSTHOG_API_KEY is unset.

server/src/services/observability/
  OptimizeTelemetryService.ts            (NEW)
                                         — startOptimizeTrace(requestId, userId): OptimizeTrace
                                         — OptimizeTrace internal class with recordStage,
                                           recordLlmCall, recordCacheHit, recordError, complete.
  __tests__/OptimizeTelemetryService.test.ts  (NEW)

server/src/config/services/
  observability.services.ts              (NEW)
                                         — registerObservabilityServices(container)
                                         — Registers IPostHogClient + OptimizeTelemetryService.
```

```
server/src/services/prompt-optimization/PromptOptimizationService.ts  (MODIFIED)
  — Constructor accepts OptimizeTelemetryService.
  — optimize() resolves the trace and threads it into runOptimizeFlow.

server/src/services/prompt-optimization/workflows/optimizeFlow.ts     (MODIFIED)
  — OptimizeFlowArgs gains a `telemetry: OptimizeTrace` field.
  — Each stage wrapped in start/end timing and recordStage().
  — recordLlmCall() at each aiService.execute call site.
  — recordCacheHit() on cache hit branch.
  — telemetry.complete({outcome, ...}) in success / error / abort paths.

server/src/services/prompt-optimization/workflows/types.ts            (MODIFIED)
  — OptimizeFlowArgs adds the telemetry field.

server/src/config/services.config.ts                                  (MODIFIED)
  — Calls registerObservabilityServices(container).

server/package.json                                                   (MODIFIED)
  — Adds posthog-node dependency.
```

### 4.1 PostHogClient — the infrastructure shim

```ts
// server/src/infrastructure/PostHogClient.ts
import { PostHog } from "posthog-node";

export interface CaptureArgs {
  distinctId: string;
  event: string;
  properties?: Record<string, unknown>;
  timestamp?: Date;
}

export interface IPostHogClient {
  capture(args: CaptureArgs): void;
  shutdown(): Promise<void>;
}

class PostHogClientReal implements IPostHogClient {
  private readonly client: PostHog;
  constructor(apiKey: string, host?: string) {
    this.client = new PostHog(apiKey, {
      ...(host ? { host } : {}),
      flushAt: 20,
      flushInterval: 10000,
    });
  }
  capture(args: CaptureArgs): void {
    try {
      this.client.capture(args);
    } catch {
      // intentionally swallow — telemetry must not throw upstream.
    }
  }
  async shutdown(): Promise<void> {
    await this.client.shutdown();
  }
}

class PostHogClientNoop implements IPostHogClient {
  capture(): void {}
  async shutdown(): Promise<void> {}
}

export function createPostHogClient(): IPostHogClient {
  const apiKey = process.env.POSTHOG_API_KEY;
  if (!apiKey || apiKey.trim().length === 0) {
    return new PostHogClientNoop();
  }
  return new PostHogClientReal(apiKey, process.env.POSTHOG_HOST);
}
```

### 4.2 OptimizeTelemetryService — the domain shape

```ts
// server/src/services/observability/OptimizeTelemetryService.ts
import { randomUUID } from "node:crypto";
import type { IPostHogClient } from "@infrastructure/PostHogClient";
import { logger } from "@infrastructure/Logger";

export type StageName =
  | "shot_interpreter"
  | "strategy"
  | "constitutional"
  | "intent_lock"
  | "compilation"
  | "prompt_lint"
  | "cache";

interface CompleteSummary {
  outcome: "success" | "error" | "aborted";
  promptLength: number;
  outputLength: number;
  lockedSpanCount: number;
  targetModel: string | null;
  mode: "video";
  hasContext: boolean;
  hasBrainstormContext: boolean;
  hasShotPlan: boolean;
  useConstitutionalAI: boolean;
}

export class OptimizeTrace {
  private readonly startedAt = performance.now();
  private readonly stages: Record<StageName, number | null> = {
    shot_interpreter: null,
    strategy: null,
    constitutional: null,
    intent_lock: null,
    compilation: null,
    prompt_lint: null,
    cache: null,
  };
  private llmCallCount = 0;
  private cacheHit = false;
  private errorStage: StageName | null = null;
  private errorMessage: string | null = null;

  constructor(
    private readonly client: IPostHogClient,
    private readonly distinctId: string,
    private readonly requestId: string,
    private readonly userId: string | null,
  ) {}

  recordStage(name: StageName, durationMs: number): void {
    this.stages[name] = Math.round(durationMs);
  }
  recordLlmCall(): void {
    this.llmCallCount += 1;
  }
  recordCacheHit(): void {
    this.cacheHit = true;
  }
  recordError(stage: StageName, err: unknown): void {
    this.errorStage = stage;
    this.errorMessage = err instanceof Error ? err.message : String(err);
  }

  complete(summary: CompleteSummary): void {
    const durationMs = Math.round(performance.now() - this.startedAt);
    try {
      this.client.capture({
        distinctId: this.distinctId,
        event: "optimize.completed",
        properties: {
          requestId: this.requestId,
          userId: this.userId,
          outcome: summary.outcome,
          ...(this.errorMessage ? { errorMessage: this.errorMessage } : {}),
          ...(this.errorStage ? { errorStage: this.errorStage } : {}),
          durationMs,
          llmCallCount: this.llmCallCount,
          cacheHit: this.cacheHit,
          targetModel: summary.targetModel,
          mode: summary.mode,
          promptLength: summary.promptLength,
          outputLength: summary.outputLength,
          lockedSpanCount: summary.lockedSpanCount,
          hasContext: summary.hasContext,
          hasBrainstormContext: summary.hasBrainstormContext,
          hasShotPlan: summary.hasShotPlan,
          useConstitutionalAI: summary.useConstitutionalAI,
          stages: {
            shotInterpreterMs: this.stages.shot_interpreter,
            strategyOptimizeMs: this.stages.strategy,
            constitutionalMs: this.stages.constitutional,
            intentLockMs: this.stages.intent_lock,
            compilationMs: this.stages.compilation,
            promptLintMs: this.stages.prompt_lint,
          },
        },
      });
    } catch (err) {
      logger.debug("Telemetry emission failed (non-fatal)", {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
}

export class OptimizeTelemetryService {
  constructor(private readonly client: IPostHogClient) {}

  startOptimizeTrace(requestId: string, userId: string | null): OptimizeTrace {
    const distinctId =
      userId && userId.length > 0 ? userId : `anon-${randomUUID()}`;
    return new OptimizeTrace(this.client, distinctId, requestId, userId);
  }
}
```

### 4.3 optimizeFlow integration

The flow gains a `telemetry: OptimizeTrace` arg in `OptimizeFlowArgs`. Each stage gets a thin start/end wrapper:

```ts
// At top of runOptimizeFlow:
const t = telemetry; // alias for brevity

// Cache hit branch:
if (cached) {
  t.recordCacheHit();
  t.complete({ outcome: "success", outputLength: cached.length, ... });
  return { ... };
}

// Per stage:
const shotStart = performance.now();
try {
  interpretedShotPlan = await shotInterpreter.interpret(prompt, signal);
  t.recordLlmCall();
} catch (err) {
  t.recordStage("shot_interpreter", performance.now() - shotStart);
  // existing graceful-degrade behavior — log warn, proceed without plan
}
t.recordStage("shot_interpreter", performance.now() - shotStart);

// ... same pattern for strategy, constitutional, intent_lock, compilation, prompt_lint

// Success path (just before return):
t.complete({ outcome: "success", outputLength: optimizedPrompt.length, ... });

// Error / abort paths:
catch (error) {
  if ((error as Error)?.name === "AbortError") {
    t.complete({ outcome: "aborted", outputLength: 0, ... });
  } else {
    // recordError already called at the failing stage's catch
    t.complete({ outcome: "error", outputLength: 0, ... });
  }
  throw error;
}
```

The current `optimizeFlow.ts` (354 lines) gains roughly 30-40 lines of telemetry plumbing.

## 5. Identity, correlation, failure modes

| Concern              | Choice                                                                                                                                                                                                                                                    |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `distinctId`         | `req.userId` (Firebase UID; populated by existing auth middleware). Anonymous fallback: `anon-<crypto.randomUUID()>` per request.                                                                                                                         |
| `requestId`          | `req.id` — populated by request-id middleware. Used as a correlation key for future client-side / cross-system tracing.                                                                                                                                   |
| Async / non-blocking | `posthog-node` queues in-memory and flushes every 10s or on `flushAt` threshold (20 events). `complete()` is fire-and-forget.                                                                                                                             |
| PostHog outage       | `posthog-node` retries internally; permanent failures lose the event. `capture()` is wrapped in `try/catch` at the client level — never throws upstream. Errors logged at Pino `debug` (not `warn` — telemetry hiccups must not pollute on-call queries). |
| Sampling             | None initially.                                                                                                                                                                                                                                           |
| Local dev            | No `POSTHOG_API_KEY` → no-op stub. Server boots and runs unaffected.                                                                                                                                                                                      |
| Production rollout   | Set `POSTHOG_API_KEY` (and optionally `POSTHOG_HOST`) in deploy environment. No code-path feature flag.                                                                                                                                                   |
| Graceful shutdown    | Add `client.shutdown()` to the existing shutdown handler in `server.ts` (locate during implementation). Without this, in-flight events may be lost on deploy.                                                                                             |

## 6. Implementation flow

Suggested PR sequence within this single spec:

1. **Add `posthog-node` dependency + `PostHogClient` infrastructure** (one PR).
2. **Add `OptimizeTelemetryService` + DI registration + tests** (second PR — service is wired but not yet emitting).
3. **Integrate `OptimizeTrace` into `optimizeFlow.ts` + threading through `PromptOptimizationService`** (third PR — events now flow when env var is set).
4. **Wire `client.shutdown()` into the graceful-shutdown path** (fourth, can be combined with #3).
5. **Build the first PostHog dashboard** ("T2V Optimize Health") via the MCP, using one week of accumulated data — not a code PR, but documented as a follow-up task in the spec.

Each PR should pass the project's commit protocol (`tsc --noEmit`, lint, unit tests). Step 2 also runs the integration test gate per `CLAUDE.md` because DI config is touched.

## 7. Surfacing layer (PostHog dashboards)

After events are emitting in production, build a "T2V Optimize Health" dashboard with:

- **Avg `durationMs` over time** — line chart, daily granularity.
- **p50/p95 by stage** — stacked bar from `properties.stages.*`. Visualizes "where is the time going?"
- **Cache hit rate over time** — number tile + line trend.
- **LLM call count distribution** — histogram of `properties.llmCallCount`. Confirms the "4+ calls per click" assumption.
- **Outcome breakdown** — donut: success / error / aborted percentages.
- **Failure heatmap by `errorStage`** — when outcome ≠ success, which stage was the cause?
- **Cost-per-click approximation** — `count(events) × avg-cost-per-LLM-call` from the existing `MetricsService.llmCostDollarsTotal` (if accessible) OR a static estimate per stage type. Imprecise but directional. Exact cost requires the C extension (deferred).

The dashboard is not a code deliverable but **is a milestone**: the spec is incomplete until the dashboard exists and is queryable. Without it, the events go into the same void as the prom-client metrics.

## 8. Tests

- `OptimizeTelemetryService.test.ts` (new):
  - Trace start → stage recording → complete emits one event with correct shape.
  - Anonymous fallback when `userId` is null.
  - `recordError` populates `errorStage` and `errorMessage` on completion.
  - Cache-hit path emits with `cacheHit: true` and null stage timings.
- `PostHogClient.test.ts` (new):
  - No-op stub returned when `POSTHOG_API_KEY` is unset.
  - `capture()` errors swallowed and don't propagate.
- `optimizeFlow` integration test (extend existing or add new):
  - Mock `IPostHogClient`; run the flow end-to-end with a stubbed AI service; assert one event captured with expected schema.
- **Snapshot contract test:** save a sample event payload as a snapshot. Future PRs that change the schema break this test, making schema drift visible in code review.

## 9. Out of scope

- **Client-side telemetry** (M1 — user behavior). Defer; future work to emit `optimize.requested` from the client and correlate via `requestId`.
- **Per-LLM-call events** (Approach C extension). Defer; add `llm.call.completed` events at the `aiService.execute` boundary when LLM-level analysis becomes the question.
- **Suggestions / enhance / span-labeling endpoints** (M3b). Defer; same event-shape pattern, new event names.
- **Removing dead `prom-client` instrumentation** in `MetricsService.ts`. Separate cleanup PR after PostHog is confirmed serving the need.
- **Experimentation / A/B framework** (M4). Defer until a redesign variant is ready to compare.
- **Exact dollar-cost-per-Optimize-click** as a first-class field. Approximated in dashboard from existing data; precise cost requires C extension.

## 10. Migration & rollout

- No data migration. No feature flag. The feature is gated by the presence of `POSTHOG_API_KEY`.
- In dev: leave `POSTHOG_API_KEY` unset; no-op stub kicks in; nothing changes.
- In production: set `POSTHOG_API_KEY` (and optional `POSTHOG_HOST`) in deploy env. On next deploy, events begin flowing.
- Rollback: unset `POSTHOG_API_KEY` and redeploy. Stub silently swallows; no functional impact.

## 11. Risk register

| Risk                                                                | Likelihood | Mitigation                                                                                                         |
| ------------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------ |
| `posthog-node` adds startup latency or memory cost                  | Low        | Posthog client construction is cheap; events queue is bounded by `flushAt`. Monitor process metrics post-deploy.   |
| Schema drift between code and dashboard queries                     | Medium     | Snapshot contract test makes property changes visible in PR review. Document property names in this spec.          |
| Telemetry emission throws and crashes a request                     | Low        | All emission wrapped in `try/catch` at the client level; no-op fallback. Tests assert `capture()` swallows errors. |
| Events ingested but nobody looks                                    | Medium     | The dashboard milestone is part of the spec, not an afterthought. Without the dashboard, the work is incomplete.   |
| `req.userId` not populated where expected                           | Low–Medium | Auth middleware behavior verified during implementation; anonymous fallback covers gaps.                           |
| LLM-call counter undercount due to internal calls inside stage code | Medium     | Documented limitation; if undercount becomes problematic, the C extension wraps `aiService.execute` directly.      |
| `posthog-node` queue lost on ungraceful shutdown                    | Low        | `client.shutdown()` wired into graceful shutdown handler. Ungraceful kills still lose events — acceptable.         |

## 12. Success criteria

- One `optimize.completed` event per `/api/optimize` call, all schema fields present and typed correctly.
- p95 added latency from telemetry ≤ 1ms (measured by comparing with the same flow under no-op stub).
- Server boots and runs cleanly when `POSTHOG_API_KEY` is unset (CI test).
- Within one week of production merge: a PostHog "T2V Optimize Health" dashboard exists and surfaces actionable answers to "where is the time going?" and "is the LLM call count what we expected?"
- A snapshot contract test passes; future schema changes are visible in code review.
- Zero production incidents attributable to telemetry emission.
