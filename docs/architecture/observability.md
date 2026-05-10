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

- **Approach C extension** — per-LLM-call events (`llm.call.completed`) at the `aiService.execute` boundary. Defer until the dashboard surfaces a question the current schema can't answer.
- **M3b (suggestions / enhance endpoints)** — same event-shape pattern, new event names. Defer.
- **Remove dead `prom-client` instrumentation** in `server/src/infrastructure/MetricsService.ts` — the `/metrics` endpoint emits Prometheus metrics that nothing scrapes. Once the PostHog dashboard is confirmed serving the team's need (~2 weeks of usage), retire the prom-client surface in a separate cleanup PR.
- **Production deploy env var** — `POSTHOG_API_KEY` is currently set in local `.env` only. To begin capturing real production traffic, the same key needs to be set in the production deploy environment (deploy platform TBD).
