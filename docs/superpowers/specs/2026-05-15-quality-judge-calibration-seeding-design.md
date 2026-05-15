# Quality Judge Calibration Seeding — Design Spec

**Date:** 2026-05-15
**Program:** Sub-project A under the [Baseline Quality Improvement plan](../specs/2026-05-14-baseline-quality-improvement-design.md). Phase 3.1 (calibration JSON seeding) from the parent spec, promoted to its own sub-project because the work has acquired non-trivial scope.
**Estimate:** ~half day for tool + labeling + verification.
**Branch:** off `main`
**Feature flag:** none.

---

## 0. Why

The GPT-4o quality judge framework (sub-project #3) ships with three placeholder `*.calibration.json` files containing empty arrays. The PR calibration gate workflow currently passes vacuously. As long as the gate is vacuous, every score the judge produces is un-anchored — we know GPT-4o thinks the output is "good," but we don't know whether GPT-4o's notion of good matches a person's.

The 2026-05-14 baseline confirmed this matters: across three surfaces, the judge produced confident absolute scores (16.02 / 22.79 / 23.10), but those absolute numbers carry zero trust until we anchor them. Sub-projects B (suggestions improvement), C (optimize tail-truncation fix), and D (span-labeling under-segmentation) all depend on score deltas being meaningful. Without calibration, every score change post-engine-fix could be a real improvement OR a shift in what the judge prefers.

### What this sub-project produces — and what it does NOT

This sub-project produces **populated calibration sets** that make `npm run judge:calibrate` evaluate something real, with Spearman ρ ≥ 0.7 as the trust threshold per the parent spec.

**Important semantic note:** the labels are produced by Claude (an LLM), not a human. The parent spec assumed human labels as the trust anchor; that constraint is explicitly relaxed for this sub-project per a 2026-05-15 design decision. The trade-off was flagged and accepted: ρ between Claude and GPT-4o is a **cross-model agreement check**, not a human-preference anchor. If the two models share blind spots (likely given overlapping training data), they can agree strongly on judgments that don't match human preferences (Goodhart risk).

The accepted trade-off makes B/C/D ship-able now rather than waiting on focused human labeling time. A future sub-project A2 can replace the labels with human-authored ones to convert the cross-model check into a true trust anchor.

---

## 1. Locked architectural decisions

| Decision                           | Choice                                                                                                                      | Reason                                                                                                                                                                                                                                                                                                             |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Sample size                        | **20 events per surface, 60 total**                                                                                         | `run-calibration.ts:73` enforces ≥ 20 valid entries; Spearman ρ at smaller n has unworkable variance. Parent spec said "5-10" which was wrong.                                                                                                                                                                     |
| Sample stratification              | **4 quartiles by `totalScore`, 5 events per quartile**                                                                      | Random sampling biases toward the high-scoring majority and would leave the calibration set unable to distinguish judge behavior in the low/mid range. Quartile-based stratification covers the full score distribution.                                                                                           |
| Quartile bounds                    | **Computed per-surface from observed distribution**                                                                         | Each surface clusters differently (span-labeling 17-25 is tight; suggestions 5-25 is wide). Fixed bounds (e.g., 0-10, 11-15, …) would leave some surfaces with empty quartiles.                                                                                                                                    |
| Labeler                            | **Claude (LLM)** with `authoredBy: "claude"` in every entry                                                                 | Per 2026-05-15 design decision; trade-off accepted. Entries clearly marked so a future re-label pass can distinguish v0 placeholder labels from human-authored ones.                                                                                                                                               |
| Labeling tool                      | **Two-step:** select-samples.ts writes stub JSON, then manual edit fills in `humanScore` / `humanDimensions` / `humanNotes` | A pure-script approach can't do the labeling (it's analysis); a pure-manual approach loses 60 events worth of PostHog query overhead. The two-step pattern reuses query work and keeps labeling auditable as commits.                                                                                              |
| Scoring honesty                    | **Label from rubric prose alone, not from looking at the judge's score**                                                    | If I label by reading the judge's output first, ρ trivially approaches 1.0 — meaningless. I must label independently. The script's stub format intentionally omits the judge's score to enforce this.                                                                                                              |
| Re-judge on calibrate              | **Yes** (built into run-calibration.ts)                                                                                     | Tests rubric stability, not historical scoring. Cost: 60 × $0.005 = $0.30 per `judge:calibrate` invocation.                                                                                                                                                                                                        |
| `select-samples.ts` reuse          | **One-shot script, not a CLI**                                                                                              | After this seed pass, the JSON files are committed and stable. Re-seeding only happens if rubrics change materially, which is rare; we'll just re-run the script. No CLI affordances.                                                                                                                              |
| ρ < 0.7 outcome                    | **Sub-project A doesn't ship as "passing."** Triage step: re-label vs. rubric iteration                                     | If my labels and the judge's diverge by surface, the surface-specific reason matters. Could be: (a) my labels are inconsistent → re-label; (b) rubric is ambiguous → iterate rubric in a follow-up; (c) judge model needs prompt-injection hardening → escalate. Decision happens after the first calibration run. |
| Rubric changes in this sub-project | **None**                                                                                                                    | If rubrics need iteration, that's a separate sub-project A2 to keep this one focused.                                                                                                                                                                                                                              |

---

## 2. The contract

### 2.1 Stratification algorithm

For each surface S, given the population of N scored events:

1. Pull all scored events for S from the past 24h that have a corresponding source event with valid content (so `inputContent` / `outputContent` can be extracted).
2. Sort by `totalScore` ascending.
3. Split into 4 equal-sized quartiles by rank position (not score value — this guarantees 5 events per quartile even if the score distribution is heavily skewed).
4. From each quartile, pick the 5 events nearest the quartile's median rank (deterministic, no random).
5. For each picked event, query the source event by UUID to extract `inputContent` and `outputContent` per the existing `content-extractors.ts` shape.

### 2.2 Stub JSON entry format

Each stub entry written by `select-samples.ts`:

```jsonc
{
  "scoredEvent": "suggestions.completed", // matches CalibrationEntry.scoredEvent shape
  "inputContent": {
    /* extracted by content-extractors */
  },
  "outputContent": {
    /* extracted by content-extractors */
  },
  "humanScore": 0, // PLACEHOLDER — must be filled in before judge:calibrate
  "humanDimensions": {}, // PLACEHOLDER — must be filled in before judge:calibrate
  "humanNotes": "TODO: label me",
  "authoredAt": "2026-05-15T00:00:00.000Z", // placeholder ISO timestamp
  "authoredBy": "claude", // overwritten by labeling pass; never "human" unless human relabels
}
```

The labeling pass overwrites `humanScore`, `humanDimensions`, `humanNotes`, and `authoredAt`. Notice the script does NOT include the judge's score for that event — this is deliberate per § 1's "scoring honesty" decision.

### 2.3 Labeling discipline (for me)

When labeling, for each entry:

1. Read `inputContent` and `outputContent` from the JSON. Do not query PostHog for the judge's score.
2. Open the relevant rubric file ([optimize.md](../../../scripts/quality-judge/rubrics/optimize.md), [suggestions.md](../../../scripts/quality-judge/rubrics/suggestions.md), [span-labeling.md](../../../scripts/quality-judge/rubrics/span-labeling.md)) and apply the dimension definitions literally.
3. Assign each dimension a 0-5 integer per the rubric's anchor descriptions ("5: …", "3: …", "1: …", "0: …"). No half-points.
4. Compute `humanScore` as the sum of dimensions (matches `sumDimensions` in `judge-event-types.ts`).
5. Write 1-2 sentences in `humanNotes` explaining the dominant factor in the score, same shape as the judge's `reasoning` field.
6. Set `authoredAt` to the current ISO timestamp at label time.

### 2.4 Calibration run

After all 60 entries are populated:

```bash
npm run judge:calibrate
```

Per `run-calibration.ts:91-100`, this prints `rho=<n.nnn> MAE=<n.nn> (n=<valid>)` per surface and exits 0 if all three surfaces have ρ ≥ 0.7, else exit 1 with `FAILED — need rho >= 0.7` on the offending surface.

### 2.5 Verification

- `npm run judge:calibrate` exits 0
- All three `*.calibration.json` files contain exactly 20 entries
- No entry has `humanScore === 0` AND `humanDimensions === {}` (placeholder detection)
- All `authoredAt` values are valid ISO timestamps from the labeling session
- All `authoredBy` values are `"claude"`

---

## 3. What this is NOT

- Not a change to `run-calibration.ts`, `judge-client.ts`, `rubric-loader.ts`, `posthog-query-client.ts`, or any other quality-judge service code.
- Not a change to the rubric markdown files. If a rubric is ambiguous (revealed by ρ < 0.7), the rubric-iteration work is sub-project A2.
- Not a change to the parent spec's other phases. B/C/D wait their turn.
- Not a replacement for human-anchored calibration. The labels are explicitly marked as LLM-authored placeholders that a future pass can replace.

---

## 4. Risks and what we accept

| Risk                                                                                                           | Mitigation                                                                                                                                                                                                | Residual                                                              |
| -------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Claude and GPT-4o share blind spots → ρ ≥ 0.7 is achieved trivially without reflecting human judgment          | Acknowledged in § 0; future sub-project A2 replaces labels with human-authored ones                                                                                                                       | High by design — this is the accepted trade-off                       |
| I look at the judge's score before labeling, biasing toward agreement                                          | `select-samples.ts` stub format omits judge score; rubric-only labeling discipline in § 2.3                                                                                                               | Low — discipline is enforceable                                       |
| Quartile stratification yields too-easy cases at the high end (4 events all scoring 24-25 → indistinguishable) | Rank-based quartiles (not score-value) guarantee even rank coverage; if score distribution makes top quartile all 25/25, that surface is too narrow to calibrate meaningfully — flag for population first | Medium — surface with too-narrow distribution can be unrepresentative |
| Cost of ~$0.30 per `judge:calibrate` run is unbounded if we iterate many times                                 | Run is cheap; iteration count is bounded by labeling rounds (1-3 expected)                                                                                                                                | Low                                                                   |
| Updating the parent spec's § 4.1 to match this sub-project's choices creates spec drift                        | Update inline as part of this sub-project's commits, with a clear pointer back to this design                                                                                                             | Low                                                                   |

---

## 5. Sequencing

1. Write `select-samples.ts` (one commit).
2. Run it; commit the three stub JSON files (one commit).
3. Label all 60 entries; commit the populated JSON files (one commit per surface, three commits total, so labeling progress is auditable).
4. Run `npm run judge:calibrate`; if pass, commit the parent-spec update and any calibration-results note.
5. If fail on one or more surfaces, do not ship. Open a sub-project A2 brainstorm to triage why (rubric ambiguity vs. label inconsistency).

---

## 6. What this spec does not specify

- The detailed implementation plan. That's the next artifact — invoked via writing-plans after this spec is approved.
- The actual labels (60 of them). Authored during execution; reviewed as part of each commit.
- Sub-project A2's design. Reopens as a separate brainstorm if calibration fails.
