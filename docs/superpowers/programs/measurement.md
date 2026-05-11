# Measurement Program

Vidra's program to measure and evaluate every surface of the app — operational telemetry (latency, cost, errors) plus quality telemetry (eval scores, judge ratings) — into PostHog, with traffic-source discrimination so the data stays valid pre-launch, during early-user phases, and at scale.

**Status:** active. Sub-project #0 (Eval Visibility) in design.

---

## How to use this doc

This is the connective tissue across multiple specs. The work decomposes into 5 sub-projects (§ Decomposition); each gets its own spec and plan in `docs/superpowers/specs/` and `docs/superpowers/plans/`. **Read this doc first** at the start of any session touching measurement work — it's the only place the end state lives in one piece. Every sub-project spec opens with a pointer back here.

When the program's ambition shifts (priorities reorder, surfaces added/removed, axes added), the change lands **here first**, then propagates outward to in-flight sub-project specs — not the reverse. The Reordering log below is the audit trail.

---

## End State

Every user-facing endpoint and async pipeline in Vidra emits operational telemetry (per-stage latency, cost, errors) and quality telemetry (eval scores, judge-model ratings) to PostHog. Operational events carry a `source` discriminator distinguishing real users from `synthetic` / `dogfood` / `ci` / `dev` / `unknown` traffic, so the dashboard stays valid pre-launch, during early-user phases, and at scale. Eval events use a distinct event name (`eval.completed`) and don't need the discriminator. One dashboard per surface (T2V, I2V, Preview, Generation, Eval) answers _"is this surface healthy?"_; PostHog alerts catch latency, cost, error-rate, and eval-score regressions before users notice. The question _"is the 4+ LLM-call cost per Optimize click justified?"_ — and its equivalents for every other surface — is answerable on demand.

### "Tell when you're done" checklist

- [ ] Three eval scripts emit `eval.completed` events with per-category metrics; "Eval Health" dashboard exists with regression alerts
- [ ] Every endpoint listed in the `CLAUDE.md` Route → Service → Client API Map emits at least one `<surface>.completed` event
- [ ] Every endpoint emits per-stage `llm.call.completed` events tagged with `executionType`
- [ ] Every operational event has a `source` property (snapshot-tested for each event type)
- [ ] Each of {T2V, I2V, Preview, Generation} has a PostHog dashboard (Eval Health belongs to #0)
- [ ] At least one PostHog alert per dashboard, exercised in test

---

## Decomposition

The work breaks into 5 sub-projects. Each is independently designed (own spec + plan + ship cycle); the dependency arrows in § Sequencing govern ordering, not bundling.

| #     | Sub-project                                          | What it does                                                                                                                                                                                                                                                                                                       | Status      | Spec                                                                                    | Plan |
| ----- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------- | --------------------------------------------------------------------------------------- | ---- |
| **0** | **Eval Visibility**                                  | Pipe the three existing eval scripts (`span-labeling-evaluation.ts`, `golden-set-relaxed-f1.ts`, `recommendation-eval.ts`) into PostHog as `eval.completed` events with `evalType` discriminator. Build "Eval Health" dashboard. Add regression alerts.                                                            | in design   | [`2026-05-10-eval-visibility-design.md`](../specs/2026-05-10-eval-visibility-design.md) | TBD  |
| **1** | **Source discriminator + synthetic-traffic harness** | Add `source: "user" \| "synthetic" \| "dogfood" \| "ci" \| "dev" \| "unknown"` to every operational event payload (frontend sets `"user"` explicitly; default derived from `NODE_ENV`); build the script(s) that fire pre-release synthetic traffic; update existing dashboards to filter or break down by source. | deferred    | TBD                                                                                     | TBD  |
| **2** | **Operational telemetry coverage**                   | Extend the existing `*Trace` + `<surface>.completed` pattern to: I2V motion (`/api/motion`), preview (`/api/preview/*`), final generation, continuity (`/api/continuity`), span labeling (`/llm/label-spans`), model intelligence (`/api/model-intelligence`).                                                     | not started | TBD                                                                                     | TBD  |
| **3** | **LLM-effectiveness eval framework**                 | Judge models, scoring rubrics for _non-eval_ surfaces — _"did this LLM call produce a quality output?"_ — for live optimize/suggestion output. Emits `quality.scored` events. Separate from #0 (which surfaces existing eval scripts); this is judge infrastructure for arbitrary live LLM calls.                  | not started | TBD                                                                                     | TBD  |
| **4** | **Cross-surface dashboards + alerts**                | Build T2V Health, I2V Health, Preview Health, Generation Health dashboards (Eval Health is part of #0); wire PostHog alerts on threshold violations across surfaces.                                                                                                                                               | not started | TBD                                                                                     | TBD  |

### Already shipped (foundation)

The T2V Optimize telemetry stack already exists and is the pattern subsequent sub-projects replicate:

- `optimize.completed` — per `/api/optimize` call ([spec](../specs/2026-05-09-t2v-optimize-telemetry-design.md))
- `llm.call.completed` — per `aiService.execute` invocation
- `suggestions.completed` — per `/api/get-enhancement-suggestions` call
- "T2V Optimize Health" dashboard (PostHog project `417445`, dashboard id `1565688`)
- Documented in [`docs/architecture/observability.md`](../../architecture/observability.md)

#0 (Eval Visibility) adds a new event family (`eval.completed`) flowing from `scripts/evaluation/` into the same PostHog project. #1 retrofits the source discriminator onto the existing operational events. #2 replicates the operational pattern to more surfaces. #3 introduces quality scoring for live (non-eval) traffic. #4 builds cross-surface dashboards.

---

## Sequencing

- **#0 first, alone.** Eval Visibility is the goal that motivates the program. The data already exists (eval scripts produce structured JSON daily, the workflow already runs); this is wiring, not invention. Shipping it first proves the program's worth before further investment. Includes the Eval Health dashboard in scope so we don't repeat the "events into the void" mistake.
- **#1 and #2 in parallel after #0.** #1 is purely additive to existing operational events; #2 instruments new surfaces. They touch different code paths and can ship via separate Conductor worktrees. Each unblocks #4.
- **#3 after #2.** Requires real outputs to score across surfaces. Also the most expensive: judge models, calibration runs, rubric design.
- **#4 last overall.** Cross-surface dashboards need stable event streams from #1 + #2 + #3. Building tiles against empty event types is the trap that prompted this program in the first place — see Eval Visibility (#0) handling Eval Health locally rather than waiting for #4.

### Reordering log

- **2026-05-10:** Original ordering had source discriminator at #0 because I treated user-traffic telemetry as the throughline. User reframed: the goal is _eval visibility_, not source tagging. Reordered so Eval Visibility is #0, source discriminator is #1 (deferred). The dependency `#0 → #1` is gone because eval events have a distinct event name (`eval.completed`) and don't share the source-discrimination concern with operational events.

---

## Sub-project specs

- **#0** Eval Visibility — [`2026-05-10-eval-visibility-design.md`](../specs/2026-05-10-eval-visibility-design.md)
- **#1** Source discriminator + synthetic-traffic harness — TBD
- **#2** Operational telemetry coverage — TBD
- **#3** LLM-effectiveness eval framework — TBD
- **#4** Cross-surface dashboards + alerts — TBD

When a sub-project's spec lands, this row gains a link.

---

## How this doc keeps the program from dying

Solo measurement programs typically die one of three deaths: (a) the first sub-project ships, context drifts across sessions, and follow-ups never start; (b) follow-ups start but drift off-target because nobody re-reads the original vision; (c) sub-projects get bundled together for "efficiency" until the design collapses under its own weight.

This doc mitigates all three by externalizing the end state from any one spec, making it readable at the start of any future session in 30 seconds. Every sub-project spec opens with a pointer back here. When ambition shifts, the change happens **here first** — then propagates to in-flight sub-project specs — not the reverse. The Reordering log above is the audit trail; when priorities shift again, log them there before touching individual specs.

If you find yourself doing measurement work without having reread this file in the current session, that's the failure mode in progress. Re-read it now.

---

## Glossary — source discriminator values

The `source` property is part of sub-project #1's scope; eval events (#0) do not carry it because they have a distinct event name and aren't at risk of being conflated with user/synthetic traffic. Listed here for reference when #1 lands:

| Value       | When                                                                                               | Distinguishing characteristic                                                                |
| ----------- | -------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `user`      | Real authenticated or anonymous browser user — frontend sets `X-Telemetry-Source: user` explicitly | Header explicitly set by client API code; never inferred from absence.                       |
| `synthetic` | Requests fired by the pre-release synthetic-load script (introduced in #1)                         | Script sets `X-Telemetry-Source: synthetic` header.                                          |
| `dogfood`   | Authenticated team member using the app for internal testing                                       | Firebase UID matches a configured allowlist.                                                 |
| `ci`        | Requests fired from a CI job exercising real endpoints                                             | `CI=true` env var or a CI-job header.                                                        |
| `dev`       | Default when `NODE_ENV !== "production"` and no other rule matches                                 | Environment-derived; informative for local dev work.                                         |
| `unknown`   | Default when `NODE_ENV === "production"` and no other rule matches                                 | Environment-derived; flags a tagging gap to investigate (real-user calls should set `user`). |

---

## Related docs

- [`docs/architecture/observability.md`](../../architecture/observability.md) — source-of-truth reference for already-shipped event schemas (`optimize.completed`, `llm.call.completed`, `suggestions.completed`)
- [`docs/superpowers/specs/2026-05-09-t2v-optimize-telemetry-design.md`](../specs/2026-05-09-t2v-optimize-telemetry-design.md) — foundation spec; pattern subsequent sub-projects replicate
- [`docs/superpowers/specs/2026-05-10-eval-visibility-design.md`](../specs/2026-05-10-eval-visibility-design.md) — sub-project #0 design
- `CLAUDE.md` § "Active Programs" — entry point for any agent in a fresh session
