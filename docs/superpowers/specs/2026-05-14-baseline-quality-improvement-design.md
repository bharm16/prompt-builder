# Baseline Quality Improvement — Design Spec

**Date:** 2026-05-14
**Program:** Follow-up under the [Measurement Program](../programs/measurement.md), sub-project #3 (LLM Judge Framework) post-ship hygiene.
**Estimate:** Phase 1: ~half day. Phase 3: ~2-4 hours. Phase 2 is intentionally unscoped here — gets its own brainstorm + estimate after Phase 1 baseline rerun reveals what's left.
**Branch:** off `main`
**Feature flag:** none — work touches `scripts/synthetic/` only; no production code path.

---

## 0. Why

The 2026-05-14 baseline run produced these per-surface totals (out of 25):

| Surface         | n   | Avg total | Min   | Max |
| --------------- | --- | --------- | ----- | --- |
| optimize        | 20  | 23.10     | 14    | 25  |
| span-labeling   | 24  | 22.79     | 13    | 25  |
| **suggestions** | 43  | **16.02** | **2** | 25  |

Per-dimension breakdown on suggestions:

| Dimension            | Avg      | Reading  |
| -------------------- | -------- | -------- |
| plausibility         | 4.37     | strong   |
| diversity            | 3.42     | mid      |
| qualityRange         | 3.21     | mid      |
| **relevance**        | **2.53** | **weak** |
| **categoryFidelity** | **2.49** | **weak** |

The two weak dimensions co-fail. Pulling the five worst-scoring events showed the same failure shape repeatedly: the system produced suggestions that fit the stated `highlightedCategory` but did not fit the surrounding prompt. Example: `("Time-lapse of", camera.focus)` returned focus-related terms ("tight focus", "shallow bokeh") — internally valid for `camera.focus`, semantically nonsensical for "Time-lapse of".

The root cause is in [scripts/synthetic/drivers/suggestions.driver.ts:70-72](../../../scripts/synthetic/drivers/suggestions.driver.ts):

```typescript
const words = prompt.text.split(/\s+/).filter((w) => w.length > 0);
const highlightedText = words.slice(0, 2).join(" ");
```

The driver takes the **first two words** as the highlighted text, regardless of which category `prompt.tags[0]` maps to. Fixture pairings like `("Time-lapse of", camera.focus)` are not self-consistent: "Time-lapse of" is `shot.type` or `technical.duration` content, not a `camera.focus` value. The suggestions engine honestly produced what it was asked to produce; the judge correctly penalized the result for not fitting the surrounding prompt.

This is **measurement-system Layer 5**, in the same family as the four false-signal layers fixed 2026-05-13/14 (phantom-taxonomy rubric, canned harness output, regex scorer, mechanical bugs in the structural rewrite). The reordering-log principle from those fixes — _"measurement-system layers (rubric → harness → scorer → judge) each carry their own classification risk and need explicit verification"_ — applies directly: fixture self-consistency is a layer that hasn't been audited.

The 16.02 score is partly an artifact of this layer, not a clean read on production suggestion quality. Phase 2 (real product quality push) is deferred until Phase 1 reveals what's left after the artifact is removed.

---

## 1. Phase 1 — Locked architectural decisions

| Decision            | Choice                                                                                                                        | Reason                                                                                                                                                                                                  |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Scope               | `scripts/synthetic/drivers/suggestions.driver.ts` + `scripts/synthetic/fixtures/prompts.json` only                            | `optimize.driver.ts` (line 62-67) feeds `prompt.text` directly; `span-labeling.driver.ts` (line 50-58) feeds `prompt.text` directly. Neither needs paired highlights, so neither has this class of bug. |
| Fixture format      | Add `highlights: [{ text, category }]` array per prompt                                                                       | Matches the shape of `EnhancementV2RequestContext`. Structural data, not derived heuristics — same lesson as the 2026-05-14 V2CandidateScorer rewrite.                                                  |
| Category validation | Each `category` must be a valid taxonomy ID per `shared/taxonomy.ts` v3.0.0 (9 parent categories or namespaced attribute IDs) | Same authoritative list the judge rubrics already pin to.                                                                                                                                               |
| Text validation     | Each `highlights[i].text` must appear as a substring of `prompt.text`                                                         | Mirrors how the production span-labeling pipeline produces highlights — substring of the prompt.                                                                                                        |
| Validation timing   | At driver startup, before any LLM call fires                                                                                  | Bad fixture = loud fail at the top of the run, not 19 prompts in.                                                                                                                                       |
| Iteration shape     | Driver iterates **all** highlights per prompt                                                                                 | More signal per run (~40-60 `suggestions.completed` events from 20 prompts vs current 20). Matches how a real user clicks — multiple highlights inside one prompt.                                      |
| Robustness fixtures | **Out of scope** for Phase 1                                                                                                  | Mixing intentionally-bad pairs in now would remuddy the baseline. Belongs in a separate fixture suite scored with a different rubric ("system should detect contradiction").                            |
| `tags` field        | Keep in fixtures, mark deprecated in comment, drop in follow-up commit                                                        | Backward compatibility; clean diff scope for Phase 1.                                                                                                                                                   |
| Engine change       | **None**                                                                                                                      | We are not modifying the system under test. Only the input it receives.                                                                                                                                 |

---

## 2. The contract

### 2.1 New fixture shape

```jsonc
// scripts/synthetic/fixtures/prompts.json (example entry post-change)
{
  "id": "motion_02",
  "text": "Time-lapse of clouds racing over a desert mesa",
  "tags": ["camera.speed", "setting"], // deprecated, kept for backward compat
  "highlights": [
    { "text": "Time-lapse", "category": "shot.type" },
    { "text": "clouds racing", "category": "action.movement" },
    { "text": "desert mesa", "category": "environment.location" },
  ],
}
```

Authoring rules:

- Every prompt MUST have ≥ 1 entry in `highlights`. Driver startup validates this.
- `category` MUST be one of the 9 parent categories or a namespaced attribute ID from `shared/taxonomy.ts` v3.0.0. Driver startup validates against the canonical list.
- `text` MUST appear as a substring of `prompt.text`. Driver startup validates.
- Aim for 2-3 highlights per prompt covering different categories — more signal per run, more breadth.

### 2.2 Driver change

Delete from [suggestions.driver.ts](../../../scripts/synthetic/drivers/suggestions.driver.ts):

- `TAG_TO_POLICY_ID` (lines 37-60)
- `mapTagToPolicy` (lines 62-64)
- Word-slicing logic inside `buildContext` (lines 70-76)

Add:

- Startup validator: iterate all prompts, assert `highlights[]` non-empty, validate each `(text, category)` pair against `shared/taxonomy.ts` and the prompt text. Throw on any failure.
- Inner loop: for each prompt, iterate its `highlights[]`; pass `(text, category)` directly into `buildContext`.

`HarnessPrompt` type in `scripts/synthetic/utils/request-helper.ts` gains a required `highlights: { text: string; category: string }[]` field.

### 2.3 Verification

Run, in order:

```bash
npm run synthetic -- --only suggestions
npm run judge:run -- --surface suggestions
```

Then query PostHog for the new `quality.scored` events filtered to the last few minutes, source=`synthetic`, surface=`suggestions`. Compare per-dimension averages against the pre-fix baseline:

| Dimension        | Pre-fix | Expected post-fix                              | If actually post-fix |
| ---------------- | ------- | ---------------------------------------------- | -------------------- |
| plausibility     | 4.37    | ≈ 4.37 (unchanged — input quality independent) | record actual        |
| diversity        | 3.42    | ≈ 3.42 (unchanged)                             | record actual        |
| qualityRange     | 3.21    | ≈ 3.21 (unchanged)                             | record actual        |
| relevance        | 2.53    | **> 4** (large lift)                           | record actual        |
| categoryFidelity | 2.49    | **> 4** (large lift)                           | record actual        |

If relevance and categoryFidelity do NOT lift substantially, the artifact was not the dominant driver and Phase 2 has a real product issue to chase. Either result is informative; both are recorded in the Measurement Program reordering log.

### 2.4 What this is NOT

- Not a change to `EnhancementV2Engine`, `V2CandidateScorer`, `SuggestionDiversityEnforcer`, or any prompt template.
- Not a change to the judge, the judge model, the rubric, or the calibration gate.
- Not a change to the optimize or span-labeling drivers.
- Not the addition of intentionally-mismatched fixtures (deferred to a separate suite).

---

## 3. Phase 2 — Real product quality push (sketch, not committed)

Post-Phase-1 baseline reveals which dimensions reflect genuine product behavior versus measurement artifact. Best guess from contaminated data: the floor will move to `diversity` (3.42) and `qualityRange` (3.21), which are properties of `EnhancementV2PromptBuilder` and `SuggestionDiversityEnforcer` — not input contamination. That guess gets validated, not pre-committed.

Phase 2 gets its own brainstorm + spec once Phase 1 numbers are in.

---

## 4. Phase 3 — Open follow-ups from the Measurement Program (parallel-safe)

Both items are listed unchecked in the Measurement Program's "Tell when you're done" checklist as of 2026-05-14. They are independent of Phase 1 but become MORE valuable after Phase 1 clears the artifact noise — calibration anchored to noisy scores is wasted effort, which is why this sequence matters.

### 4.1 Calibration JSON seeding

Seed 5-10 hand-labeled examples per surface in `scripts/quality-judge/calibration/*.calibration.json`. The PR calibration gate workflow currently passes vacuously because all three files are empty arrays. Hand-label by scoring sample events the same way the rubric does, then check `runCalibration()` produces Spearman ρ ≥ 0.7 against the judge.

### 4.2 GitHub Actions secrets

`gh api repos/{owner}/{repo}/actions/secrets` currently returns `total_count: 0`. The nightly `Quality Judge` cron and the PR calibration gate workflows both fail silently without `POSTHOG_API_KEY` and `OPENAI_API_KEY` in repo secrets. Set both; verify a manual `workflow_dispatch` of the nightly cron completes and emits `quality.scored` events with `source=ci`.

---

## 5. Risks and what we accept

| Risk                                                          | Mitigation                                                                                                                         | Residual                                        |
| ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| Fixture authoring picks unrealistic highlights                | Mirror the substring shape production span-labeling produces; review by reading 3-4 examples before approving the full fixture set | Low — text-substring constraint forces realism. |
| Adding highlights silently inflates event volume / judge cost | Measured today: $0.183 for 43 events = $0.0043/event. 40-60 events ≈ $0.17-$0.26/run. Same order as today's baseline.              | Acceptable.                                     |
| Phase 1 fix reveals Phase 2 has nothing left to do            | That IS the result. Means suggestions quality is already strong on consistent inputs; deferred work shifts to Phase 3.             | Acceptable.                                     |
| Some prompts genuinely don't have 3 meaningful highlights     | Allow `highlights.length >= 1`; don't force 3. Driver iterates whatever's there.                                                   | Acceptable.                                     |

---

## 6. Sequencing

1. Phase 1 lands as one commit: fixture format extension + driver rewrite + startup validation. Branch `main` directly per Vidra commit protocol (≤ 10 files).
2. Rerun baseline (synthetic + judge) immediately after merge. Record post-fix per-dimension averages.
3. Update Measurement Program reordering log with the Layer 5 fix entry, mirroring the 2026-05-13 and 2026-05-14 entries.
4. Phase 3 items (calibration seeding, GH secrets) can land in parallel as separate small commits, any order.
5. Phase 2 brainstorm opens only after step 2's numbers are in.

---

## 7. What this spec does not specify

- The detailed implementation plan for Phase 1. That's the next artifact — invoked via writing-plans skill after this spec is approved.
- The exact list of hand-authored highlights per prompt. Authored during implementation, reviewed inline during the PR.
- Phase 2 design. Reopened as a separate brainstorm after Phase 1 baseline rerun.
