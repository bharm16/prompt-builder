# Observability

This document tracks where production telemetry lives and how to query it.

## T2V Optimize Health (PostHog)

**Project:** [Default project (id `417445`)](https://us.posthog.com/project/417445) inside the **Vidra** organization (slug `vidra`). This project is dedicated to backend optimize-pipeline telemetry — separate from the NextReel org's `Default project` (id `399973`) which receives client-side product analytics.

**Dashboard:** [T2V Optimize Health (id `1565688`)](https://us.posthog.com/project/417445/dashboard/1565688)

**What it answers:** where is the time going on each `/api/optimize` call, what's the LLM call count, cache hit rate, outcome distribution, and per-model latency.

### Tiles

| Tile                              | Insight ID | URL                                                             |
| --------------------------------- | ---------- | --------------------------------------------------------------- |
| Optimize duration over time (avg) | `bzjLNbOL` | [view](https://us.posthog.com/project/417445/insights/bzjLNbOL) |
| Per-stage avg latency             | `0kIMg93G` | [view](https://us.posthog.com/project/417445/insights/0kIMg93G) |
| Outcome breakdown                 | `vlokRJzW` | [view](https://us.posthog.com/project/417445/insights/vlokRJzW) |
| LLM calls per Optimize click      | `oGToOJ17` | [view](https://us.posthog.com/project/417445/insights/oGToOJ17) |
| Cache hit rate                    | `XoNJNWiQ` | [view](https://us.posthog.com/project/417445/insights/XoNJNWiQ) |
| Avg duration by target model      | `rJ3JVWWL` | [view](https://us.posthog.com/project/417445/insights/rJ3JVWWL) |
| Recent Optimize calls (last 50)   | `GetT3sOp` | [view](https://us.posthog.com/project/417445/insights/GetT3sOp) |

### Event schema (`optimize.completed`)

Emitted once per `/api/optimize` call by `OptimizeTelemetryService` (see `server/src/services/observability/OptimizeTelemetryService.ts`). The schema is locked by a snapshot test at `server/src/services/observability/__tests__/optimize-event-schema.snapshot.test.ts` — changes to the property set are visible in PR diffs.

Top-level event properties:

- `requestId` — `req.id`, correlation key for cross-system traces
- `userId` — Firebase UID, or `null` for anonymous (matched by `distinctId = "anon-<uuid>"`)
- `outcome` — `"success" | "error" | "aborted"`
- `errorMessage` / `errorStage` — present only when `outcome !== "success"`
- `durationMs` — wall-clock end-to-end (integer ms)
- `llmCallCount` — incremented at each `aiService.execute` call site within `optimizeFlow.ts`
- `cacheHit` — boolean; when `true`, all `stages.*` are `null`
- `targetModel` — the requested compilation target (e.g. `"sora-2"`, `"kling-2.5"`); `null` for generic optimization
- `mode` — currently always `"video"`
- `promptLength`, `outputLength`, `lockedSpanCount`, `hasContext`, `hasBrainstormContext`, `hasShotPlan`, `useConstitutionalAI` — input-shape dimensions for cohort analysis
- `stages` — nested object of per-stage timings (or `null` if the stage was skipped):
  - `shotInterpreterMs`, `strategyOptimizeMs`, `constitutionalMs`, `intentLockMs`, `compilationMs`, `promptLintMs`

### Configuration

Telemetry is gated by the presence of `POSTHOG_API_KEY` in the server environment. When unset, `OptimizeTelemetryService` uses a no-op stub and no events are emitted — local dev works unchanged.

| Environment | `POSTHOG_API_KEY`                                               | `POSTHOG_HOST`             |
| ----------- | --------------------------------------------------------------- | -------------------------- |
| Local dev   | unset (no-op) — or set to the Vidra project key for testing     | `https://us.i.posthog.com` |
| Staging     | unset (decide before staging deploy)                            | n/a                        |
| Production  | set to the Vidra `Default project` key (begins `phc_pmJDnB...`) | `https://us.i.posthog.com` |

The full key lives in your `.env`; PostHog rotates `phc_` keys via the Settings UI if compromise is suspected.

### How to query

Use the PostHog MCP (`mcp__posthog__query-run` with a `HogQLQuery`) or the PostHog SQL editor. Example:

```sql
SELECT
  toStartOfDay(timestamp) AS day,
  avg(properties.durationMs) AS avg_ms,
  quantile(0.95)(properties.durationMs) AS p95_ms,
  count() AS calls
FROM events
WHERE event = 'optimize.completed'
GROUP BY day
ORDER BY day DESC
LIMIT 30
```

Make sure the MCP is in the right project context first:

```
mcp__posthog__switch-organization 019e1071-cc96-0000-e1ef-1ccfb297b6c0  # Vidra
mcp__posthog__switch-project       417445                                 # Default project
```

### Related design docs

- Spec: [`docs/superpowers/specs/2026-05-09-t2v-optimize-telemetry-design.md`](../superpowers/specs/2026-05-09-t2v-optimize-telemetry-design.md)
- Implementation plan: [`docs/superpowers/plans/2026-05-09-t2v-optimize-telemetry.md`](../superpowers/plans/2026-05-09-t2v-optimize-telemetry.md)

### Open follow-ups

- ✅ **Approach C — per-LLM-call events** — done; see "Per-LLM-call telemetry (`llm.call.completed`)" below.
- ✅ **M3b — suggestions / enhance endpoints** — done; see "Suggestions telemetry (`suggestions.completed`)" below.
- ✅ **Prom-client cleanup** — done in `9d9698a5`. The `/metrics` and `/stats` endpoints and `MetricsService.ts` are gone.
- **Production deploy env var** — `POSTHOG_API_KEY` is currently set in local `.env` only. To begin capturing real production traffic, the same key needs to be set in the production deploy environment (deploy platform TBD).
- **Live PostHog smoke test** — once `POSTHOG_API_KEY` is wired in production, fire one optimize click + one click-to-enhance and confirm `optimize.completed`, `llm.call.completed`, and `suggestions.completed` events all land in project `417445`.
- **Dashboard tiles for the new events** — the T2V Optimize Health dashboard does not yet surface `llm.call.completed` or `suggestions.completed`. Add tiles once enough events have accrued to be useful (per-provider duration, LLM cost-per-click, suggestions cache hit rate, suggestions latency over time).

---

## Per-LLM-call telemetry (`llm.call.completed`)

**What it answers:** which provider/model is each LLM hop using, how long does it take, how many tokens does it consume, and which calls error out. One event fires per `aiService.execute` invocation — a single `/api/optimize` request typically generates 2–4 of these.

**Project / dashboard:** Same project as Optimize (`417445`). No dedicated tiles yet — see "Open follow-ups" above.

### Event schema

Emitted by `LlmCallTelemetryService.record` (see [`server/src/services/observability/LlmCallTelemetryService.ts`](../../server/src/services/observability/LlmCallTelemetryService.ts)). The wrapper that calls `record` is in `AIModelService.execute`, where stage timing is captured in a `try / finally` so even thrown errors emit a final event.

The schema is **not** locked by a snapshot test (unlike `optimize.completed` and `suggestions.completed`). Adding one is recommended if PostHog consumers grow to depend on the property set — see [`server/src/services/observability/__tests__/optimize-event-schema.snapshot.test.ts`](../../server/src/services/observability/__tests__/optimize-event-schema.snapshot.test.ts) for the pattern.

Top-level event properties:

- `executionType` — caller-supplied string identifying the call site (e.g. `"image_observation"`, `"i2v_motion_ideas"`, optimize-stage names)
- `provider` — `"openai" | "groq" | "gemini"`, or `null` if the underlying call failed before resolving
- `model` — concrete model id (e.g. `"gpt-4o-mini-2024-07-18"`); `null` on early failure
- `durationMs` — wall-clock LLM call duration (integer ms)
- `promptTokens`, `completionTokens`, `totalTokens` — token counts from the provider response; `null` when usage is not reported
- `finishReason` — provider-supplied stop reason (e.g. `"stop"`, `"length"`, `"tool_calls"`); `null` when not provided
- `outcome` — `"success" | "error"`
- `errorMessage` — present only when `outcome === "error"`
- `requestId` — present only when the call originated inside an HTTP request (set via AsyncLocalStorage in `requestIdMiddleware`). Out-of-request calls omit the field so they can be distinguished in queries.
- `userId` — Firebase UID, or `null` for system / out-of-request calls (the `distinctId` falls back to `"system"` in that case)

### How to query

Top-level cost / latency by provider over a recent window:

```sql
SELECT
  properties.provider AS provider,
  properties.model AS model,
  count() AS calls,
  avg(properties.durationMs) AS avg_ms,
  quantile(0.95)(properties.durationMs) AS p95_ms,
  sum(properties.totalTokens) AS total_tokens
FROM events
WHERE event = 'llm.call.completed'
  AND timestamp > now() - INTERVAL 7 DAY
GROUP BY provider, model
ORDER BY calls DESC
```

Correlate an `optimize.completed` slow tail with its underlying LLM hops by joining on `requestId`:

```sql
SELECT
  llm.properties.executionType AS stage,
  llm.properties.provider AS provider,
  llm.properties.durationMs AS llm_ms,
  opt.properties.durationMs AS total_ms
FROM events AS llm
JOIN events AS opt
  ON llm.properties.requestId = opt.properties.requestId
WHERE llm.event = 'llm.call.completed'
  AND opt.event = 'optimize.completed'
  AND opt.properties.durationMs > 5000
ORDER BY opt.timestamp DESC
LIMIT 100
```

---

## Suggestions telemetry (`suggestions.completed`)

**What it answers:** how long does click-to-enhance take per request, what's the cache hit rate, how many suggestions come back, which engine mode ran, and which span category was selected. One event fires per `POST /api/get-enhancement-suggestions` request.

**Project / dashboard:** Same project as Optimize (`417445`). No dedicated tiles yet.

### Event schema

Emitted by `SuggestionsTelemetryService.SuggestionsTrace.complete` (see [`server/src/services/observability/SuggestionsTelemetryService.ts`](../../server/src/services/observability/SuggestionsTelemetryService.ts)). The trace is constructed by the route handler in [`server/src/routes/enhancement/enhancementSuggestionsRoute.ts`](../../server/src/routes/enhancement/enhancementSuggestionsRoute.ts) and threaded through `EnhancementService.getEnhancementSuggestions`, which records stage timings, cache hits, and the final outcome.

The schema is locked by a snapshot test at [`server/src/services/observability/__tests__/suggestions-event-schema.snapshot.test.ts`](../../server/src/services/observability/__tests__/suggestions-event-schema.snapshot.test.ts) — changes to the property set show up in PR diffs.

Top-level event properties:

- `requestId` — `req.id`, correlation key for cross-system traces
- `userId` — Firebase UID, or `null` for anonymous (matched by `distinctId = "anon-<uuid>"`)
- `outcome` — `"success" | "error"` (no `"aborted"` path on this endpoint today)
- `errorMessage` / `errorStage` — present only when `outcome === "error"`; `errorStage` is one of `"video_context" | "span_context" | "cache" | "v2_engine" | "post_processing"`
- `durationMs` — wall-clock end-to-end (integer ms)
- `cacheHit` — boolean; when `true`, the v2 engine was skipped and `stages.v2EngineMs` / `postProcessingMs` are `null`
- `suggestionCount` — total returned suggestions (handles both flat-array and grouped-array response shapes)
- `highlightedCategory` — the labeled-span category clicked (e.g. `"lighting"`, `"camera.movement"`); `null` when no category was provided
- `isVideoPrompt`, `isPlaceholder` — input-shape flags for cohort analysis
- `modelTarget`, `promptSection`, `phraseRole`, `categoryId` — derived context from the span / video prompt detection
- `engineMode` — `"guided_llm" | "fallback" | null` (path the v2 engine took)
- `modelCallCount` — number of `aiService.execute` calls made for this request (typically 1; >1 when a rescue call fired)
- `fallbackApplied` — `true` when the result came from the fallback path
- `policyVersion` — engine policy version active at request time (e.g. `"2026-03-v2a"`)
- `promptLength` — input prompt char length
- `debug` — `true` when the request was made with the `x-debug: true` header (dev only)
- `stages` — nested object of per-stage timings (or `null` if the stage was skipped):
  - `videoContextMs`, `spanContextMs`, `cacheCheckMs`, `v2EngineMs`, `postProcessingMs`

### How to query

Latency and cache hit rate by day:

```sql
SELECT
  toStartOfDay(timestamp) AS day,
  countIf(properties.cacheHit) / count() AS cache_hit_rate,
  avg(properties.durationMs) AS avg_ms,
  quantile(0.95)(properties.durationMs) AS p95_ms,
  count() AS calls
FROM events
WHERE event = 'suggestions.completed'
  AND timestamp > now() - INTERVAL 14 DAY
GROUP BY day
ORDER BY day DESC
```

Per-category outcome breakdown (where are users hitting errors?):

```sql
SELECT
  properties.highlightedCategory AS category,
  properties.outcome AS outcome,
  count() AS n
FROM events
WHERE event = 'suggestions.completed'
  AND timestamp > now() - INTERVAL 7 DAY
GROUP BY category, outcome
ORDER BY n DESC
```

---

## Eval telemetry (`eval.completed`)

**What it answers:** how often does each eval run, what does it produce, when does it regress. One event fires per `scripts/evaluation/*` run (passing, regressing, or setup-error). Three discriminator values today: `span_labeling_judge`, `span_labeling_f1`, `recommendation`.

**Project / dashboard:** Same project as Optimize (`417445`). Dashboard ["Eval Health" (id `1567504`)](https://us.posthog.com/project/417445/dashboard/1567504).

### Tiles

| Tile                                         | Insight ID | URL                                                             |
| -------------------------------------------- | ---------- | --------------------------------------------------------------- |
| Latest eval runs                             | `0ielZbLB` | [view](https://us.posthog.com/project/417445/insights/0ielZbLB) |
| F1 outcome breakdown (span_labeling_f1)      | `Wd430XAy` | [view](https://us.posthog.com/project/417445/insights/Wd430XAy) |
| Judge avg score trend (span_labeling_judge)  | `cFTTiOQg` | [view](https://us.posthog.com/project/417445/insights/cFTTiOQg) |
| Judge score distribution by day              | `yYJvMSB6` | [view](https://us.posthog.com/project/417445/insights/yYJvMSB6) |
| Recommendation drift events                  | `7BQcqEsc` | [view](https://us.posthog.com/project/417445/insights/7BQcqEsc) |
| Per-category F1 over time (span_labeling_f1) | `RGAb2MH4` | [view](https://us.posthog.com/project/417445/insights/RGAb2MH4) |
| Setup error count (24h)                      | `VJnURwpV` | [view](https://us.posthog.com/project/417445/insights/VJnURwpV) |
| Gate failure count (24h)                     | `icjwJljU` | [view](https://us.posthog.com/project/417445/insights/icjwJljU) |

Tiles are built as `DataVisualizationNode` over HogQL. Visualization type (table/line/bar/donut) is selectable per-tile in the UI; the query defines the data shape, the user picks the chart.

### Alerts

| Alert                                 | Insight (Trends version)                                              | Trigger                                               | Status   |
| ------------------------------------- | --------------------------------------------------------------------- | ----------------------------------------------------- | -------- |
| Eval setup error in last 24h          | [`zpHsNS5k`](https://us.posthog.com/project/417445/insights/zpHsNS5k) | `outcome = "setup_error"` count > 0 in 24h            | Active   |
| Eval gate failure streak (> 2 in 24h) | [`oWlELANW`](https://us.posthog.com/project/417445/insights/oWlELANW) | `outcome = "regression"` count > 2 in 24h             | Active   |
| F1 regression — any category          | TBD                                                                   | Any `perCategoryF1[*]` drops > 5% run-over-run        | Deferred |
| Judge avg score regression            | TBD                                                                   | `metrics.avgScore` drops > 0.5 from rolling 7-day avg | Deferred |

The two deferred alerts need anomaly-detection configuration (relative_decrease against historical data) and so make more sense to wire after sufficient real data accumulates. The two active alerts use threshold-based detection on absolute count and work from day one.

PostHog's alert engine only supports `TrendsQuery` insights, not `DataVisualizationNode`/HogQL. The dashboard tiles (HogQL) and alert sources (TrendsQuery) are therefore separate insights even when measuring the same thing — see the `Setup error count (24h)` HogQL tile vs the `Setup error trend (alertable)` TrendsQuery insight that the alert points at.

### Event schema

Emitted by [`scripts/evaluation/posthog-emitter.ts`](../../scripts/evaluation/posthog-emitter.ts). The schema is locked by snapshot tests at [`scripts/evaluation/__tests__/eval-event-schema.snapshot.test.ts`](../../scripts/evaluation/__tests__/eval-event-schema.snapshot.test.ts) — one snapshot per `evalType`.

Top-level event properties:

- `evalType` — `"span_labeling_judge" | "span_labeling_f1" | "recommendation"` — discriminator for the polymorphic `metrics` shape
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

`distinctId` convention: `ci-<GITHUB_RUN_ID>` in CI, `local-<username>` locally, `anon-<uuid>` fallback. Use `distinctId LIKE 'ci-%'` to filter CI-only runs in dashboards.

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

- **`POSTHOG_API_KEY` repo secret** — must be added in GitHub Settings → Secrets and variables → Actions before the nightly workflow can emit events. Same value as the server's production env (`phc_pmJDnB...`). Until this lands, the dashboard tiles for `span_labeling_judge` and `span_labeling_f1` will only have local-dev data.
- **F1 / judge regression alerts** — two deferred alerts in the Alerts table above; meaningful only after sufficient `span_labeling_*` events accumulate to threshold against.
- **Recommendation eval cron** — currently manual; add a workflow to run on schedule once dashboard signal is interesting.
- **CI smoke verification** — once the repo secret is set, trigger `gh workflow run "Span Labeling Golden-Set Eval" --ref main -f provider=groq` and confirm the resulting event has a `runId` matching the workflow's `GITHUB_RUN_ID`. This is plan task 9's CI-portion closure.
