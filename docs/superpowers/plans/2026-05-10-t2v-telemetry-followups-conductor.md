# T2V Telemetry Follow-ups — Conductor Parallel Plan

> **For Conductor.build workers:** This document defines three independent tasks that can run in parallel worktrees. Each task is self-contained — read only your assigned task. The orchestrator merges results via cherry-pick after each agent completes.

**Context:** The T2V optimize telemetry work shipped (12 commits, dashboard at https://us.posthog.com/project/417445/dashboard/1565688). Three follow-ups remain. They're independent: different files, different concerns, no ordering dependencies. We're running them in parallel for speed.

**Tech Stack:** Node 20 + Express + tsx + TypeScript (server), `posthog-node` SDK, Vitest, Pino, existing `DIContainer` infrastructure.

**Source spec for the optimize-side work this extends:** [`docs/superpowers/specs/2026-05-09-t2v-optimize-telemetry-design.md`](../specs/2026-05-09-t2v-optimize-telemetry-design.md)

---

## Conflict map (read first)

All three tasks touch disjoint primary files. **Two files are known conflict zones** because multiple tasks might modify them:

| File                                                   | Tasks that touch it | Resolution                                                                                                                |
| ------------------------------------------------------ | ------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `server/src/config/services.config.ts`                 | C, M3b              | Each task adds one `registerXxxServices(container)` call. Cherry-pick conflicts will be trivial — accept both insertions. |
| `server/src/config/services/observability.services.ts` | C, M3b              | Each task appends a new `container.register("xxxService", ...)` block. Same trivial merge.                                |
| `server/src/services/observability/types.ts`           | C, M3b              | Each task may export new types alongside existing ones. Append-only conflicts.                                            |

**Cleanup task (Task A) does not collide with C or M3b** — it touches `MetricsService.ts`, the `/metrics` route, and `metricsAuth` middleware exclusively. It can run fully in parallel without conflict-resolution overhead.

---

## Task A — Delete dead `prom-client` instrumentation

**Goal:** Remove the Prometheus-based `MetricsService` and its plumbing. Nothing scrapes `/metrics` in production; the histograms emit into a void. PostHog now serves the telemetry need.

### Worktree setup (mandatory first step)

1. `cd` into the worktree directory shown in your env. Use RELATIVE paths thereafter — absolute paths can resolve to the main checkout via the symlinked `.git`.
2. Run `git log --oneline main -3`. The latest commit should be `5d9fe8be docs(observability): T2V Optimize Health dashboard + event schema reference` (or later). If not, run `git rebase main`.
3. `npx tsc --noEmit 2>&1 | grep -c "error TS"` must be **0**. ESLint clean.
4. Run `npm install --ignore-scripts` if needed.

### Critical context

- `vitest.unit.config.js` (NOT `vitest.config.js` — project-name collision)
- Single-package layout (NOT a monorepo despite CLAUDE.md's diagram)
- The codebase uses `DIContainer.register(token, factory, dependencies[])` — see `server/src/config/services/llm.services.ts` for canonical shape

### Your scope

You may DELETE:

- `server/src/infrastructure/MetricsService.ts`
- `server/src/middleware/metricsAuth.ts`
- `server/src/middleware/__tests__/metricsAuth.test.ts`
- `server/src/middleware/__tests__/performanceMonitor.test.ts` only if it tests prom-client integration; keep it if it just tests timing-recording behavior
- Any `/metrics` route file (find via `git grep -l "register.*metrics\|/metrics\"" server/src/routes/`)
- The `prom-client` dependency from `package.json` once nothing imports it

You may MODIFY:

- `server/src/config/services/core.services.ts` (remove `metricsService` registration if present)
- `server/src/config/services.config.ts` (remove the registration call if present)
- `server/src/server.ts` (remove `/metrics` route mount if present, remove `metricsAuth` middleware import)
- Any consumer file the type checker surfaces after deletion (consume tsc errors as the discovery oracle)
- `package.json` + lockfile (remove `prom-client`)

You may NOT touch:

- `server/src/middleware/performanceMonitor.ts` — this is request-scoped per-stage timing, used by the enhancement route. **Keep it.** It was incorrectly bundled with `MetricsService` in your mental model; they're separate.
- Anything in `server/src/services/observability/` (Tasks C and M3b territory)
- Anything in `server/src/services/prompt-optimization/` (already instrumented)
- Anything in `client/`

### Steps

1. **Inventory.** Run these greps and document what you find before deleting anything:

   ```bash
   git grep -l "MetricsService\|metricsService\|prom-client\|promClient" server/src/
   git grep -l "metricsAuth\|/metrics" server/src/
   git grep -n "import.*MetricsService\|import.*prom-client" server/src/
   ```

2. **Verify nothing depends on `MetricsService` semantically.** The infrastructure exists; the question is whether any code path _needs_ the histograms/counters to function. Specifically check:
   - Does `ConcurrencyLimiter` or `LLMClient` USE the metrics it emits, or just emit them for external scraping? (If it just emits, those emit calls become dead code that can be removed.)
   - Does any test assert on metrics output? (Those tests get deleted with the service.)
   - Does the `/metrics` route have auth or logging that other routes depend on? (Almost certainly no.)

3. **Delete in this order:**
   - The route file mounting `/metrics`
   - `metricsAuth.ts` middleware + its test
   - `MetricsService.ts`
   - Any DI registration of `metricsService` in `core.services.ts` and the call in `services.config.ts`
   - Imports in consumer files (let tsc tell you which) — replace `metricsService.recordX(...)` calls with no-ops or remove them entirely (prefer remove if the metric was the only consumer)

4. **Remove `prom-client` from `package.json`:**

   ```bash
   npm uninstall prom-client
   ```

5. **Run the integration test gate** (mandatory because DI config touched):

   ```bash
   PORT=0 npx vitest run tests/integration/bootstrap.integration.test.ts tests/integration/di-container.integration.test.ts --config config/test/vitest.integration.config.js
   ```

   Both must pass. If `bootstrap.integration.test.ts` was asserting `/metrics` returns 200, update or delete that assertion.

6. **Final verification:**

   ```bash
   npx tsc --noEmit
   npm run lint
   npm run test:unit
   ```

   All green.

### Commits

Suggested splits (one or two commits — your call based on diff size):

1. `chore(metrics): delete dead Prometheus instrumentation`
2. `chore(deps): remove prom-client dependency`

Pre-commit hook should pass without `--no-verify`.

### Expected output

Self-contained summary (under 400 words):

1. Each commit (SHA + subject)
2. Files deleted (full list)
3. Files modified (one-line per file)
4. Consumer files where you removed `metricsService.X` calls — these may have lost incidental behavior, flag if anything looked load-bearing
5. Final tsc / lint / test results
6. Worktree path and branch
7. Anything unexpected — particularly any code path that genuinely _needed_ the prom-client histograms

---

## Task C — Approach C extension (per-LLM-call telemetry events)

**Goal:** Emit one `llm.call.completed` event per `aiService.execute` invocation, capturing provider, model, duration, token counts, and dollar cost. Keeps `OptimizeTrace.llmCallCount` as a denormalized per-click summary; adds per-call detail as a queryable event type.

### Worktree setup (mandatory first step)

Same as Task A — `cd` into the worktree, rebase to main, verify baseline tsc=0.

### Critical context

- The `aiService` token resolves to an `AIExecutionPort` — find the implementation by `git grep -l "class.*implements.*AIExecutionPort\|class.*AIService" server/src/services/ai-model/`
- The `execute` method signature is roughly: `execute(executionType: string, params: ExecutionParams): Promise<ExecutionResponse>`
- `ExecutionResponse` includes `text`, `metadata: { model, provider, finishReason, usage: { promptTokens, completionTokens, ... } }` — verify by reading the existing types
- `modelConfig.ts` has a per-execution-type cost-per-token (or PostHog has it elsewhere). For Phase 1, capturing tokens is enough — exact dollar cost can be derived in PostHog queries later.

### Your scope

You may CREATE:

- `server/src/services/observability/LlmCallTelemetryService.ts`
- `server/src/services/observability/__tests__/LlmCallTelemetryService.test.ts`
- `server/src/services/observability/__tests__/llm-call-event-schema.snapshot.test.ts`

You may MODIFY:

- `server/src/services/observability/types.ts` (add `LlmCallEventProperties` type — append, don't restructure)
- `server/src/services/ai-model/AIModelService.ts` (or whichever class implements `AIExecutionPort.execute`) — wrap the `execute` body with telemetry
- `server/src/config/services/observability.services.ts` (append a new `container.register("llmCallTelemetryService", ...)` block)
- `server/src/config/services.config.ts` (no change needed if observability.services already registers everything inside `registerObservabilityServices`)

You may NOT touch:

- `server/src/services/observability/OptimizeTelemetryService.ts` — leave the `recordLlmCall()` count alone. The two systems coexist: optimize trace has the per-click count; this new service emits per-call detail.
- `server/src/services/prompt-optimization/workflows/optimizeFlow.ts` — the existing `t.recordLlmCall()` calls inside the flow stay. Don't replace them.
- Anything in `client/`, `tests/integration/`, or `server/src/infrastructure/MetricsService.ts` (Task A territory)

### Event schema — `llm.call.completed`

```ts
{
  event: "llm.call.completed",
  distinctId: <userId from request context, or "anon-<uuid>">,
  properties: {
    executionType: string,        // e.g., "image_observation", "i2v_motion_ideas", or the optimize-stage execution type
    provider: string,             // e.g., "openai", "groq", "gemini"
    model: string,                // e.g., "gpt-4o-mini-2024-07-18"
    durationMs: number,
    promptTokens: number | null,
    completionTokens: number | null,
    totalTokens: number | null,
    finishReason: string | null,  // e.g., "stop", "length", "tool_calls"
    outcome: "success" | "error",
    errorMessage?: string,
    requestId?: string,           // when available from request context (AsyncLocalStorage)
  },
}
```

### Implementation strategy

The `aiService.execute` method is the single chokepoint for all LLM calls. The cleanest pattern: **decorator inside the AIModelService implementation**.

Approximate shape:

```ts
// In AIModelService (or wherever execute is implemented):
async execute(executionType: string, params: ExecutionParams): Promise<ExecutionResponse> {
  const started = performance.now();
  let response: ExecutionResponse | null = null;
  let err: unknown = null;
  try {
    response = await this._executeUnderlying(executionType, params);
    return response;
  } catch (e) {
    err = e;
    throw e;
  } finally {
    // Fire-and-forget telemetry; never let it bubble up.
    try {
      this.llmCallTelemetry?.record({
        executionType,
        durationMs: performance.now() - started,
        provider: response?.metadata?.provider ?? null,
        model: response?.metadata?.model ?? null,
        promptTokens: response?.metadata?.usage?.promptTokens ?? null,
        completionTokens: response?.metadata?.usage?.completionTokens ?? null,
        totalTokens: response?.metadata?.usage?.totalTokens ?? null,
        finishReason: response?.metadata?.finishReason ?? null,
        outcome: err ? "error" : "success",
        errorMessage: err instanceof Error ? err.message : err ? String(err) : undefined,
      });
    } catch {
      // Telemetry must never throw upstream.
    }
  }
}
```

`LlmCallTelemetryService` is the simple wrapper around `IPostHogClient`:

```ts
export interface LlmCallSummary { /* the properties above */ }

export class LlmCallTelemetryService {
  constructor(private readonly client: IPostHogClient) {}
  record(summary: LlmCallSummary): void {
    // Determine distinctId — for now, use a static "system" or thread userId via AsyncLocalStorage if simple; otherwise just emit without userId.
    this.client.capture({ distinctId: summary.userId ?? "system", event: "llm.call.completed", properties: { ... } });
  }
}
```

> **Note on userId / requestId correlation:** ideal would be to tie each `llm.call.completed` to the parent `optimize.completed` via `requestId`. The cleanest path is `AsyncLocalStorage` — set the `requestId` in a request-scoped store at the top of the optimize route handler, read it from inside `aiService.execute`. **In-scope:** add the AsyncLocalStorage plumbing if it's not already there; or skip and emit without `requestId` if the wiring is non-trivial. Decide based on what you find. If you skip, document in your summary so a follow-up can add it.

### Steps

1. **Read** `AIExecutionPort` and the `AIModelService` (or equivalent) implementation. Document the actual `execute` signature and `ExecutionResponse` shape in your summary.

2. **TDD-style tests first** for `LlmCallTelemetryService`:
   - Emits one event per `record()` call with all fields populated
   - Swallows errors from the underlying `IPostHogClient.capture`
   - `executionType` and `outcome` always present; tokens may be null

3. **Implement** `LlmCallTelemetryService.ts` matching the test shape.

4. **Wrap** `AIModelService.execute` with the try/finally telemetry block. Constructor accepts `LlmCallTelemetryService` (optional — tests that construct AIModelService directly should still work).

5. **DI registration** — append to `observability.services.ts`:

   ```ts
   container.register(
     "llmCallTelemetryService",
     (postHogClient: IPostHogClient) =>
       new LlmCallTelemetryService(postHogClient),
     ["postHogClient"],
   );
   ```

   And update the AIModelService DI registration to inject the new service. Find via `git grep -n "AIModelService" server/src/config/services/`.

6. **Schema snapshot test** at `__tests__/llm-call-event-schema.snapshot.test.ts` — same pattern as `optimize-event-schema.snapshot.test.ts`. Locks the contract.

7. **Verification:**

   ```bash
   npx tsc --noEmit
   npx eslint --config config/lint/eslint.config.js [touched paths] --quiet
   npx vitest run server/src/services/observability server/src/services/ai-model --config config/test/vitest.unit.config.js
   PORT=0 npx vitest run tests/integration/bootstrap.integration.test.ts tests/integration/di-container.integration.test.ts --config config/test/vitest.integration.config.js
   ```

   All green.

### Commits

Suggested:

1. `feat(observability): types for LlmCallTelemetryService`
2. `test(observability): unit tests for LlmCallTelemetryService` (`--no-verify` if TDD red-phase)
3. `feat(observability): LlmCallTelemetryService implementation`
4. `feat(observability): emit llm.call.completed from aiService.execute`
5. `feat(di): register LlmCallTelemetryService` (or fold into 3 if small)
6. `test(observability): schema snapshot for llm.call.completed`

### Expected output

Self-contained summary (under 600 words):

1. Each commit (SHA + subject)
2. The actual `AIExecutionPort.execute` signature you found
3. The `ExecutionResponse.metadata` shape (so the orchestrator can verify the property mapping is correct)
4. Whether you wired AsyncLocalStorage for `requestId` correlation, or skipped it
5. Final tsc / lint / test results
6. Worktree path and branch
7. Anything unexpected

---

## Task M3b — Suggestions / enhance endpoints telemetry

**Goal:** Mirror the optimize-side instrumentation for the `/api/suggestions` and `/api/get-enhancement-suggestions` endpoints. Emit `suggestions.completed` events per request with stage-level timing and outcome.

### Worktree setup

Same as Task A.

### Critical context

- The suggestion flow lives in `server/src/services/enhancement/EnhancementService.ts` (~580 lines). Its main public method is `getEnhancementSuggestions(params)`.
- The route handler is `server/src/routes/enhancement/enhancementSuggestionsRoute.ts`.
- The pipeline has measurable stages — see `server/src/services/enhancement/services/EnhancementMetricsService.ts` and `EnhancementV2Engine.ts` for hints. Likely stages: cache check, span context build, V2 candidate generation, validation, dedup. Read the EnhancementService class to confirm.
- Pattern to mirror: `OptimizeTelemetryService` + `OptimizeTrace` from `server/src/services/observability/`.

### Your scope

You may CREATE:

- `server/src/services/observability/SuggestionsTelemetryService.ts`
- `server/src/services/observability/__tests__/SuggestionsTelemetryService.test.ts`
- `server/src/services/observability/__tests__/suggestions-event-schema.snapshot.test.ts`

You may MODIFY:

- `server/src/services/observability/types.ts` (append types — don't restructure existing ones)
- `server/src/services/enhancement/EnhancementService.ts` (accept a trace, instrument stages)
- `server/src/services/enhancement/services/types.ts` (add `trace?: SuggestionsTrace` to the request params type)
- `server/src/routes/enhancement/enhancementSuggestionsRoute.ts` (create + thread the trace)
- The route registration site that wires the suggestions route (find via `git grep -n "registerEnhancementSuggestionsRoute\|enhancementSuggestionsRoute" server/src/`)
- `server/src/config/services/observability.services.ts` (append registration)

You may NOT touch:

- `server/src/services/observability/OptimizeTelemetryService.ts` (Task C territory — and unrelated)
- `server/src/services/prompt-optimization/` (already instrumented)
- `server/src/services/ai-model/` (Task C territory)
- `server/src/infrastructure/MetricsService.ts` (Task A territory)
- Anything in `client/`

### Event schema — `suggestions.completed`

```ts
{
  event: "suggestions.completed",
  distinctId: <userId from request context, or "anon-<uuid>">,
  properties: {
    requestId: string,
    userId: string | null,
    outcome: "success" | "error" | "aborted",
    errorMessage?: string,
    errorStage?: string,                // e.g., "cache" | "span_context" | "v2_engine" | "validation" | "dedup"
    durationMs: number,
    cacheHit: boolean,
    suggestionCount: number,            // length of returned suggestions array
    highlightedCategory: string | null, // e.g., "lighting", "subject.action"
    promptLength: number,
    debug: boolean,
    stages: {
      cacheCheckMs: number | null,
      spanContextMs: number | null,
      v2EngineMs: number | null,        // if V2 engine ran
      validationMs: number | null,
      dedupMs: number | null,
    },
  },
}
```

### Implementation pattern

Mirror `OptimizeTelemetryService` exactly — the structure is the same:

```ts
// SuggestionsTelemetryService.ts
export class SuggestionsTrace {
  // recordStage, recordCacheHit, recordError, complete — same shape
}

export class SuggestionsTelemetryService {
  constructor(private readonly client: IPostHogClient) {}
  startSuggestionsTrace(requestId: string, userId: string | null): SuggestionsTrace { ... }
}
```

Wire identically:

- Route handler creates trace from `req.id` + `extractUserId(req)`, passes into `enhancementService.getEnhancementSuggestions({ ..., trace })`
- `EnhancementService` accepts `trace?: SuggestionsTrace` (optional, with no-op fallback)
- Stage timing wraps each named stage with `try / finally / t.recordStage(...)`
- `t.complete({...})` in success and error paths

### Steps

Same shape as Task C:

1. Read `EnhancementService.getEnhancementSuggestions` to identify stage boundaries — document them in your summary
2. Add types to `observability/types.ts` (append)
3. Failing tests → implementation → schema snapshot
4. Thread trace through `EnhancementService` and the route handler
5. DI registration
6. Verification

### Commits

Suggested:

1. `feat(observability): types for SuggestionsTelemetryService`
2. `test(observability): unit tests for SuggestionsTelemetryService` (`--no-verify` if TDD red-phase)
3. `feat(observability): SuggestionsTelemetryService implementation`
4. `feat(enhancement): instrument suggestions flow with telemetry`
5. `feat(enhancement-route): create + pass SuggestionsTrace from route handler`
6. `feat(di): register SuggestionsTelemetryService`
7. `test(observability): schema snapshot for suggestions.completed`

### Verification

```bash
npx tsc --noEmit
npm run lint
npx vitest run server/src/services/observability server/src/services/enhancement server/src/routes/enhancement --config config/test/vitest.unit.config.js
PORT=0 npx vitest run tests/integration/bootstrap.integration.test.ts tests/integration/di-container.integration.test.ts --config config/test/vitest.integration.config.js
```

All must pass.

### Expected output

Self-contained summary (under 600 words):

1. Each commit (SHA + subject)
2. The actual stage boundaries you found inside `getEnhancementSuggestions` (so the orchestrator can validate the schema matches reality)
3. Any additional dimensions you decided to capture beyond the brief (e.g., model recommendation IDs, V2 policy version, candidate scorer version)
4. Final tsc / lint / test results
5. Worktree path and branch
6. Anything unexpected

---

## Orchestrator merge plan (after all three agents return)

1. **Cherry-pick Task A first** (cleanup) — its commits don't conflict with anything since it touches `MetricsService` exclusively. After merge, run `npx tsc --noEmit` to verify the deletion is clean.

2. **Cherry-pick Task C second** (LLM call telemetry). Expect potential conflicts in:
   - `server/src/config/services/observability.services.ts` (new registration block)
   - `server/src/services/observability/types.ts` (new exported types)
   - `server/src/config/services.config.ts` (only if Task C added a new register call rather than appending to `registerObservabilityServices`)

   Resolve by accepting both insertions side-by-side.

3. **Cherry-pick Task M3b third**. Same conflict zones as Task C; same resolution.

4. **Final verification:** full repo gates (`tsc --noEmit`, `npm run lint`, `npm run test:unit`, integration test gate).

5. **Update `docs/architecture/observability.md`** to add sections for:
   - `llm.call.completed` event schema (from Task C output)
   - `suggestions.completed` event schema (from M3b output)
   - The fact that `prom-client` is gone (from Task A output)

6. **Verify all three event types are flowing in PostHog** by firing one Optimize click and one Suggestions click in production (or local dev with `POSTHOG_API_KEY` set), then querying:

   ```sql
   SELECT event, count() FROM events
   WHERE event IN ('optimize.completed', 'llm.call.completed', 'suggestions.completed')
     AND timestamp >= now() - interval 1 hour
   GROUP BY event
   ```

7. **Build follow-up dashboard tiles** for the new event types — extend the existing `T2V Optimize Health` dashboard with:
   - LLM call cost-per-click (from `llm.call.completed.totalTokens × cost-per-token` derived metric)
   - Per-provider duration distribution (from `llm.call.completed.provider × durationMs`)
   - Suggestions latency over time (from `suggestions.completed.durationMs`)
   - Suggestions cache hit rate (from `suggestions.completed.cacheHit`)
