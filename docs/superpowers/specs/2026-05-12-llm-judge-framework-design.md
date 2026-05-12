# LLM Judge Framework — Design Spec

**Date:** 2026-05-12
**Program:** Sub-project #3 of the [Measurement Program](../programs/measurement.md)
**Estimate:** 1.5–2 weeks
**Branch:** off `main`
**Feature flag:** none — gated by `POSTHOG_API_KEY` (read events) + `OPENAI_API_KEY` (run judge)

---

## 0. Why

The Measurement Program's "Operating context" is clear: Vidra has zero real users, so the only way to know whether the system produces good output pre-launch is to **judge the output ourselves**. The content fields added on 2026-05-12 (`inputPrompt`/`outputPrompt`, `spans[]`, `suggestions[]`, etc.) made every Optimize / Suggestions / Span Labeling event human-reviewable. This sub-project automates that review: an LLM judge that scores each event on a per-surface rubric and emits a `quality.scored` event linked back to the source.

Three reasons this sub-project ships **before** sub-project #2 (per the 2026-05-12 resequence in the North Star):

1. **Three surfaces are judgeable today.** Optimize, Suggestions, Span Labeling already carry the content the judge needs. Building the judge first produces quality signal immediately.
2. **It sets the schema for #2.** When a new surface (Preview, Motion, etc.) is instrumented in #2, the judge's content-field requirements become the surface telemetry's content-field requirements. Design pulls from the constraint, not from intuition.
3. **It closes the only remaining quality gap pre-launch.** Operational dashboards exist; eval scripts exist; harness data flows. The missing piece is automatic scoring of arbitrary live outputs.

---

## 1. Locked architectural decisions

| Decision         | Choice                                                                                      | Reason                                                                                                                                                                                              |
| ---------------- | ------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Trigger          | **Pull (script polls PostHog)**                                                             | Matches #0 eval-script pattern. Decouples judge failures from user request flow. Allows historical re-scoring when rubrics iterate.                                                                 |
| Runtime          | **`scripts/quality-judge/run-judge.ts` via tsx**                                            | Same shape as `scripts/evaluation/golden-set-relaxed-f1.ts`. Same posthog-emitter.ts.                                                                                                               |
| Scheduling       | **GitHub Actions cron** (nightly) + `workflow_dispatch` for on-demand                       | Mirrors `span-labeling-eval.yml` exactly.                                                                                                                                                           |
| Judge model      | **OpenAI `gpt-4o-2024-08-06`**                                                              | Matches #0's existing judge (`span-labeling-evaluation.ts`). Strong instruction-following; predictable JSON output.                                                                                 |
| Event name       | **`quality.scored`**                                                                        | Distinct family from `eval.completed` (which scores against fixed golden sets).                                                                                                                     |
| Rubric shape     | **5 dimensions × 0–5 each, total 0–25**                                                     | Matches #0's existing judge shape exactly. Consistent UX for dashboard reading.                                                                                                                     |
| Rubric format    | **Markdown files under `scripts/quality-judge/rubrics/`**                                   | Plain prompt files. Snapshot-tested so changes show in PR diffs. No code translation.                                                                                                               |
| Idempotency      | **`(scoredEventId, judgeModel, rubricVersion)`** unique key                                 | Re-running the script doesn't double-score. Iterating rubric (new `rubricVersion`) produces fresh scores side-by-side.                                                                              |
| Emitter reuse    | **Generalize** `scripts/evaluation/posthog-emitter.ts` to accept an `event` parameter       | The current emitter from #0 hardcodes `event: "eval.completed"` in its body. Two-line change — generalize once, use for both eval + quality. Sibling emitter would duplicate ~50 lines for no gain. |
| `rubricVersion`  | First 8 chars of `sha256(rubricMarkdownContent.normalize()).hex`                            | Deterministic, short, doesn't churn on whitespace-only edits. Encoded once in `rubricVersionFor(surface)`.                                                                                          |
| Calibration gate | **Spearman rank correlation ≥ 0.7** vs hand-scored set, enforced as CI gate                 | Trust threshold. Below this, the judge isn't reliable enough to ship rubric changes.                                                                                                                |
| Sampling         | 100% `synthetic`, 100% `dogfood`, 0% `ci` / `dev`, 10% `user` initially                     | Pre-launch: cost-bounded by harness volume. Post-launch: tune `user` sampling rate.                                                                                                                 |
| Failure mode     | Best-effort. Judge errors logged, never re-throw. Missing scores show as gaps, not crashes. | Same principle as PostHogClient.capture.                                                                                                                                                            |
| Scope            | **3 surfaces only**: Optimize, Suggestions, Span Labeling                                   | The surfaces that already carry content fields. #2 surfaces (Preview, Motion, etc.) join later as their content fields land.                                                                        |

---

## 2. The contract

### 2.1 `quality.scored` event

```typescript
type QualityScoredSurface = "optimize" | "suggestions" | "span-labeling";

interface QualityScoredProperties {
  // Linkage to the scored event
  scoredEvent:
    | "optimize.completed"
    | "suggestions.completed"
    | "label-spans.completed";
  scoredEventId: string; // PostHog event UUID
  surface: QualityScoredSurface;

  // Rubric provenance
  rubricVersion: string; // e.g., "2026-05-12-v1" — bumped when rubric markdown changes
  judgeModel: string; // "gpt-4o-2024-08-06"

  // Performance
  judgeDurationMs: number;
  judgeCostUsd: number; // computed from token counts × pricing

  // Scores
  totalScore: number; // 0–25
  dimensions: Record<string, number>; // 5 keys per surface, each 0–5
  reasoning: string; // verbatim LLM judge explanation

  // Standard fields auto-stamped by PostHogClient wrapper
  source: TelemetrySource; // matches the scored event's source
}
```

### 2.2 Per-surface dimensions

Each rubric defines exactly 5 dimensions. Total score = sum. Values stored as integer 0–5.

| Surface           | Dimensions                                                                               |
| ----------------- | ---------------------------------------------------------------------------------------- |
| **Optimize**      | `fidelity`, `detailEnrichment`, `coherence`, `constraintCompliance`, `brevityDiscipline` |
| **Suggestions**   | `relevance`, `diversity`, `categoryFidelity`, `plausibility`, `qualityRange`             |
| **Span Labeling** | `coverage`, `precision`, `categoryAccuracy`, `granularity`, `boundaryCleanness`          |

Dimension definitions and 0–5 scoring guidance live in the rubric markdown files (§ 3.3). The judge LLM is shown the full rubric on every call.

### 2.3 Calibration set entry

```typescript
interface CalibrationEntry {
  scoredEvent:
    | "optimize.completed"
    | "suggestions.completed"
    | "label-spans.completed";
  // Frozen copy of the source event's content fields — kept in repo so calibration
  // doesn't depend on a specific PostHog event still existing.
  inputContent: Record<string, unknown>;
  outputContent: Record<string, unknown>;
  humanScore: number; // 0–25
  humanDimensions: Record<string, number>;
  humanNotes: string;
  authoredAt: string; // ISO date
  authoredBy: string;
}
```

Calibration JSON files (`scripts/quality-judge/calibration/<surface>.calibration.json`) are tracked in git. 30 entries per surface at v1.

---

## 3. Architecture

### 3.1 File inventory

```
scripts/quality-judge/
  run-judge.ts                                    (NEW) — entry point
  judge-event-types.ts                            (NEW) — QualityScoredProperties + per-surface dimension types
  rubrics/
    optimize.md                                   (NEW) — rubric prompt
    suggestions.md                                (NEW)
    span-labeling.md                              (NEW)
  calibration/
    optimize.calibration.json                     (NEW) — 30 hand-scored entries
    suggestions.calibration.json                  (NEW)
    span-labeling.calibration.json                (NEW)
    run-calibration.ts                            (NEW) — validates judge vs human, exits non-zero if below threshold
  pricing.ts                                      (NEW) — per-model $/1K-token table; cost helper
  __tests__/
    judge-event-schema.snapshot.test.ts           (NEW)
    rubric-prompt.snapshot.test.ts                (NEW) — locks rubric markdown
    pricing.test.ts                               (NEW)
    run-judge.smoke.test.ts                       (NEW) — mocked OpenAI + PostHog, asserts emit shape

.github/workflows/
  quality-judge.yml                               (NEW) — nightly + workflow_dispatch

scripts/evaluation/
  posthog-emitter.ts                              (MODIFIED) — generalize emit() to take event arg
  golden-set-relaxed-f1.ts                        (MODIFIED) — pass event: "eval.completed" through new arg
  span-labeling-evaluation.ts                     (MODIFIED) — same
  recommendation-eval.ts                          (MODIFIED) — same

docs/architecture/observability.md                (MODIFIED) — document quality.scored
```

**Generalized (small change to #0 code):** `scripts/evaluation/posthog-emitter.ts` is modified once to take an `event: string` parameter on `emit()` instead of hardcoding `"eval.completed"`. After the change, both the eval scripts (call with `event: "eval.completed"`) and the judge runner (call with `event: "quality.scored"`) share the same emitter. Two-line change to the shim plus updating three eval call sites to pass the event name. Snapshot test on the shim catches drift.

**Content extraction per surface.** `extractInputContent` / `extractOutputContent` are pure helpers in `run-judge.ts` that project a `*.completed` event's properties to the surface-appropriate content shape:

| Surface         | `inputContent` keys                                                                      | `outputContent` keys                                |
| --------------- | ---------------------------------------------------------------------------------------- | --------------------------------------------------- |
| `optimize`      | `inputPrompt`, `targetModel`, `mode`, `hasContext`, `hasShotPlan`, `useConstitutionalAI` | `outputPrompt` (null on error/abort — skip judging) |
| `suggestions`   | `highlightedText`, `fullPrompt`, `highlightedCategory`                                   | `suggestions` (string[]; empty → skip)              |
| `span-labeling` | `inputText`                                                                              | `spans` (Array<{text, category}>; empty → skip)     |

These are the same fields the content-review dashboards already display. Events with empty `outputContent` (errors, aborts, cache misses with no result) are skipped — there's nothing to judge.

### 3.2 The judge cycle

```typescript
// scripts/quality-judge/run-judge.ts (sketch)
async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const emitter = createEvalEmitter();
  const phClient = createPostHogQueryClient(); // wraps PostHog query API

  for (const surface of opts.surfaces) {
    const rubricText = await loadRubric(surface);
    const rubricVersion = rubricVersionFor(surface); // hash of markdown content
    const unscored = await fetchUnscoredEvents(
      phClient,
      surface,
      opts.hoursBack,
      opts.sampleRate,
    );

    for (const event of unscored) {
      const startedAt = Date.now();
      try {
        const { dimensions, reasoning, costUsd, tokensIn, tokensOut } =
          await runJudge({
            rubric: rubricText,
            surface,
            inputContent: extractInputContent(event, surface),
            outputContent: extractOutputContent(event, surface),
          });
        const totalScore = sumDimensions(dimensions);
        emitter.emit({
          distinctId: resolveDistinctId(),
          event: "quality.scored",
          properties: {
            scoredEvent: event.event,
            scoredEventId: event.uuid,
            surface,
            rubricVersion,
            judgeModel: "gpt-4o-2024-08-06",
            judgeDurationMs: Date.now() - startedAt,
            judgeCostUsd: costUsd,
            totalScore,
            dimensions,
            reasoning,
          },
        });
      } catch (err) {
        logger.debug("Judge call failed (non-fatal)", {
          eventId: event.uuid,
          error: err,
        });
      }
    }
  }

  await emitter.shutdown();
}
```

### 3.3 Rubric markdown shape

Each rubric file is a single-LLM-prompt-ready markdown document. Structure:

```markdown
# <Surface> Quality Rubric (v<version>)

You are evaluating <surface description>.

## Inputs

<which fields the LLM will see>

## Score each dimension 0–5

### <DimensionName> (0–5)

- **5:** <perfect example>
- **3:** <middling example>
- **0:** <broken example>

(...5 dimensions total...)

## Output format

Return JSON only:
{
"dimensions": { "<dim1>": 0-5, ..., "<dim5>": 0-5 },
"reasoning": "<1-3 sentences explaining the scoring>"
}
```

The full markdown is concatenated into the judge prompt verbatim. No template variables — the surface content is appended as a fenced block beneath it.

### 3.4 Idempotency query

Before scoring an event, the script asks PostHog "is there already a `quality.scored` event with `scoredEventId = X AND judgeModel = Y AND rubricVersion = Z`?" Skip if yes. HogQL:

```sql
SELECT scoredEventId FROM events
WHERE event = 'quality.scored'
  AND properties.scoredEventId IN (...)
  AND properties.judgeModel = 'gpt-4o-2024-08-06'
  AND properties.rubricVersion = '<current>'
```

In-memory set of `scoredEventId`s already present → skip. Limit lookback to 7 days for query speed.

### 3.5 Calibration

`scripts/quality-judge/calibration/run-calibration.ts` runs the active rubric against `<surface>.calibration.json`:

```typescript
for (const surface of surfaces) {
  const entries = loadCalibration(surface);
  const results = await Promise.all(
    entries.map(async (e) => {
      const judgeOutput = await runJudge({ rubric, surface, ...e });
      return {
        humanScore: e.humanScore,
        judgeScore: sumDimensions(judgeOutput.dimensions),
      };
    }),
  );
  const rho = spearmanCorrelation(
    results.map((r) => r.humanScore),
    results.map((r) => r.judgeScore),
  );
  const mae = meanAbsoluteError(
    results.map((r) => r.humanScore),
    results.map((r) => r.judgeScore),
  );
  console.log(`${surface}: ρ=${rho.toFixed(3)} MAE=${mae.toFixed(2)}`);
  if (rho < 0.7) {
    console.error(`❌ ${surface} calibration failed (need ρ ≥ 0.7)`);
    process.exit(1);
  }
}
```

CI gate: PRs that modify any rubric markdown trigger a `calibration` workflow job that runs the above. Cannot merge below the threshold.

---

## 4. Tests

| Test                                  | Asserts                                                                                                                                                                                                                  |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `judge-event-schema.snapshot.test.ts` | One inline snapshot per surface; locks `quality.scored` property keys                                                                                                                                                    |
| `rubric-prompt.snapshot.test.ts`      | Inline snapshot of each rubric markdown file. Changes show in PR diffs.                                                                                                                                                  |
| `pricing.test.ts`                     | Per-model pricing entries produce expected $ for known token counts                                                                                                                                                      |
| `run-judge.smoke.test.ts`             | Mock OpenAI + PostHog; assert: (a) judge prompt contains the rubric verbatim, (b) judge prompt contains the event's content fields, (c) parsed dimensions emitted correctly, (d) idempotency skips already-scored events |
| Calibration self-test                 | Run-calibration script against a known set produces stable ρ values                                                                                                                                                      |

Existing tests for `scripts/evaluation/` keep passing — judge framework reuses the emitter without modifying it.

---

## 5. Dashboards

Each existing per-surface Health dashboard gets **3 new tiles** sourced from `quality.scored`:

| Tile                                                      | Query                                                                                                                                                                   |
| --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Quality score trend (avg dimensions over time)            | Line chart, one line per dimension, daily avg, last 30 days                                                                                                             |
| Lowest-scoring recent examples (joined to source content) | Table — `quality.scored` JOIN source `*.completed` event on `scoredEventId`, columns: prompt/spans/etc. + dimension scores + judge reasoning. Sort by `totalScore` ASC. |
| Quality vs cost scatter                                   | X = `judgeCostUsd` from quality.scored; Y = `totalScore`. Useful for spotting low-quality-but-cheap or high-cost-low-quality outliers.                                  |

Built via PostHog MCP after the first judge run produces events. Tile IDs added to `observability.md`.

---

## 6. Alerts

| Alert                      | Trigger                                                            | Severity |
| -------------------------- | ------------------------------------------------------------------ | -------- |
| Surface quality regression | 7-day rolling avg `totalScore` drops > 3 points vs previous 7 days | warn     |
| Judge cost spike           | Total `judgeCostUsd` over 24h exceeds $5                           | warn     |
| Judge silent               | Zero `quality.scored` events in 24h when expected nightly run      | critical |
| Calibration drift          | Re-running calibration against the active rubric scores ρ < 0.6    | critical |

Wired via PostHog MCP after dashboard tiles exist. Same `TrendsQuery` constraint from #0 (HogQL tiles, Trends alerts).

---

## 7. Implementation flow

Suggested PR sequence:

1. **`pricing.ts` + `judge-event-types.ts` + tests** — pure types + pricing helper, no I/O. Foundation.
2. **First rubric (Optimize) + first calibration set + run-calibration.ts** — write rubric, hand-score 30 examples, run calibration locally until ρ ≥ 0.7. Largest single PR (calibration set authoring is most of the work).
3. **`run-judge.ts` + snapshot tests + smoke test** — the runner. Initially Optimize-only.
4. **Suggestions rubric + calibration set** — same shape; just authoring.
5. **Span Labeling rubric + calibration set** — same.
6. **GitHub Actions workflow (`quality-judge.yml`)** — cron + workflow_dispatch.
7. **Dashboard tiles for 3 surfaces** — PostHog MCP, no code.
8. **Alerts (4)** — PostHog MCP.
9. **observability.md update** — document `quality.scored` event + tile IDs.

PRs 1–6 trigger integration test gate (touches scripts/, no DI changes; skip the server integration tests unless the runner ever calls into server modules — it doesn't).

---

## 8. Out of scope

- **#2 surfaces (Preview, Motion, Continuity, Model Intelligence, etc.)** — they don't carry content fields yet. Their rubrics ship as part of #2 once their content fields land. The framework here (rubric + calibration + run-judge shape) is generic and applies.
- **Worker telemetry (#5)** — workers don't produce LLM output. No judge layer.
- **Push-based judging** — explicitly rejected (Question 1 above). Pull-based only.
- **Multi-judge ensembles** — single GPT-4o judge per rubric. Cross-judge agreement could be future work but adds 2× cost.
- **Auto-tuning rubrics** — manual iteration. No reinforcement-learning-from-calibration loop.
- **Sampling rate decisions for real users** — initial 10%, tune post-launch with real signal.
- **A historical backfill of pre-#3 events** — runs forward from when #3 ships. Backfill is a separate one-off if it becomes valuable.

---

## 9. Risks

| Risk                                               | Likelihood | Mitigation                                                                                                                                                        |
| -------------------------------------------------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Judge model returns malformed JSON                 | Medium     | OpenAI `response_format: { type: "json_object" }`. Parse failures logged; event skipped.                                                                          |
| Calibration set bias                               | Medium     | Hand-score across 30 diverse examples per surface, including edge cases (long prompts, empty outputs, errors). Document the calibration authorship process.       |
| Judge cost balloons at launch scale                | Medium     | 10% `user` sampling. Alert at $5/24h. Cost dashboard tile from #7.                                                                                                |
| Rubric drift between versions                      | Medium     | `rubricVersion` derived from markdown file hash. Score events stored against the version that produced them. CI gate prevents merging rubric changes below ρ=0.7. |
| PostHog query latency for "unscored events" lookup | Low        | 7-day lookback cap. Indexed on event name + properties.scoredEventId.                                                                                             |
| `gpt-4o-2024-08-06` deprecated mid-program         | Medium     | `judgeModel` is a property; new model emits with new `judgeModel` value. Side-by-side comparison possible. Recalibrate when switching.                            |
| Idempotency race when two runs overlap             | Low        | Single GitHub Actions cron; manual `workflow_dispatch` rare. Worst case = a few duplicate scores; not data-loss.                                                  |
| Token cost calculation drifts from actual billing  | Low        | `pricing.ts` is source-of-truth. Reconciling with OpenAI billing dashboard is a separate (manual) ops task.                                                       |

---

## 10. Success criteria

- Three rubric markdowns exist; each scores at ρ ≥ 0.7 on its calibration set.
- `run-judge.ts` runs against PostHog and emits `quality.scored` events linked back to source events via `scoredEventId`.
- All three existing per-surface Health dashboards (`1565688`, `1571039`, `1571040`) have the 3 quality tiles from § 5.
- Four alerts from § 6 are wired; at least the "judge silent" alert is exercised in a forced-regression test.
- After the first nightly run, every `optimize.completed` / `suggestions.completed` / `label-spans.completed` event with `source IN ('synthetic','dogfood')` has a matching `quality.scored` event.
- Total judge cost over 7 days stays under $5 for pre-launch traffic.
- The framework's emit pattern is generic: a new surface (e.g., Preview from #2) can be added by writing one rubric markdown + one calibration set, no judge-runner changes.
- `docs/architecture/observability.md` documents `quality.scored` schema + tile IDs.
