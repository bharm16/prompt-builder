# Quality Judge Calibration Seeding — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Populate the three `*.calibration.json` files with 20 stratified, hand-labeled (by Claude) entries each so `npm run judge:calibrate` evaluates Spearman ρ against a real calibration set, replacing the current vacuous empty-array pass.

**Architecture:** One-shot TypeScript script reads scored events from PostHog, stratifies by rank into 4 quartiles per surface (5 entries per quartile = 20 per surface), extracts the source event's content fields via the existing `content-extractors.ts`, and writes stub JSON entries with placeholder human fields. Then Claude reads each stub's `inputContent` + `outputContent` (without peeking at the judge's score) and fills in `humanScore`, `humanDimensions`, `humanNotes` per the relevant rubric. Finally `npm run judge:calibrate` recomputes the judge's scores and reports Spearman ρ + MAE per surface against the human labels.

**Tech Stack:** TypeScript (ESM), Vitest, PostHog HogQL via `mcp__posthog__query-run` or the existing `posthog-query-client.ts`, the existing `scripts/quality-judge/` runtime (`run-calibration.ts`, `judge-client.ts`).

**Spec:** [`docs/superpowers/specs/2026-05-15-quality-judge-calibration-seeding-design.md`](../specs/2026-05-15-quality-judge-calibration-seeding-design.md)

---

## File Structure

| Action | Path                                                                       | Responsibility                                                                                                                                                                                                   |
| ------ | -------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Create | `scripts/quality-judge/calibration/stratify.ts`                            | Pure function `stratifyByQuartile<T>(events, getScore): T[]`. Sorts by score ascending, splits into 4 rank-based quartiles, picks 5 events nearest each quartile's median rank. Throws if `< 20` events.         |
| Create | `scripts/quality-judge/calibration/__tests__/stratify.test.ts`             | Vitest unit tests for stratification logic.                                                                                                                                                                      |
| Create | `scripts/quality-judge/calibration/select-samples.ts`                      | One-shot script that queries PostHog for scored + source events per surface, calls `stratifyByQuartile`, extracts content via `content-extractors.ts`, writes stub `CalibrationEntry[]` to the three JSON files. |
| Modify | `scripts/quality-judge/calibration/optimize.calibration.json`              | Replace `[]` with 20 stub entries (Task 2), then labeled entries (Task 3).                                                                                                                                       |
| Modify | `scripts/quality-judge/calibration/suggestions.calibration.json`           | Same pattern (Task 2 then Task 4).                                                                                                                                                                               |
| Modify | `scripts/quality-judge/calibration/span-labeling.calibration.json`         | Same pattern (Task 2 then Task 5).                                                                                                                                                                               |
| Modify | `docs/superpowers/specs/2026-05-14-baseline-quality-improvement-design.md` | Update § 4.1 to reflect the 20-entry-minimum + LLM-labeler decisions (Task 7).                                                                                                                                   |

---

## Task 1: Pure stratification helper (TDD)

**Files:**

- Create: `scripts/quality-judge/calibration/stratify.ts`
- Create: `scripts/quality-judge/calibration/__tests__/stratify.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `scripts/quality-judge/calibration/__tests__/stratify.test.ts`:

```typescript
import { describe, expect, it } from "vitest";

import { stratifyByQuartile } from "../stratify.js";

interface TestEvent {
  id: string;
  score: number;
}

function makeEvents(scores: number[]): TestEvent[] {
  return scores.map((s, i) => ({ id: `e${i}`, score: s }));
}

const getScore = (e: TestEvent) => e.score;

describe("stratifyByQuartile", () => {
  it("throws when given fewer than 20 events", () => {
    const tooFew = makeEvents(Array.from({ length: 19 }, (_, i) => i));
    expect(() => stratifyByQuartile(tooFew, getScore)).toThrow(
      /at least 20 events.*got 19/i,
    );
  });

  it("returns exactly 20 events from a 20-event population (one per rank slot)", () => {
    const exactly20 = makeEvents(Array.from({ length: 20 }, (_, i) => i));
    const result = stratifyByQuartile(exactly20, getScore);
    expect(result).toHaveLength(20);
    const ids = new Set(result.map((e) => e.id));
    expect(ids.size).toBe(20);
  });

  it("returns 20 events from a 100-event population, 5 per quartile near the median rank", () => {
    const hundred = makeEvents(Array.from({ length: 100 }, (_, i) => i));
    const result = stratifyByQuartile(hundred, getScore);
    expect(result).toHaveLength(20);
    const sortedScores = result.map((e) => e.score).sort((a, b) => a - b);
    // Quartile 0 (ranks 0-24): expect picks near rank 12 → scores around 10-14
    expect(sortedScores.slice(0, 5).every((s) => s >= 8 && s <= 16)).toBe(true);
    // Quartile 3 (ranks 75-99): expect picks near rank 87 → scores around 85-89
    expect(sortedScores.slice(15, 20).every((s) => s >= 83 && s <= 91)).toBe(
      true,
    );
  });

  it("covers all four quartiles (lowest pick < highest pick by a wide margin)", () => {
    const hundred = makeEvents(Array.from({ length: 100 }, (_, i) => i));
    const result = stratifyByQuartile(hundred, getScore);
    const scores = result.map((e) => e.score);
    const min = Math.min(...scores);
    const max = Math.max(...scores);
    expect(max - min).toBeGreaterThanOrEqual(60);
  });

  it("is deterministic: same input → same output (order-independent)", () => {
    const fifty = makeEvents(Array.from({ length: 50 }, (_, i) => i));
    const a = stratifyByQuartile(fifty, getScore);
    const b = stratifyByQuartile([...fifty].reverse(), getScore);
    const aIds = a.map((e) => e.id).sort();
    const bIds = b.map((e) => e.id).sort();
    expect(aIds).toEqual(bIds);
  });

  it("handles tied scores without throwing", () => {
    const allFives = makeEvents(Array.from({ length: 25 }, () => 5));
    const result = stratifyByQuartile(allFives, getScore);
    expect(result).toHaveLength(20);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run scripts/quality-judge/calibration/__tests__/stratify.test.ts`
Expected: FAIL — cannot resolve `../stratify.js`.

- [ ] **Step 3: Implement `stratifyByQuartile`**

Create `scripts/quality-judge/calibration/stratify.ts`:

```typescript
/**
 * Rank-based quartile stratification for calibration sample selection.
 *
 * Rationale: the calibration set must cover the full quality range so
 * Spearman ρ can distinguish judge behavior across high/mid/low scoring
 * events. Random sampling biases toward whatever score level dominates
 * the population (typically high). Rank-based quartiles guarantee 5
 * events per quartile regardless of score-distribution skew.
 *
 * See docs/superpowers/specs/2026-05-15-quality-judge-calibration-seeding-design.md
 * § 2.1 for the algorithm description.
 */

const MIN_POPULATION = 20;
const QUARTILES = 4;
const PER_QUARTILE = 5;

export function stratifyByQuartile<T>(
  events: T[],
  getScore: (e: T) => number,
): T[] {
  if (events.length < MIN_POPULATION) {
    throw new Error(
      `stratifyByQuartile: need at least ${MIN_POPULATION} events, got ${events.length}.`,
    );
  }

  const sorted = [...events].sort((a, b) => getScore(a) - getScore(b));
  const n = sorted.length;
  const result: T[] = [];

  for (let q = 0; q < QUARTILES; q++) {
    const qStart = Math.floor((q * n) / QUARTILES);
    const qEnd = Math.floor(((q + 1) * n) / QUARTILES);
    const qMid = qStart + Math.floor((qEnd - qStart) / 2);

    // Pick 5 entries centered on qMid, clamped to the quartile's [qStart, qEnd) range.
    const half = Math.floor(PER_QUARTILE / 2);
    let pickStart = qMid - half;
    if (pickStart < qStart) pickStart = qStart;
    if (pickStart + PER_QUARTILE > qEnd) pickStart = qEnd - PER_QUARTILE;
    if (pickStart < qStart) pickStart = qStart; // quartile smaller than PER_QUARTILE

    for (let i = pickStart; i < Math.min(pickStart + PER_QUARTILE, qEnd); i++) {
      result.push(sorted[i]!);
    }
  }

  return result;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run scripts/quality-judge/calibration/__tests__/stratify.test.ts`
Expected: PASS — 6 tests pass.

- [ ] **Step 5: Type check**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add scripts/quality-judge/calibration/stratify.ts scripts/quality-judge/calibration/__tests__/stratify.test.ts
git commit -m "feat(quality-judge): add stratifyByQuartile for calibration sampling

Rank-based quartile sampler that guarantees 5 events per quartile
regardless of score-distribution skew. Six TDD tests covering minimum
population, count, range coverage, determinism, and tied-score
handling. Used by Sub-project A's select-samples.ts to build the
hand-labeled calibration set without random-sampling bias."
```

---

## Task 2: Sample-selection script + stub JSON generation

**Files:**

- Create: `scripts/quality-judge/calibration/select-samples.ts`
- Modify: `scripts/quality-judge/calibration/optimize.calibration.json` (replace `[]` with 20 stubs)
- Modify: `scripts/quality-judge/calibration/suggestions.calibration.json` (replace `[]` with 20 stubs)
- Modify: `scripts/quality-judge/calibration/span-labeling.calibration.json` (replace `[]` with 20 stubs)

The script is one-shot; we test it via running it, not via unit tests. The pure stratification helper from Task 1 already has TDD coverage.

- [ ] **Step 1: Read `scripts/quality-judge/posthog-query-client.ts` to understand the existing query plumbing**

Run: `cat scripts/quality-judge/posthog-query-client.ts`
Note: The existing client has `fetchEventsToScore` and `fetchAlreadyScoredIds`. The select-samples script needs a different query — getting scored events with `totalScore` + `scoredEventId`, then joining to source events. Depending on the existing client's shape, either extend it with a new method or have the script do its own HogQL POST.

- [ ] **Step 2: Write the script**

Create `scripts/quality-judge/calibration/select-samples.ts`:

```typescript
/**
 * One-shot script: pull scored events from PostHog per surface, stratify
 * into 4 quartiles by totalScore, fetch the corresponding source events'
 * content, write 20 stub CalibrationEntry records per surface.
 *
 * Run: `npx tsx --tsconfig server/tsconfig.json scripts/quality-judge/calibration/select-samples.ts`
 *
 * After this script runs, the three *.calibration.json files contain
 * stub entries with placeholder humanScore/humanDimensions/humanNotes.
 * Tasks 3-5 fill those in by hand.
 *
 * See docs/superpowers/specs/2026-05-15-quality-judge-calibration-seeding-design.md
 * for the design rationale.
 */

import "dotenv/config";
import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import {
  extractInputContent,
  extractOutputContent,
} from "../content-extractors.js";
import {
  QUALITY_SCORED_SURFACES,
  scoredEventNameFor,
  type QualityScoredSurface,
} from "../judge-event-types.js";
import { stratifyByQuartile } from "./stratify.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const POSTHOG_HOST = process.env.POSTHOG_HOST ?? "https://us.posthog.com";
const POSTHOG_PROJECT_ID = process.env.POSTHOG_PROJECT_ID ?? "417445";
const POSTHOG_PERSONAL_API_KEY = process.env.POSTHOG_PERSONAL_API_KEY;

if (!POSTHOG_PERSONAL_API_KEY) {
  throw new Error(
    "POSTHOG_PERSONAL_API_KEY required for HogQL queries. Set it in .env or env.",
  );
}

interface HogQLResponse {
  results: Array<Array<unknown>>;
  columns: string[];
}

async function runHogQL(query: string): Promise<HogQLResponse> {
  const url = `${POSTHOG_HOST}/api/projects/${POSTHOG_PROJECT_ID}/query/`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${POSTHOG_PERSONAL_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query: { kind: "HogQLQuery", query },
    }),
  });
  if (!res.ok) {
    throw new Error(`HogQL ${res.status}: ${await res.text()}`);
  }
  const json = (await res.json()) as HogQLResponse;
  return json;
}

interface ScoredRow {
  scoredEventId: string;
  totalScore: number;
}

interface SourceRow {
  uuid: string;
  properties: Record<string, unknown>;
}

interface SampledEntry {
  scoredEventId: string;
  totalScore: number;
  source: SourceRow;
}

async function fetchScoredRows(
  surface: QualityScoredSurface,
): Promise<ScoredRow[]> {
  const q = `
    SELECT properties.scoredEventId AS scoredEventId, toFloat(properties.totalScore) AS totalScore
    FROM events
    WHERE event = 'quality.scored'
      AND properties.surface = '${surface}'
      AND timestamp > now() - INTERVAL 7 DAY
    ORDER BY timestamp DESC
    LIMIT 500
  `;
  const r = await runHogQL(q);
  return r.results.map((row) => ({
    scoredEventId: String(row[0]),
    totalScore: Number(row[1]),
  }));
}

async function fetchSourceRows(
  surface: QualityScoredSurface,
  uuids: string[],
): Promise<SourceRow[]> {
  if (uuids.length === 0) return [];
  const eventName = scoredEventNameFor(surface);
  const quotedUuids = uuids.map((u) => `'${u}'`).join(",");
  const q = `
    SELECT toString(uuid) AS uuid, properties
    FROM events
    WHERE event = '${eventName}'
      AND toString(uuid) IN (${quotedUuids})
      AND timestamp > now() - INTERVAL 7 DAY
  `;
  const r = await runHogQL(q);
  return r.results.map((row) => ({
    uuid: String(row[0]),
    properties:
      typeof row[1] === "string"
        ? (JSON.parse(row[1]) as Record<string, unknown>)
        : (row[1] as Record<string, unknown>),
  }));
}

async function selectForSurface(
  surface: QualityScoredSurface,
): Promise<SampledEntry[]> {
  const scored = await fetchScoredRows(surface);
  if (scored.length < 20) {
    throw new Error(
      `${surface}: only ${scored.length} scored events in last 7 days; need at least 20. Run more baseline data first.`,
    );
  }
  const ids = scored.map((s) => s.scoredEventId);
  const sources = await fetchSourceRows(surface, ids);
  const sourceById = new Map(sources.map((s) => [s.uuid, s]));

  const joined: SampledEntry[] = [];
  for (const s of scored) {
    const source = sourceById.get(s.scoredEventId);
    if (!source) continue;
    joined.push({ ...s, source });
  }
  if (joined.length < 20) {
    throw new Error(
      `${surface}: only ${joined.length} scored events have matching source events; need at least 20.`,
    );
  }

  return stratifyByQuartile(joined, (e) => e.totalScore);
}

function buildStubEntry(
  surface: QualityScoredSurface,
  entry: SampledEntry,
): Record<string, unknown> {
  return {
    scoredEvent: scoredEventNameFor(surface),
    scoredEventId: entry.scoredEventId,
    inputContent: extractInputContent(
      { properties: entry.source.properties },
      surface,
    ),
    outputContent: extractOutputContent(
      { properties: entry.source.properties },
      surface,
    ),
    humanScore: 0,
    humanDimensions: {},
    humanNotes: "TODO: label me",
    authoredAt: new Date().toISOString(),
    authoredBy: "claude",
  };
}

async function writeFileFor(
  surface: QualityScoredSurface,
  entries: SampledEntry[],
): Promise<void> {
  const stubs = entries.map((e) => buildStubEntry(surface, e));
  const path = join(__dirname, `${surface}.calibration.json`);
  await writeFile(path, JSON.stringify(stubs, null, 2) + "\n", "utf8");
  // eslint-disable-next-line no-console
  console.log(
    `[select-samples] ${surface}: wrote ${stubs.length} stubs → ${path}`,
  );
}

async function main(): Promise<void> {
  for (const surface of QUALITY_SCORED_SURFACES) {
    // eslint-disable-next-line no-console
    console.log(`[select-samples] processing ${surface}…`);
    const entries = await selectForSurface(surface);
    await writeFileFor(surface, entries);
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("[select-samples] fatal:", err);
  process.exit(1);
});
```

- [ ] **Step 3: Verify `POSTHOG_PERSONAL_API_KEY` is set in `.env`**

Run: `grep -c POSTHOG_PERSONAL_API_KEY .env`
Expected: `1`. If `0`, generate one in PostHog UI under Personal API Keys and add to `.env`. If the env file has it but under a different name, adapt the script's `process.env` reads accordingly.

- [ ] **Step 4: Run the script**

Run: `npx tsx --tsconfig server/tsconfig.json scripts/quality-judge/calibration/select-samples.ts`
Expected output (timing: ~10-20 seconds):

```
[select-samples] processing optimize…
[select-samples] optimize: wrote 20 stubs → .../optimize.calibration.json
[select-samples] processing suggestions…
[select-samples] suggestions: wrote 20 stubs → .../suggestions.calibration.json
[select-samples] processing span-labeling…
[select-samples] span-labeling: wrote 20 stubs → .../span-labeling.calibration.json
```

If a surface reports `< 20 scored events`, you need more baseline data first — run `npm run synthetic` then `npm run judge:run` and retry.

- [ ] **Step 5: Sanity-check the stubs**

Run: `jq '. | length' scripts/quality-judge/calibration/*.calibration.json`
Expected: each file outputs `20`.

Run: `jq '.[0] | keys' scripts/quality-judge/calibration/suggestions.calibration.json`
Expected: array containing `scoredEvent`, `scoredEventId`, `inputContent`, `outputContent`, `humanScore`, `humanDimensions`, `humanNotes`, `authoredAt`, `authoredBy`.

Run: `jq '.[] | .humanScore' scripts/quality-judge/calibration/optimize.calibration.json`
Expected: 20 zeros (all placeholders).

- [ ] **Step 6: Type check**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 7: Commit**

```bash
git add scripts/quality-judge/calibration/select-samples.ts scripts/quality-judge/calibration/*.calibration.json
git commit -m "feat(quality-judge): select-samples.ts + 60 stratified calibration stubs

One-shot script queries PostHog for scored events per surface,
stratifies via Task 1's stratifyByQuartile (5 events per quartile),
joins to source events for content extraction, and writes 20 stub
CalibrationEntry records per surface.

Stubs have placeholder humanScore (0) and humanDimensions ({}). Tasks
3-5 fill them in by hand against the rubric prose without peeking at
the judge's score (per design spec § 2.3)."
```

---

## Task 3: Label `optimize.calibration.json` (20 entries)

**Files:**

- Modify: `scripts/quality-judge/calibration/optimize.calibration.json`

This task is analysis work — there's no code change. The discipline is in § 2.3 of the spec.

- [ ] **Step 1: Open the optimize rubric**

Run: `cat scripts/quality-judge/rubrics/optimize.md`
Read the 5 dimensions: `fidelity`, `detailEnrichment`, `coherence`, `constraintCompliance`, `brevityDiscipline`. Note each dimension's 0/1/3/5 anchor descriptions. Do NOT consult any pre-existing judge scores while labeling.

- [ ] **Step 2: Open the stub file**

Run: `cat scripts/quality-judge/calibration/optimize.calibration.json | jq '.[0]'`
Confirm the shape: `inputContent` has `inputPrompt`, `targetModel`, `mode`, etc.; `outputContent` has `outputPrompt`.

- [ ] **Step 3: Label entry 0**

Use the Edit tool to replace the first entry's placeholder fields:

```jsonc
{
  // ... existing scoredEvent, scoredEventId, inputContent, outputContent ...
  "humanScore": 23, // sum of dimensions
  "humanDimensions": {
    "fidelity": 5,
    "detailEnrichment": 5,
    "coherence": 4,
    "constraintCompliance": 5,
    "brevityDiscipline": 4,
  },
  "humanNotes": "Output preserves all explicit input intent and enriches with camera+lighting detail without invention. Slight redundancy in the final clause keeps brevity at 4.",
  "authoredAt": "<current ISO timestamp>",
  "authoredBy": "claude",
}
```

Apply the rubric anchors literally. Score integers only; no half-points. The numbers above are illustrative — each entry's actual scores depend on its `outputPrompt`.

- [ ] **Step 4: Repeat for entries 1-19**

Read each entry's `inputContent` + `outputContent`. Score each dimension 0-5. Sum to `humanScore`. Write 1-2 sentences in `humanNotes` explaining the dominant factor.

To avoid bias: do NOT query PostHog for the judge's score on this `scoredEventId`. Score against the rubric prose alone.

- [ ] **Step 5: Verify the file is valid JSON and every entry is populated**

Run: `jq '.[] | select(.humanScore == 0 and (.humanDimensions | length) == 0)' scripts/quality-judge/calibration/optimize.calibration.json`
Expected: empty output (no entries remain as placeholders).

Run: `jq '. | length' scripts/quality-judge/calibration/optimize.calibration.json`
Expected: `20`.

Run: `jq '[.[] | .humanScore] | add / length' scripts/quality-judge/calibration/optimize.calibration.json`
Expected: a reasonable mean (somewhere in 14-22, depending on the stratified sample).

- [ ] **Step 6: Commit**

```bash
git add scripts/quality-judge/calibration/optimize.calibration.json
git commit -m "feat(quality-judge): label 20 optimize calibration entries

LLM-authored (Claude) labels against the optimize rubric. Scored each
of 5 dimensions 0-5 per the rubric's anchor descriptions; sum is
humanScore. No peek at the judge's score for any entry (per spec
§ 2.3 'scoring honesty')."
```

---

## Task 4: Label `suggestions.calibration.json` (20 entries)

**Files:**

- Modify: `scripts/quality-judge/calibration/suggestions.calibration.json`

Same shape as Task 3, different rubric.

- [ ] **Step 1: Open the suggestions rubric**

Run: `cat scripts/quality-judge/rubrics/suggestions.md`
Read the 5 dimensions: `relevance`, `diversity`, `categoryFidelity`, `plausibility`, `qualityRange`. Note each dimension's anchor descriptions.

- [ ] **Step 2: Read each stub's content**

Each suggestions stub has `inputContent` with `highlightedText`, `fullPrompt`, `highlightedCategory`, and `outputContent` with `suggestions[]`.

- [ ] **Step 3: Label all 20 entries**

For each entry: read the highlight + full prompt + suggestions array. Score each dimension 0-5. Sum to `humanScore`. Write 1-2 sentences in `humanNotes` explaining the dominant factor.

Apply the rubric anchors literally. Do NOT consult the judge's previously-stored score for any entry.

- [ ] **Step 4: Verify**

Run: `jq '[.[] | select(.humanScore == 0 and (.humanDimensions | length) == 0)] | length' scripts/quality-judge/calibration/suggestions.calibration.json`
Expected: `0`.

Run: `jq '. | length' scripts/quality-judge/calibration/suggestions.calibration.json`
Expected: `20`.

- [ ] **Step 5: Commit**

```bash
git add scripts/quality-judge/calibration/suggestions.calibration.json
git commit -m "feat(quality-judge): label 20 suggestions calibration entries

LLM-authored (Claude) labels against the suggestions rubric. Scored
each of 5 dimensions 0-5 per the rubric's anchor descriptions; sum is
humanScore. No peek at the judge's score (per spec § 2.3)."
```

---

## Task 5: Label `span-labeling.calibration.json` (20 entries)

**Files:**

- Modify: `scripts/quality-judge/calibration/span-labeling.calibration.json`

Same shape, span-labeling rubric.

- [ ] **Step 1: Open the span-labeling rubric**

Run: `cat scripts/quality-judge/rubrics/span-labeling.md`
Read the 5 dimensions: `coverage`, `precision`, `categoryAccuracy`, `granularity`, `boundaryCleanness`. Pay attention to the "common pitfalls to avoid" section listing phantom categories.

- [ ] **Step 2: Read each stub's content**

Each span-labeling stub has `inputContent` with `inputText` and `outputContent` with `spans[]` (each span has `text` + `category`).

- [ ] **Step 3: Label all 20 entries**

For each entry: read the input text + the spans array. Score each dimension 0-5. Sum to `humanScore`. Write 1-2 sentences.

Discipline reminder: do NOT deduct points for categories that are valid taxonomy IDs but were not your first guess (the "common pitfalls" section in the rubric is meant to discourage rejecting `subject.appearance` because you mentally expected `subject.identity` first). Score against what's in the rubric, not your private taxonomy.

- [ ] **Step 4: Verify**

Run: `jq '[.[] | select(.humanScore == 0 and (.humanDimensions | length) == 0)] | length' scripts/quality-judge/calibration/span-labeling.calibration.json`
Expected: `0`.

Run: `jq '. | length' scripts/quality-judge/calibration/span-labeling.calibration.json`
Expected: `20`.

- [ ] **Step 5: Commit**

```bash
git add scripts/quality-judge/calibration/span-labeling.calibration.json
git commit -m "feat(quality-judge): label 20 span-labeling calibration entries

LLM-authored (Claude) labels against the span-labeling rubric. Scored
each of 5 dimensions 0-5 per the rubric's anchor descriptions; sum is
humanScore. Followed the rubric's 'common pitfalls' guidance to avoid
penalizing valid alternative taxonomy categories. No peek at the
judge's score (per spec § 2.3)."
```

---

## Task 6: Run `npm run judge:calibrate` and verify ρ ≥ 0.7

**Files:**

- (none modified — read-only verification)

- [ ] **Step 1: Run the calibration**

Run: `npm run judge:calibrate 2>&1 | tail -20`
Expected: three lines like `[calibration] <surface>: rho=0.XXX MAE=X.XX (n=20)`. Exit code 0 if all three surfaces have ρ ≥ 0.7.

Cost: ~$0.30 in GPT-4o calls (60 events re-judged at ~$0.005 each).

- [ ] **Step 2: Inspect results**

Three outcomes:

**Case A: All three pass (ρ ≥ 0.7).** Sub-project A is done. Move to Task 7.

**Case B: One or more surfaces fail.** Do NOT proceed to Task 7. The judge and my labels diverged significantly on at least one surface. Capture the result:

```bash
npm run judge:calibrate 2>&1 | tee /tmp/calibration-results.txt
```

Open Sub-project A2 brainstorm to triage. Likely causes:

- My labels are inconsistent across the 20 entries (re-read and re-label that surface)
- Rubric is ambiguous (iterate rubric in sub-project A2)
- Judge has a systematic blind spot (rare; would show as MAE high but rank-correlation surprisingly OK or surprisingly bad)

**Case C: Script errors (judge-call failures, malformed entry, etc.)** Read the error, fix the entry or env issue, rerun. Do not iterate on labels reactively to make the score pass — that's anti-calibration.

- [ ] **Step 3: If all pass, record the numbers**

The `[calibration] <surface>: rho=0.XXX MAE=X.XX (n=20)` lines go in the parent spec update (Task 7).

---

## Task 7: Update parent spec § 4.1 and record calibration numbers

**Files:**

- Modify: `docs/superpowers/specs/2026-05-14-baseline-quality-improvement-design.md` § 4.1
- Modify: `docs/superpowers/programs/measurement.md` (record the calibration milestone in the reordering log)

- [ ] **Step 1: Update the parent spec § 4.1**

Read the existing § 4.1 in `docs/superpowers/specs/2026-05-14-baseline-quality-improvement-design.md` and replace it with:

```markdown
### 4.1 Calibration JSON seeding (shipped via Sub-project A on 2026-05-15)

Sub-project A populated all three `scripts/quality-judge/calibration/*.calibration.json` files with 20 stratified, LLM-authored (Claude) labels each. The PR calibration gate workflow now evaluates a real Spearman ρ rather than passing vacuously.

**Final calibration numbers (from `npm run judge:calibrate`, 2026-05-15):**

| Surface       | ρ      | MAE    | n   |
| ------------- | ------ | ------ | --- |
| optimize      | <fill> | <fill> | 20  |
| suggestions   | <fill> | <fill> | 20  |
| span-labeling | <fill> | <fill> | 20  |

**Semantic caveat:** labels were authored by Claude, not a human (per 2026-05-15 design decision). ρ here measures **cross-model agreement** between Claude and GPT-4o, not human-anchored trust. A future Sub-project A2 can replace these with human-authored labels to convert the cross-model check into a true trust anchor.

See [`2026-05-15-quality-judge-calibration-seeding-design.md`](./2026-05-15-quality-judge-calibration-seeding-design.md) for the design and labeling discipline.
```

Replace `<fill>` with the actual numbers from Task 6 step 1.

- [ ] **Step 2: Add a reordering-log entry to the Measurement Program doc**

Open `docs/superpowers/programs/measurement.md`. Find the "### Reordering log" section. Insert at the top of the chronological list (after the most recent existing entry):

```markdown
- **2026-05-15 (Sub-project A):** Quality-judge calibration seeded. 60 stratified events (20 per surface × 3 surfaces) labeled by Claude against rubric prose without consulting the judge's prior scores. `npm run judge:calibrate` now reports Spearman ρ vs Claude labels: optimize <fill>, suggestions <fill>, span-labeling <fill> (n=20 each, MAE <fill>/<fill>/<fill>). The trust threshold ρ ≥ 0.7 passed/<failed> on <list>. Caveat: labels are LLM-authored (cross-model agreement check, not human trust anchor — the parent spec's original intent). Unblocks Sub-projects B (suggestions), C (optimize), D (span-labeling) to proceed with judge scores treated as anchored. New principle encoded: _explicit-trade-off documentation > silently relaxed semantics. The cross-model agreement signal is useful but bounded; B/C/D measurement deltas should be reported as 'judge-vs-judge agreement deltas' rather than 'product quality deltas' until a future Sub-project A2 swaps in human labels._
```

Replace `<fill>` placeholders with actual numbers. Adjust the "passed/failed" sentence based on Task 6 outcome.

- [ ] **Step 3: Update the parent spec's "Tell when you're done" checklist if present**

If the Measurement Program's checklist in `measurement.md` has an entry for "Judge calibration: ρ ≥ 0.7 against hand-labeled examples per surface", change it from unchecked `[ ]` to checked `[x]` (or annotate "shipped via Sub-project A with cross-model agreement caveat").

- [ ] **Step 4: Type/lint sanity (docs only, but the pre-commit hook will run anyway)**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
git add docs/superpowers/specs/2026-05-14-baseline-quality-improvement-design.md docs/superpowers/programs/measurement.md
git commit -m "docs(measurement): record Sub-project A completion + calibration numbers

Updates parent spec § 4.1 to reflect:
  - Actual sample size (20 per surface, not the spec's loose '5-10')
  - LLM-authored labeling semantics (cross-model agreement, not human anchor)
  - Final calibration ρ + MAE per surface

Adds a reordering-log entry summarizing the cross-model check and
flagging that B/C/D measurement deltas should be framed as 'judge-vs-
judge agreement deltas' rather than 'product quality deltas' until a
future Sub-project A2 swaps in human labels."
```

---

## Self-Review Notes

**Spec coverage:**

- Spec § 1 "Locked architectural decisions" → Tasks 1 (stratification), 2 (script + stubs), 3-5 (labeling discipline), 6 (ρ ≥ 0.7), 7 (no-rubric-changes scope).
- Spec § 2.1 "Stratification algorithm" → Task 1 implementation matches all 5 steps.
- Spec § 2.2 "Stub JSON entry format" → Task 2's `buildStubEntry` produces exactly the shape; verified in Task 2 step 5.
- Spec § 2.3 "Labeling discipline" → Tasks 3-5 step 3 enforce all 6 rules; Tasks 3-5 step 1 reads the rubric without consulting judge scores.
- Spec § 2.4 "Calibration run" → Task 6.
- Spec § 2.5 "Verification" → Task 6 step 1 covers the exit-code check; placeholder detection is in Task 2 step 5 and Tasks 3-5 step 4-5.
- Spec § 4 "Risks" → all five rows have at least one mitigation in the plan (stub script omits judge scores, rank-based quartiles, ρ < 0.7 triage path).

**Type consistency:** `CalibrationEntry` shape used in Task 2's `buildStubEntry` matches the `run-calibration.ts:17-26` interface. `stratifyByQuartile<T>(events, getScore): T[]` signature used in Task 2 matches Task 1's implementation. `QualityScoredSurface` and `scoredEventNameFor` come from `judge-event-types.ts` as imported in both Task 2 and the existing code.

**No placeholders:** every step has actual content. The `<fill>` markers in Task 7 are intentional (numbers come from Task 6 at runtime; that's the correct place for them).
