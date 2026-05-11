# Source Discriminator + Synthetic Harness — Design Spec

**Date:** 2026-05-10
**Program:** Sub-project #1 of the [Measurement Program](../programs/measurement.md)
**Estimate:** 3–4 days
**Branch:** off `main`
**Feature flag:** none — gated by `POSTHOG_API_KEY` presence (matches existing server convention)

---

## 0. Why

**Vidra has zero real users today.** Per the [Operating context](../programs/measurement.md#operating-context-read-this-first) of the Measurement Program, the entire program exists to validate quality _before_ launch — there is no organic traffic to learn from. The only signals available pre-launch are deterministic eval data (sub-project #0, shipped) and synthetic operational traffic (this sub-project).

Three problems compound:

1. **The shipped operational telemetry has no data flowing.** `optimize.completed`, `suggestions.completed`, and `llm.call.completed` events emit when called — but with no real users and no synthetic source, the dashboards (and `suggestions.completed` has none at all) sit empty.
2. **Per-component measurement is not possible.** Today there is no way to ask "is span suggestion working today?" or "is the constitutional LLM stage slower than last week?" — the events exist, the per-component views do not.
3. **When real users do arrive, their data will already be polluted** by whatever dev / CI / pre-launch testing traffic landed on the same dashboards. Retroactively cleaning that up is harder than tagging it from day one.

This sub-project ships three things together because they only validate each other in combination: a `source` discriminator stamped on every operational event, a synthetic-traffic harness that drives the three currently-instrumented surfaces independently, and three new per-component dashboards (Suggestions, Span Labeling, LLM Calls) so the data the harness produces is actually readable.

---

## 1. Locked architectural decisions

| Decision           | Choice                                                                                                                     | Reason                                                                                                                                                                                                                                   |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Source enum        | **5 values:** `user`, `synthetic`, `ci`, `dev`, `unknown`                                                                  | Dogfood deferred — no real users to distinguish from yet. Adding `dogfood` later is half a day of work (enum + env var + middleware check); no need to pre-build.                                                                        |
| Source resolution  | Header (`X-Telemetry-Source`) > `CI=true` env > `NODE_ENV` fallback                                                        | Explicit always wins over inference. `unknown` only appears in production when a real-user request omits the header — a bug signal worth alerting on.                                                                                    |
| Source threading   | **AsyncLocalStorage via existing `requestContext`** — `PostHogClient.capture()` auto-stamps `source` on every event        | Cross-cutting concern handled at infrastructure layer, not per-call-site. Future sub-project surfaces inherit source for free. Mirrors how `requestId` already works.                                                                    |
| Synthetic auth     | **Anonymous requests** — no Firebase service account                                                                       | Optimize / Suggestions / Span Labeling all accept anonymous calls (`userId: null` path is exercised today). No service account creation, no GitHub auth secret, no token minting in the harness.                                         |
| New surface event  | **`label-spans.completed`** — instrument `/llm/label-spans` end-to-end                                                     | Span labeling is one of the three "prompt-editing core" surfaces; today only its underlying `llm.call.completed` events fire, not a surface-level event. Pulled forward from sub-project #2 because per-component measurement needs it.  |
| Harness scope      | **Three surfaces:** Optimize, Suggestions, Span Labeling                                                                   | Matches the prompt-editing core named explicitly. Render-time surfaces (Preview, Motion, Generation, Continuity, Model Intelligence) stay deferred to #2.                                                                                |
| Harness execution  | **Local CLI + GitHub Actions workflow** (cron initially disabled — see "Target environment" below)                         | Local for manual runs; CI workflow committed but scheduled run gated until a stable target URL exists. Mirrors `span-labeling-eval.yml` cron pattern from #0.                                                                            |
| Target environment | `VIDRA_API_URL` env var configures harness target; **no production deploy exists yet**                                     | Vidra is not yet deployed (per observability.md follow-ups). Locally the harness runs against `http://localhost:3001`. The CI cron stays disabled until a deployed URL (staging or prod) is wired through `VIDRA_API_URL` repo variable. |
| Dashboards         | **3 new + 1 modified**: Suggestions Health, Span Labeling Health, LLM Calls Health (all new); T2V Optimize Health (filter) | Each surface gets a dedicated dashboard so "is this piece working" is one click. LLM Calls Health surfaces per-`executionType` breakdown so individual LLM hops are independently measurable.                                            |
| Failure mode       | Best-effort. Source resolution never throws; PostHogClient already swallows capture errors.                                | Telemetry must not break user-facing paths.                                                                                                                                                                                              |
| `unknown` alerting | Alert on `unknown > 1%` of `optimize.completed` events in prod                                                             | First real signal that frontend header plumbing has regressed.                                                                                                                                                                           |

---

## 2. The contract

### 2.1 Source type

```typescript
// shared/types/telemetry.ts (new)
export type TelemetrySource =
  | "user" // Real authenticated or anonymous browser user (frontend sets header in prod builds)
  | "synthetic" // Pre-launch harness traffic
  | "ci" // CI job exercising real endpoints
  | "dev" // NODE_ENV !== "production" and no override
  | "unknown"; // NODE_ENV === "production" fallback — bug signal
```

Lives in `shared/` because the frontend interceptor and server middleware both reference it. Pure data, no I/O — fits the [shared layer rule](../../../CLAUDE.md#frontend-backend-decoupling).

### 2.2 Updated event schemas

Every operational event gains a `source: TelemetrySource` property at the top of `properties`. Existing snapshot tests for `optimize.completed` and `suggestions.completed` update to include it. The `llm.call.completed` event gets a snapshot test added (it currently has none — closes the gap noted in [`observability.md`](../../architecture/observability.md#per-llm-call-telemetry-llmcallcompleted)).

### 2.3 New surface event `label-spans.completed`

Emitted once per `/llm/label-spans` request by a new `SpanLabelingTelemetryService`, mirroring `SuggestionsTelemetryService.SuggestionsTrace.complete`.

```typescript
{
  event: "label-spans.completed",
  distinctId: string,                    // userId or "anon-<uuid>"
  timestamp: ISO8601,
  properties: {
    requestId: string,
    userId: string | null,
    source: TelemetrySource,             // stamped automatically by PostHogClient wrapper
    outcome: "success" | "error",
    errorMessage?: string,
    errorStage?: "validation" | "llm_call" | "cache" | "post_processing",
    durationMs: number,
    promptLength: number,
    spanCount: number,                   // labeled spans returned
    cacheHit: boolean,
    provider: "openai" | "groq" | null,  // null on early failure
    model: string | null,
  },
}
```

Schema locked by `__tests__/label-spans-event-schema.snapshot.test.ts`.

### 2.4 Resolution priority

```
1. X-Telemetry-Source: user | synthetic | ci     (header explicit)
2. process.env.CI === "true"                     → "ci"
3. process.env.NODE_ENV === "production"         → "unknown"
4. fallback                                      → "dev"
```

Invalid header values (anything outside the allowed set) are ignored, falling through to the env-based rules.

---

## 3. Architecture

### 3.1 File inventory

```
shared/
  types/telemetry.ts                                           (NEW)
                                                               — TelemetrySource type

server/src/
  middleware/
    telemetrySource.ts                                         (NEW)
                                                               — telemetrySourceMiddleware: resolves source, extends requestContext ALS
  utils/
    requestContext.ts                                          (MODIFIED)
                                                               — RequestContext type widens from { requestId } to { requestId, source }
  infrastructure/
    PostHogClient.ts                                           (MODIFIED)
                                                               — capture() reads source from ALS, stamps properties.source
                                                               — Defaults to "unknown" when no context (out-of-request emissions)
  services/observability/
    SpanLabelingTelemetryService.ts                            (NEW)
                                                               — SpanLabelingTrace.complete() emits label-spans.completed
    __tests__/
      label-spans-event-schema.snapshot.test.ts                (NEW)
      llm-call-event-schema.snapshot.test.ts                   (NEW)
      optimize-event-schema.snapshot.test.ts                   (MODIFIED — source added)
      suggestions-event-schema.snapshot.test.ts                (MODIFIED — source added)
  config/services/
    core.services.ts                                           (MODIFIED — minor)
                                                               — Registers spanLabelingTelemetryService alongside the existing two
  routes/
    labelSpansRoute.ts                                         (MODIFIED)
                                                               — Constructs SpanLabelingTrace, threads through llm/span-labeling service, calls .complete() in try/finally
  app.ts                                                       (MODIFIED)
                                                               — Mounts telemetrySourceMiddleware after requestIdMiddleware

client/src/
  services/http/
    TelemetrySourceInterceptor.ts                              (NEW)
                                                               — Build-time check on import.meta.env.MODE; sets X-Telemetry-Source: user in production builds
    AuthInterceptors.ts                                        (MODIFIED — minor)
                                                               — Add registration line so the interceptor is wired alongside auth

scripts/synthetic/
  run-harness.ts                                               (NEW)
                                                               — CLI entry point; parses target URL + which surfaces to drive
  drivers/
    optimize.driver.ts                                         (NEW)
    suggestions.driver.ts                                      (NEW)
    span-labeling.driver.ts                                    (NEW)
  fixtures/
    prompts.json                                               (NEW — 20 canonical prompts covering span taxonomy categories)
  utils/
    request-helper.ts                                          (NEW)
                                                               — Builds requests with X-Telemetry-Source: synthetic; no auth header

.github/workflows/
  synthetic-harness.yml                                        (NEW)
                                                               — Cron 08:00 UTC daily; runs scripts/synthetic/run-harness.ts against production
                                                               — Inherits POSTHOG_API_KEY repo secret (added in #0)
```

### 3.2 Source resolution middleware

```typescript
// server/src/middleware/telemetrySource.ts
import type { Request, Response, NextFunction } from "express";
import type { TelemetrySource } from "#shared/types/telemetry";
import {
  getRequestContext,
  runWithRequestContext,
} from "../utils/requestContext";

const HEADER_NAME = "x-telemetry-source";
const HEADER_ALLOWED = new Set<TelemetrySource>(["user", "synthetic", "ci"]);

function resolveSource(req: Request): TelemetrySource {
  const raw = req.headers[HEADER_NAME];
  const candidate = Array.isArray(raw) ? raw[0] : raw;
  if (
    typeof candidate === "string" &&
    HEADER_ALLOWED.has(candidate as TelemetrySource)
  ) {
    return candidate as TelemetrySource;
  }
  if (process.env.CI === "true") return "ci";
  return process.env.NODE_ENV === "production" ? "unknown" : "dev";
}

export function telemetrySourceMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  const existing = getRequestContext();
  const source = resolveSource(req);
  runWithRequestContext(
    { ...existing, requestId: existing?.requestId ?? "", source },
    () => next(),
  );
}
```

Mounted in `app.ts` directly after `requestIdMiddleware`, so the `requestId` is already in ALS when source is added.

### 3.3 PostHogClient wrapper change

```typescript
// server/src/infrastructure/PostHogClient.ts (modified excerpt)
class PostHogClientReal implements IPostHogClient {
  capture(args: CaptureArgs): void {
    try {
      const ctx = getRequestContext();
      const source = ctx?.source ?? "unknown";
      this.client.capture({
        ...args,
        properties: { source, ...args.properties }, // source placed first; existing props win on collision
      });
    } catch {
      // never throw upstream
    }
  }
}
```

The no-op stub is unchanged. The collision rule (`existing props win`) means a call site that explicitly passes `properties.source` (e.g., a hypothetical future override) keeps its value.

### 3.4 Synthetic harness structure

```typescript
// scripts/synthetic/run-harness.ts (sketch)
async function main() {
  const config = parseArgs(); // --surfaces (default: all three), --runs (default: 1 per prompt)
  const prompts = loadPrompts(); // 20 from fixtures/prompts.json
  const baseUrl = process.env.VIDRA_API_URL ?? "http://localhost:3001";
  if (!process.env.VIDRA_API_URL) {
    console.warn("VIDRA_API_URL not set — defaulting to local dev server.");
  }

  const results = await Promise.all([
    config.surfaces.includes("optimize")
      ? driveOptimize(baseUrl, prompts)
      : Promise.resolve(null),
    config.surfaces.includes("suggestions")
      ? driveSuggestions(baseUrl, prompts)
      : Promise.resolve(null),
    config.surfaces.includes("span-labels")
      ? driveSpanLabels(baseUrl, prompts)
      : Promise.resolve(null),
  ]);

  reportSummary(results);
}
```

Target URL is fully env-driven. The CI workflow sets `VIDRA_API_URL` once a stable target exists; until then the workflow is committed but its `schedule:` trigger is commented out.

Each driver:

- Iterates the 20 fixture prompts
- Fires a request with `X-Telemetry-Source: synthetic` (no auth header — anonymous path)
- Logs per-request outcome (success/error, durationMs) to stdout for CI log diagnostics
- Returns a summary object

Volume per nightly run: 3 surfaces × 20 prompts = 60 requests. Negligible LLM cost (Groq fast model for span labeling and suggestions; OpenAI for optimize stages but small per-request).

---

## 4. Tests

| Test                                                 | Asserts                                                                                                                          |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `telemetrySource.integration.test.ts`                | Each of the 5 source values resolves correctly across header / env permutations. Invalid header → falls through.                 |
| `posthog-source-stamping.integration.test.ts`        | Capture inside a request stamps `properties.source` from ALS. Capture outside a request defaults to `"unknown"`.                 |
| `optimize-event-schema.snapshot.test.ts` (update)    | `source` property present in expected shape.                                                                                     |
| `suggestions-event-schema.snapshot.test.ts` (update) | `source` property present in expected shape.                                                                                     |
| `label-spans-event-schema.snapshot.test.ts` (new)    | New event schema locked in PR diffs.                                                                                             |
| `llm-call-event-schema.snapshot.test.ts` (new)       | Closes the existing snapshot-coverage gap for this event.                                                                        |
| `synthetic-harness.smoke.test.ts` (new)              | Harness against a mocked HTTP layer: emits exactly 60 requests with `X-Telemetry-Source: synthetic`; zero with any other source. |

Pre-existing tests for the three telemetry services must still pass — `source` is purely additive.

### Harness validation (post-deploy, not a code test)

After the first nightly run, the following HogQL query must return zero rows:

```sql
SELECT * FROM events
WHERE event IN ('optimize.completed', 'suggestions.completed', 'label-spans.completed', 'llm.call.completed')
  AND distinctId LIKE 'synthetic-%'   -- only events from the harness
  AND properties.source != 'synthetic' -- but tagged as anything other than synthetic
  AND timestamp > now() - INTERVAL 1 HOUR
```

A non-zero result means the header was not picked up by the middleware for the harness's traffic — investigate before declaring done.

---

## 5. Dashboards

Built via PostHog MCP after the first nightly harness run produces events. Same pattern as Eval Health from #0.

### 5.1 T2V Optimize Health (existing `1565688`) — modified

Add a global filter `properties.source = 'user'` at dashboard level so the default view excludes synthetic traffic. Create a sibling dashboard "T2V Optimize — Synthetic Health" with `properties.source = 'synthetic'` to verify harness behavior independently.

### 5.2 Suggestions Health (new)

| Tile                                | Source                                      |
| ----------------------------------- | ------------------------------------------- |
| Duration over time (avg / p95)      | `suggestions.completed`                     |
| Cache hit rate                      | `suggestions.completed`                     |
| Outcome breakdown (donut)           | `suggestions.completed`                     |
| Errors by `errorStage`              | `suggestions.completed` where error         |
| Suggestions returned (distribution) | `suggestions.completed.suggestionCount`     |
| Per-category breakdown              | `suggestions.completed.highlightedCategory` |
| Recent 50 calls (table)             | `suggestions.completed` (sorted desc)       |

### 5.3 Span Labeling Health (new)

| Tile                             | Source                                |
| -------------------------------- | ------------------------------------- |
| Duration over time (avg / p95)   | `label-spans.completed`               |
| Cache hit rate                   | `label-spans.completed`               |
| Outcome breakdown                | `label-spans.completed`               |
| Span count distribution          | `label-spans.completed.spanCount`     |
| Provider breakdown (openai/groq) | `label-spans.completed.provider`      |
| Errors by `errorStage`           | `label-spans.completed` where error   |
| Recent 50 calls                  | `label-spans.completed` (sorted desc) |

### 5.4 LLM Calls Health (new)

| Tile                                    | Source                                      |
| --------------------------------------- | ------------------------------------------- |
| Calls by `executionType` over time      | `llm.call.completed` GROUP BY executionType |
| p95 latency by `executionType`          | `llm.call.completed`                        |
| Error rate by `executionType`           | `llm.call.completed`                        |
| Total tokens by `executionType`         | `llm.call.completed.totalTokens`            |
| Token cost estimate by provider × model | `llm.call.completed`                        |

Tile IDs documented in [`docs/architecture/observability.md`](../../architecture/observability.md) after creation.

---

## 6. Alerts

| Alert                            | Trigger                                                                                                                         | Severity | Status                    |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | -------- | ------------------------- |
| Source `unknown` in production   | Among `optimize.completed` events with `distinctId NOT LIKE 'synthetic-%'`, share with `source = 'unknown'` exceeds 1% over 24h | warn     | Active                    |
| Synthetic harness silent         | Count of events with `distinctId LIKE 'synthetic-%'` over 24h is zero (only meaningful once the CI cron is enabled)             | critical | Deferred until cron is on |
| Per-`executionType` error spike  | Any `executionType` error rate > 10% over 1h                                                                                    | warn     | Deferred                  |
| Span Labeling cache hit collapse | Cache hit rate drops below 50% rolling 6h average                                                                               | warn     | Deferred                  |

The two active alerts are essential: `unknown` detects frontend plumbing regression, and "harness silent" detects that the nightly workflow stopped firing (the most common failure mode for scheduled jobs). The two deferred alerts require sufficient data accumulation to set sensible thresholds.

Same constraint from #0 applies: PostHog alert engine only fires on `TrendsQuery` insights, not HogQL. Dashboard tiles and alert sources are parallel insights.

---

## 7. Implementation flow

Suggested PR sequence:

1. **`shared/types/telemetry.ts` + middleware + PostHogClient wrapper + existing snapshot updates** — adds source plumbing. No new event yet; existing three events gain the property.
2. **`SpanLabelingTelemetryService` + `label-spans.completed` event + snapshot test + route wiring** — new surface event lands.
3. **`llm-call-event-schema.snapshot.test.ts`** — closes the snapshot coverage gap. Tiny PR.
4. **Frontend `TelemetrySourceInterceptor`** — production builds send the user header.
5. **Synthetic harness script + fixtures + GitHub workflow** — harness runs.
6. **Dashboard creation + `observability.md` update** — no-code PR documenting tile IDs.

Each PR passes `tsc --noEmit`, `npm run lint`, `npm run test:unit`. PRs 1, 2, 4 trigger the [Integration Test Gate](../../../CLAUDE.md#integration-test-gate-service-changes) because they touch DI / middleware / PostHogClient surfaces.

---

## 8. Out of scope

- **`dogfood` source value.** No real users to distinguish from yet; defer until users arrive. Half-day to add later (enum value + `DOGFOOD_UIDS` env var + middleware check).
- **Render-time surfaces.** Preview, Motion, Generation, Continuity, Model Intelligence stay in sub-project #2. The source plumbing built here means they each only need their own surface event + dashboard; no source-plumbing rework.
- **LLM cost dashboards.** `llm.call.completed` already carries tokens; a per-provider cost tile is on the LLM Calls Health dashboard but full cost reporting (e.g., monthly burn rate per surface) is downstream.
- **Anonymous user identity stability.** Each synthetic-harness run uses a fresh `anon-<uuid>`; we do not pin a synthetic user identity. If session-level analysis becomes important, pin a stable distinctId per run.
- **Load testing.** The harness fires 60 sequential requests/night, not concurrent floods. Performance-under-load is a separate concern.
- **Replacing the eval cron's `runId` convention.** The harness uses its own `distinctId` pattern (`synthetic-<GITHUB_RUN_ID>` when in CI, `synthetic-local-<username>` locally).

---

## 9. Risks

| Risk                                                                 | Likelihood | Mitigation                                                                                                                                                                            |
| -------------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ALS context loss across async boundaries (e.g., setTimeout, streams) | Medium     | All current telemetry call sites are awaited in-request. Add an integration test that fires a request, awaits a microtask boundary, captures inside it, asserts source still present. |
| Frontend interceptor regression silently drops source on user calls  | Medium     | The `unknown > 1%` alert catches this within 24h of regression.                                                                                                                       |
| Harness drift — fixture prompts become unrepresentative              | Medium     | Refresh fixtures when span taxonomy changes meaningfully. Document the refresh process in `scripts/synthetic/README.md`.                                                              |
| GitHub Actions workflow stops firing (cron silently disabled)        | Medium     | "Synthetic harness silent" alert catches this within 24h (only meaningful once cron is enabled — see next row).                                                                       |
| No production deploy exists yet — CI cron has no target              | High       | Acknowledged: CI cron is committed but disabled until `VIDRA_API_URL` points at a deployed environment. Local harness is fully usable today; CI value materializes when deploy lands. |
| Anonymous path changes (some endpoint starts requiring auth)         | Low        | Harness errors loudly on 401; CI workflow fails the run. Existing snapshot tests on telemetry would also fail if auth-required.                                                       |
| PostHog ingestion lag delays validation                              | Low        | Same as #0: post-merge harness-validation HogQL query allows a 1h window before declaring failure.                                                                                    |
| `source` collision with future telemetry needs                       | Low        | The collision rule ("explicit `properties.source` wins") leaves a future override path open.                                                                                          |
| Production frontend deployment that fails to set the header          | Medium     | The `unknown > 1%` alert is the first signal. Mitigation: snapshot-test the interceptor registration in the client build output.                                                      |

---

## 10. Success criteria

- Every `optimize.completed`, `suggestions.completed`, `llm.call.completed`, `label-spans.completed` event in PostHog carries a `source` property with one of the 5 allowed values; snapshot tests pin the schema.
- A local harness run (`npm run synthetic` against `http://localhost:3001`) produces ≥ 60 surface-level events (`optimize.completed` + `suggestions.completed` + `label-spans.completed`) tagged `source = "synthetic"` per run, plus the corresponding `llm.call.completed` events that fall out of those.
- The three new dashboards (Suggestions Health, Span Labeling Health, LLM Calls Health) exist with the tile inventories in § 5 and show data from the local harness run.
- The T2V Optimize Health dashboard's default view filters out synthetic traffic; the sibling "T2V Optimize — Synthetic" dashboard shows only synthetic.
- The `unknown`-in-production alert is wired and has been verified with a forced-regression test (e.g., disable the frontend interceptor in a test build, confirm alert fires). The "harness silent" alert is wired but stays inactive until the CI cron is enabled.
- Zero impact to existing user-facing behavior: no new dependency on auth, no change to response shapes, no perf regression > 5ms p95 on any instrumented surface.
- `docs/architecture/observability.md` updated with `label-spans.completed` schema, the `source` property documented on the existing three events, and tile IDs for the three new dashboards.
