# T2V Telemetry Follow-ups — Session Handoff

> **RESOLVED 2026-05-10 (later session):** M3b route-handler integration completed. The `08255d1f` content was confirmed missing via grep (the wiring was type-only — no runtime call site), then re-applied with TDD. New regression test at `server/src/routes/enhancement/__tests__/enhancementSuggestionsRoute.telemetry.regression.test.ts` proves the trace is now created per request and threaded into `getEnhancementSuggestions`. tsc / ESLint / DI integration gate all clean. Three pre-existing test failures in `server-entry-routes-migration.test.ts` and `server-app.test.ts` (lines 127, 285, etc.) remain — these are stale expectations from Task A's MetricsService deletion (`9d9698a5`); confirmed against pristine HEAD. They are tracked as separate cleanup, not part of M3b. See "Resolution log" at bottom of this file.

**Original plan:** [`docs/superpowers/plans/2026-05-10-t2v-telemetry-followups-conductor.md`](2026-05-10-t2v-telemetry-followups-conductor.md)

---

## TL;DR — what the next session needs to do

1. ~~**Verify whether the M3b route-handler commit (`08255d1f`) actually landed.**~~ **Done.** Verified missing, re-applied via TDD.
2. ~~**Drop the stashed Prettier-only diffs.**~~ **Pending.** Two stashes to drop: `stash@{0}` (`spurious-prettier`) and the older Task A WIP stash whose content is now fully merged.
3. **Run the final verification gate** — partial. Unit + integration suites checked; a live PostHog smoke test against project 417445 still pending.
4. **Update `docs/architecture/observability.md`** to add the new `llm.call.completed` and `suggestions.completed` event schemas (see the Conductor plan for the schemas).
5. **Clean up the Conductor worktrees** (`puebla`, `prague`, `adelaide`) — their work is integrated; the worktrees themselves are no longer needed.
6. **Fix the pre-existing test failures from Task A's MetricsService deletion** (3 tests in `server-app.test.ts` + `server-entry-routes-migration.test.ts`). These were stale before this session began — see resolution log.

---

## Current state — branch and commit map

### `main` HEAD: `3837dffc` (or later — verify)

Recent commits on main since the conductor plan landed (`baf702d1`):

```
3837dffc feat(di): register SuggestionsTelemetryService            ← M3b (5/7)
252de1c2 feat(enhancement): instrument suggestions flow with telemetry ← M3b (4/7)
dd688d1d test(observability): schema contract snapshot for suggestions.completed ← M3b (3/7)
1e8662b5 feat(observability): SuggestionsTelemetryService implementation ← M3b (2/7)
c3e578c5 test(observability): unit tests for SuggestionsTelemetryService ← M3b (1/7)
b56a20f9 feat(observability): emit llm.call.completed from aiService.execute ← Task C (final integration)
953f7db6 feat(observability): LlmCallTelemetryService implementation ← Task C (3/3 pre-integration)
189f1745 test(observability): unit tests for LlmCallTelemetryService ← Task C (2/3)
20af0b28 feat(observability): types for LlmCallTelemetryService     ← Task C (1/3)
9d9698a5 chore(metrics): delete dead Prometheus instrumentation     ← Task A
baf702d1 docs(t2v-telemetry): conductor parallel plan for three follow-up tasks
```

### Task status summary

| Task                            | Status                                              | Notes                                                                                                                                                                                     |
| ------------------------------- | --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A — prom-client cleanup**     | ✅ Merged (`9d9698a5`)                              | 24 files, +1007/-2736 lines. tsc=0, lint=0. **Caveat:** left 3 pre-existing test failures in `server-app.test.ts` + `server-entry-routes-migration.test.ts` — see "Resolution log" below. |
| **C — per-LLM-call telemetry**  | ✅ Merged (4 commits + 1 integration)               | Includes the `llm.call.completed` schema, AIModelService.execute wrap, DI registration. AsyncLocalStorage wired for `requestId` correlation.                                              |
| **M3b — suggestions telemetry** | ✅ Complete (7/7) — final commit applied 2026-05-10 | Route handler now starts a `SuggestionsTrace` per request and threads it into `getEnhancementSuggestions`. Regression test added. DI integration gate green.                              |

### What may be missing from main (M3b commit `08255d1f`)

The Conductor commit `08255d1f feat(enhancement-route): create + pass SuggestionsTrace from route handler` was supposed to:

- Modify `server/src/routes/enhancement/enhancementSuggestionsRoute.ts` to create a `SuggestionsTrace` from `req.id` + `extractUserId(req)` and pass it into `enhancementService.getEnhancementSuggestions({ ..., trace })`
- Update the route registration site that constructs the handler to inject `suggestionsTelemetryService`
- Possibly modify `server/src/routes/enhancement.routes.ts` or `server/src/routes/api.routes.ts` for the registration plumbing

If this commit's content is missing, the wiring is half-done: events would not flow from the suggestions endpoint because the trace never gets created at the route layer.

---

## How to verify M3b's route handler integration

```bash
# Check whether the route handler creates and threads a trace:
grep -n "SuggestionsTrace\|suggestionsTelemetryService\|startSuggestionsTrace" \
  server/src/routes/enhancement/enhancementSuggestionsRoute.ts \
  server/src/routes/enhancement.routes.ts \
  server/src/routes/api.routes.ts

# If you see startSuggestionsTrace called: M3b is fully integrated. Move to verification.
# If you see no matches: 08255d1f content did NOT land. Apply it manually (see "How to apply 08255d1f if missing" below).
```

If you also want to confirm by running an Optimize → Suggestions flow end-to-end:

```bash
npm run server  # start the dev server (POSTHOG_API_KEY should be set)
# Click a span in the editor (or hit /api/get-enhancement-suggestions via curl)
# Then query PostHog:
```

```sql
SELECT event, count() FROM events
WHERE event = 'suggestions.completed'
  AND timestamp >= now() - interval 5 minute
GROUP BY event
```

If the count is 0, the route handler integration is missing.

---

## How to apply 08255d1f if missing

The original commit `08255d1f` lives on the Conductor branch `bharm16/m3b-suggestions-telemetry` in worktree `/Users/bryceharmon/conductor/workspaces/prompt-builder/adelaide`.

```bash
# From main checkout:
git cherry-pick 08255d1f
```

This will likely conflict on `server/src/routes/enhancement/enhancementSuggestionsRoute.ts` and possibly the route-registration files because of Prettier quote-style differences and earlier integration work. Resolve by:

1. **Take HEAD's version** (post-Task-A-and-C state) for the structural baseline
2. **Add the agent's new logic from `08255d1f`** for trace creation + threading

The agent's logic looks roughly like:

```ts
// In createEnhancementSuggestionsHandler factory (or equivalent):
import type { SuggestionsTelemetryService } from "@services/observability/SuggestionsTelemetryService";

export const createEnhancementSuggestionsHandler =
  (
    enhancementService: EnhancementService,
    suggestionsTelemetryService: SuggestionsTelemetryService,
  ) =>
  async (req: Request, res: Response): Promise<Response | void> => {
    const requestId = req.id || "unknown";
    const userId = extractUserId(req);
    const trace = suggestionsTelemetryService.startSuggestionsTrace(
      requestId,
      userId,
    );

    // ... existing body ...

    const result = await enhancementService.getEnhancementSuggestions({
      // ... existing fields ...
      trace,  // NEW
    });
```

Plus the registration-site update to inject `suggestionsTelemetryService` from DI.

After applying, run integration test gate + the suggestions PostHog smoke test.

---

## Stashed working-tree state

```bash
git stash list
# Should show:
# stash@{0}: On main: spurious-prettier
```

This stash contains Prettier-only quote-style reformats on these 5 files:

- `server/src/services/enhancement/EnhancementService.ts`
- `server/src/services/enhancement/services/types.ts`
- `server/src/services/observability/SuggestionsTelemetryService.ts`
- `server/src/services/observability/__tests__/SuggestionsTelemetryService.test.ts`
- `server/src/services/observability/__tests__/suggestions-event-schema.snapshot.test.ts`

**No real content.** Just `'` → `"` and similar. Safe to drop:

```bash
git stash drop stash@{0}
```

If you do `git stash show -p stash@{0}`, you'll see the diff is entirely formatting noise.

---

## Conductor worktrees (cleanup)

These worktrees were used by Conductor to do the parallel work. Their content is now integrated into main; the worktrees themselves are no longer needed.

| Worktree                                                          | Branch                              | What it produced                                                    |
| ----------------------------------------------------------------- | ----------------------------------- | ------------------------------------------------------------------- |
| `/Users/bryceharmon/conductor/workspaces/prompt-builder/puebla`   | `bharm16/prom-client-cleanup-v1`    | Task A — fully merged as `9d9698a5`                                 |
| `/Users/bryceharmon/conductor/workspaces/prompt-builder/prague`   | `bharm16/per-llm-call-telemetry`    | Task C — fully merged via 4 commits + integration                   |
| `/Users/bryceharmon/conductor/workspaces/prompt-builder/adelaide` | `bharm16/m3b-suggestions-telemetry` | Task M3b — 6/7 commits' content merged; route handler maybe missing |

Cleanup (only after verifying M3b is fully integrated):

```bash
for wt in puebla prague adelaide; do
  git worktree unlock "/Users/bryceharmon/conductor/workspaces/prompt-builder/$wt" 2>/dev/null
  git worktree remove --force "/Users/bryceharmon/conductor/workspaces/prompt-builder/$wt"
done
git branch -D bharm16/prom-client-cleanup-v1 bharm16/per-llm-call-telemetry bharm16/m3b-suggestions-telemetry bharm16/prom-client-cleanup
```

(Keep the branches if you want a permanent reference to the Conductor work; delete them to reduce noise.)

---

## Final verification checklist

Once the M3b route handler is confirmed integrated:

```bash
# Full repo gates
npx tsc --noEmit                                                    # expect 0 errors
npm run lint                                                        # expect 0 errors
npm run test:unit                                                   # expect all pass (3 pre-existing failures in inlineProcessor.test.ts are unrelated)
PORT=0 npx vitest run tests/integration/bootstrap.integration.test.ts \
                       tests/integration/di-container.integration.test.ts \
                       --config config/test/vitest.integration.config.js  # expect 8/8 pass

# PostHog event verification (after firing one of each event type)
# In PostHog SQL editor, project 417445:
SELECT event, count() FROM events
WHERE event IN ('optimize.completed', 'llm.call.completed', 'suggestions.completed')
  AND timestamp >= now() - interval 1 hour
GROUP BY event
```

Expect three rows, one per event type.

---

## Documentation updates

After verification:

1. **`docs/architecture/observability.md`** — add sections for the two new event types (schemas live in the Conductor plan):
   - `llm.call.completed` — emitted per `aiService.execute` call
   - `suggestions.completed` — emitted per `/api/get-enhancement-suggestions` request

2. **PostHog dashboard extension** — add tiles for the new events to the existing T2V Optimize Health dashboard:
   - LLM cost-per-click derived metric (using `llm.call.completed.totalTokens × cost-per-token`)
   - Per-provider duration distribution
   - Suggestions latency over time
   - Suggestions cache hit rate

Use the `posthog:querying-posthog-data` skill via the MCP — same pattern as the existing T2V Optimize Health tiles. The MCP context is currently scoped to the Vidra org / project 417445.

---

## Known issues / gotchas surfaced this session

### 1. Prettier quote-style reformatting

The repo's Prettier config produces double-quotes; some files in Conductor worktrees were authored with single quotes. When cherry-picked, the diffs include both real content changes and quote-style reformats. The safest pattern is:

- Cherry-pick → if conflicts, keep HEAD's quote style
- Reset spurious quote-only diffs before committing the real change

### 2. Cherry-pick conflicts in shared files

Tasks C and M3b both touched `server/src/services/observability/types.ts` and `server/src/config/services/observability.services.ts`. When merging both, the conflicts are append-only and trivially resolvable by accepting both insertions side-by-side. The plan's "Conflict map" section pre-documented this; resolution went smoothly.

### 3. AIModelService surgical removal

Task C's commits were authored with `metricsService` references intact (because they were on a branch that pre-dated Task A). After Task A merged (deleting the metrics surface), Task C's AIModelService.ts changes had to have all `metricsService` / `IMetricsCollector` / `_recordMetrics` / `calculateLLMCost` references stripped during integration. This was done in commit `b56a20f9`.

### 4. DI integration test maintenance

`tests/integration/di-container.integration.test.ts` has a "must-register" list. Task A's deletion of `metricsService` required removing that token from the list. Same will apply to any future deletions — keep the test in sync.

### 5. The Conductor agent's incomplete commit on Task A

The `puebla` Conductor worktree had ~22 files of uncommitted changes for Task A but never produced any actual commits on the branch. The work was completed inline in the worktree, then committed by the orchestrator (single commit `fc23a2e1` on the puebla branch, then cherry-picked as `9d9698a5` on main).

---

## Where the original plan & specs live

- **Spec:** [`docs/superpowers/specs/2026-05-09-t2v-optimize-telemetry-design.md`](../specs/2026-05-09-t2v-optimize-telemetry-design.md)
- **Implementation plan:** [`docs/superpowers/plans/2026-05-09-t2v-optimize-telemetry.md`](2026-05-09-t2v-optimize-telemetry.md)
- **Conductor parallel plan:** [`docs/superpowers/plans/2026-05-10-t2v-telemetry-followups-conductor.md`](2026-05-10-t2v-telemetry-followups-conductor.md)
- **Observability docs:** [`docs/architecture/observability.md`](../../architecture/observability.md) — needs extending with new event schemas
- **Dashboard:** [PostHog dashboard 1565688 in project 417445](https://us.posthog.com/project/417445/dashboard/1565688)

---

## Resume command for next session

Paste this to a fresh session as the first message:

```
Read docs/superpowers/plans/2026-05-10-t2v-telemetry-followups-HANDOFF.md.

M3b is now complete. Remaining work:
1. Live PostHog smoke test against project 417445 (server boot + click-to-enhance, confirm suggestions.completed events arrive)
2. Update docs/architecture/observability.md with llm.call.completed and suggestions.completed schemas
3. Clean up the Conductor worktrees (puebla, prague, adelaide)
4. Drop the two stashes (stash@{0} spurious-prettier, plus the older Task A WIP if still present)
5. Fix the 3 pre-existing test failures from MetricsService deletion in:
   - tests/unit/server-app.test.ts:127
   - tests/unit/server-entry-routes-migration.test.ts:129 and :285
```

---

## Resolution log

### 2026-05-10 (later session) — M3b route-handler integration completed

**Diagnosis.** A single grep against `server/src/routes/` confirmed `SuggestionsTelemetryService` was only present as a _type_ import in `EnhancementService.ts:13` and `services/types.ts:7`. No route handler ever called `startSuggestionsTrace` or threaded a trace into `getEnhancementSuggestions`. The codebase compiled cleanly because the trace param on `getEnhancementSuggestions` was already optional (`trace?: SuggestionsTrace`) and falls back to a no-op trace via `makeNoopSuggestionsTrace()` — so the dead-feature state survived `tsc --noEmit` undetected.

**Fix.** Following TDD per the loaded `superpowers:test-driven-development` skill:

1. Wrote a failing route handler test — `server/src/routes/enhancement/__tests__/enhancementSuggestionsRoute.telemetry.regression.test.ts` — that asserts `startSuggestionsTrace(requestId, userId)` is called and the returned trace is forwarded to `enhancementService.getEnhancementSuggestions`. Verified RED with the right failure shape: status 200 (request handled), but `expected "spy" to be called 1 times, but got 0 times` — the dead-feature signal.
2. Wired `suggestionsTelemetryService` through the four-layer chain:
   - `server/src/routes/enhancement/enhancementSuggestionsRoute.ts` — accepts the dep, derives `userId` from `extractUserId(req)` (mapping `"anonymous"` → `null` for telemetry), starts a trace, threads it into the service call.
   - `server/src/routes/enhancement.routes.ts` — adds `suggestionsTelemetryService` to `EnhancementServices`, forwards.
   - `server/src/routes/api.routes.ts` — destructures and forwards via `createEnhancementRoutes`.
   - `server/src/config/routes/api.registration.ts` — resolves `suggestionsTelemetryService` from the DI container.
3. Updated 3 pre-existing tests that built `EnhancementServices` / `ApiServices` fakes to include the new dep:
   - `tests/integration/api/enhancement-suggestions.integration.test.ts` (2 sites)
   - `tests/unit/enhancement-routes.test.ts`
   - `tests/unit/server-entry-routes-migration.test.ts`

**Validation.**

| Check                                     | Result     |
| ----------------------------------------- | ---------- |
| New regression test                       | PASS       |
| `npx tsc --noEmit`                        | clean      |
| ESLint on touched files                   | clean      |
| Affected unit + integration route tests   | 19/19 PASS |
| DI bootstrap + container integration gate | 8/8 PASS   |

**Pre-existing failures left untouched.** Three failures in `tests/unit/server-app.test.ts:127`, `tests/unit/server-entry-routes-migration.test.ts:129` and `:285` exist in pristine HEAD (verified by stashing the new work and re-running). They reference a deleted `metricsService` parameter on `configureMiddleware` and a deleted `/metrics` HTTP endpoint — both removed by Task A in `9d9698a5` without updating these tests. They are tracked as separate cleanup, not part of M3b. **Anyone fixing them: the right fix is to delete the stale assertions, not to restore the metrics infrastructure.**

**Why the failure mode was subtle.** A type-only import is invisible to runtime — the code looks plausible, the types check, the unit tests pass, but no production path emits the event. The cheapest distinguisher between "wired" and "not wired" is grepping the _runtime_ call site (`startSuggestionsTrace`), not the type import. The handoff's front-loaded one-line grep made the diagnosis a 30-second exercise instead of a debugging session.
