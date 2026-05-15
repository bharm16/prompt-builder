# Baseline Quality Improvement — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate the Layer 5 false-signal in the suggestions surface baseline by making synthetic-harness fixture pairings `(highlightedText, highlightedCategory)` self-consistent, derived from explicit hand-authored data rather than the current `(first two words, tags[0])` heuristic.

**Architecture:** Add `highlights: { text, category }[]` to each prompt fixture. The suggestions driver validates these against `shared/taxonomy.ts` at startup, then iterates them — passing each `(text, category)` pair straight into `EnhancementV2RequestContext`. The optimize and span-labeling drivers are untouched; they don't consume highlights. Validation is extracted into its own module so it can be unit-tested without booting an LLM.

**Tech Stack:** TypeScript (ESM), Vitest, `shared/taxonomy.ts` v3.0.0 (`isValidCategory`).

**Spec:** [`docs/superpowers/specs/2026-05-14-baseline-quality-improvement-design.md`](../specs/2026-05-14-baseline-quality-improvement-design.md)

---

## File Structure

| Action | Path                                                     | Responsibility                                                                  |
| ------ | -------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Create | `scripts/synthetic/utils/fixture-validation.ts`          | Pure validator function (no I/O); throws on bad fixture.                        |
| Create | `scripts/synthetic/__tests__/fixture-validation.test.ts` | Vitest unit tests for the validator.                                            |
| Modify | `scripts/synthetic/utils/request-helper.ts:30-34`        | Extend `HarnessPrompt` with required `highlights` field.                        |
| Modify | `scripts/synthetic/fixtures/prompts.json`                | Add hand-authored `highlights` array to all 20 prompts.                         |
| Modify | `scripts/synthetic/drivers/suggestions.driver.ts`        | Delete dead derivation code; iterate `highlights[]`; call validator at startup. |
| Modify | `docs/superpowers/programs/measurement.md`               | Log Layer 5 fix entry in the reordering log + record post-fix numbers.          |

---

## Task 1: Extend `HarnessPrompt` type with `highlights` field

**Files:**

- Modify: `scripts/synthetic/utils/request-helper.ts:30-34`

- [ ] **Step 1: Modify the `HarnessPrompt` interface**

Replace lines 30-34 of `scripts/synthetic/utils/request-helper.ts`:

```typescript
export interface HarnessPrompt {
  id: string;
  text: string;
  tags: string[];
  highlights: { text: string; category: string }[];
}
```

- [ ] **Step 2: Verify type compiles cleanly**

Run: `npx tsc --noEmit`
Expected: exit 0. (No consumers read `prompt.highlights` yet; existing optimize/span-labeling drivers compile because they only read `prompt.text`.)

- [ ] **Step 3: Commit**

```bash
git add scripts/synthetic/utils/request-helper.ts
git commit -m "refactor(synthetic): add highlights field to HarnessPrompt type"
```

---

## Task 2: Create fixture-validation module (TDD)

**Files:**

- Create: `scripts/synthetic/utils/fixture-validation.ts`
- Create: `scripts/synthetic/__tests__/fixture-validation.test.ts`

- [ ] **Step 1: Write failing tests**

Create `scripts/synthetic/__tests__/fixture-validation.test.ts`:

```typescript
import { describe, expect, it } from "vitest";

import { validateSuggestionsFixtures } from "../utils/fixture-validation.js";
import type { HarnessPrompt } from "../utils/request-helper.js";

function makePrompt(overrides: Partial<HarnessPrompt> = {}): HarnessPrompt {
  return {
    id: "test_01",
    text: "A young woman walks through a misty forest",
    tags: ["subject"],
    highlights: [{ text: "A young woman", category: "subject.identity" }],
    ...overrides,
  };
}

describe("validateSuggestionsFixtures", () => {
  it("passes on well-formed fixtures with valid taxonomy categories", () => {
    expect(() => validateSuggestionsFixtures([makePrompt()])).not.toThrow();
  });

  it("throws when a prompt has zero highlights", () => {
    const bad = makePrompt({ highlights: [] });
    expect(() => validateSuggestionsFixtures([bad])).toThrow(
      /test_01.*at least one highlight/i,
    );
  });

  it("throws when a highlight category is not in shared/taxonomy.ts", () => {
    const bad = makePrompt({
      highlights: [{ text: "A young woman", category: "mood" }],
    });
    expect(() => validateSuggestionsFixtures([bad])).toThrow(
      /test_01.*invalid category.*mood/i,
    );
  });

  it("throws when highlight text is not a substring of the prompt", () => {
    const bad = makePrompt({
      highlights: [{ text: "a llama", category: "subject.identity" }],
    });
    expect(() => validateSuggestionsFixtures([bad])).toThrow(
      /test_01.*highlight text.*not found.*a llama/i,
    );
  });

  it("reports the prompt id in every error message for debuggability", () => {
    const bad = makePrompt({ id: "compound_07", highlights: [] });
    expect(() => validateSuggestionsFixtures([bad])).toThrow(/compound_07/);
  });

  it("validates every prompt and fails on the first bad one (loud, early)", () => {
    const good = makePrompt({ id: "good_01" });
    const bad = makePrompt({ id: "bad_02", highlights: [] });
    expect(() => validateSuggestionsFixtures([good, bad])).toThrow(/bad_02/);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run scripts/synthetic/__tests__/fixture-validation.test.ts`
Expected: FAIL — module `../utils/fixture-validation.js` cannot be resolved.

- [ ] **Step 3: Implement the validator**

Create `scripts/synthetic/utils/fixture-validation.ts`:

```typescript
/**
 * Pure validator for the suggestions surface's fixture format.
 *
 * The suggestions driver requires each prompt to carry one or more
 * (highlightedText, highlightedCategory) pairs that are internally
 * self-consistent — meaning the text appears in the prompt and the
 * category is a real taxonomy ID. Without this check, an authoring
 * mistake silently feeds the engine contradictory input and the
 * quality judge correctly penalizes the resulting off-context output,
 * which then masquerades as a product quality problem (it isn't).
 *
 * See docs/superpowers/specs/2026-05-14-baseline-quality-improvement-design.md
 * § 1 for the Layer 5 false-signal context.
 */

import { isValidCategory } from "../../../shared/taxonomy.js";

import type { HarnessPrompt } from "./request-helper.js";

export function validateSuggestionsFixtures(prompts: HarnessPrompt[]): void {
  for (const prompt of prompts) {
    if (!Array.isArray(prompt.highlights) || prompt.highlights.length === 0) {
      throw new Error(
        `Fixture ${prompt.id}: must declare at least one highlight in 'highlights' array.`,
      );
    }

    for (const highlight of prompt.highlights) {
      if (!isValidCategory(highlight.category)) {
        throw new Error(
          `Fixture ${prompt.id}: invalid category '${highlight.category}'. ` +
            `Must be a valid ID per shared/taxonomy.ts (9 parent categories or namespaced attribute ID).`,
        );
      }
      if (!prompt.text.includes(highlight.text)) {
        throw new Error(
          `Fixture ${prompt.id}: highlight text '${highlight.text}' not found as substring of prompt.text. ` +
            `Hand-authored highlights must be substrings of the prompt to mirror production span-labeling output.`,
        );
      }
    }
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run scripts/synthetic/__tests__/fixture-validation.test.ts`
Expected: PASS — 6 tests pass.

- [ ] **Step 5: Type check**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add scripts/synthetic/utils/fixture-validation.ts scripts/synthetic/__tests__/fixture-validation.test.ts
git commit -m "feat(synthetic): add fixture-validation module for suggestions highlights

Layer 5 of the measurement-system false-signal hunt — pure validator
that catches authoring mistakes (missing highlights, invalid taxonomy
categories, non-substring text) at driver startup. Six TDD tests cover
all error paths. See specs/2026-05-14-baseline-quality-improvement-design.md."
```

---

## Task 3: Author highlights for all 20 fixtures

**Files:**

- Modify: `scripts/synthetic/fixtures/prompts.json`

- [ ] **Step 1: Rewrite the fixture file with hand-authored highlights**

Replace the entire contents of `scripts/synthetic/fixtures/prompts.json` with:

```json
[
  {
    "id": "subject_01",
    "text": "A young woman with red hair walks through a misty forest at dawn",
    "tags": ["subject", "lighting", "setting"],
    "highlights": [
      { "text": "A young woman", "category": "subject.identity" },
      { "text": "red hair", "category": "subject.appearance" },
      { "text": "misty forest", "category": "environment.location" },
      { "text": "dawn", "category": "lighting.timeOfDay" }
    ]
  },
  {
    "id": "subject_02",
    "text": "An elderly fisherman casts his line into a calm mountain lake",
    "tags": ["subject", "setting", "action"],
    "highlights": [
      { "text": "An elderly fisherman", "category": "subject.identity" },
      { "text": "casts his line", "category": "action.movement" },
      { "text": "calm mountain lake", "category": "environment.location" }
    ]
  },
  {
    "id": "camera_01",
    "text": "Aerial drone shot pulling back from a city skyline at sunset",
    "tags": ["camera.movement", "setting", "lighting"],
    "highlights": [
      { "text": "Aerial drone shot", "category": "camera.movement" },
      { "text": "city skyline", "category": "environment.location" },
      { "text": "sunset", "category": "lighting.timeOfDay" }
    ]
  },
  {
    "id": "camera_02",
    "text": "Macro close-up of dewdrops on a spider web, shallow depth of field",
    "tags": ["camera.shot", "subject"],
    "highlights": [
      { "text": "Macro close-up", "category": "shot.type" },
      { "text": "dewdrops", "category": "subject.identity" },
      { "text": "shallow depth of field", "category": "camera.focus" }
    ]
  },
  {
    "id": "lighting_01",
    "text": "A dimly lit jazz club with a single spotlight on a saxophone player",
    "tags": ["lighting", "subject", "setting"],
    "highlights": [
      { "text": "dimly lit", "category": "lighting.quality" },
      { "text": "single spotlight", "category": "lighting.source" },
      { "text": "saxophone player", "category": "subject.identity" }
    ]
  },
  {
    "id": "lighting_02",
    "text": "Bright midday sun cuts through tropical palm leaves",
    "tags": ["lighting", "setting"],
    "highlights": [
      { "text": "Bright midday sun", "category": "lighting.source" },
      { "text": "tropical palm leaves", "category": "environment.location" }
    ]
  },
  {
    "id": "motion_01",
    "text": "Slow motion shot of a hummingbird hovering near a hibiscus flower",
    "tags": ["camera.speed", "subject", "action"],
    "highlights": [
      { "text": "Slow motion", "category": "technical.frameRate" },
      { "text": "a hummingbird", "category": "subject.identity" },
      { "text": "hovering", "category": "action.movement" }
    ]
  },
  {
    "id": "motion_02",
    "text": "Time-lapse of clouds racing over a desert mesa",
    "tags": ["camera.speed", "setting"],
    "highlights": [
      { "text": "Time-lapse", "category": "shot.type" },
      { "text": "clouds racing", "category": "action.movement" },
      { "text": "desert mesa", "category": "environment.location" }
    ]
  },
  {
    "id": "style_01",
    "text": "Cinematic anamorphic shot, film grain, teal and orange color grade",
    "tags": ["style", "color"],
    "highlights": [
      { "text": "anamorphic", "category": "camera.lens" },
      { "text": "film grain", "category": "style.filmStock" },
      { "text": "teal and orange color grade", "category": "style.colorGrade" }
    ]
  },
  {
    "id": "style_02",
    "text": "Wes Anderson symmetrical composition, pastel palette",
    "tags": ["style", "composition"],
    "highlights": [
      { "text": "Wes Anderson", "category": "style.aesthetic" },
      { "text": "symmetrical composition", "category": "style.aesthetic" },
      { "text": "pastel palette", "category": "style.colorGrade" }
    ]
  },
  {
    "id": "action_01",
    "text": "A barista pours steamed milk creating a heart pattern in coffee",
    "tags": ["action", "subject", "camera.shot"],
    "highlights": [
      { "text": "A barista", "category": "subject.identity" },
      { "text": "pours steamed milk", "category": "action.movement" }
    ]
  },
  {
    "id": "action_02",
    "text": "Two children chase fireflies in a backyard at dusk",
    "tags": ["action", "subject", "lighting"],
    "highlights": [
      { "text": "Two children", "category": "subject.identity" },
      { "text": "chase fireflies", "category": "action.movement" },
      { "text": "dusk", "category": "lighting.timeOfDay" }
    ]
  },
  {
    "id": "setting_01",
    "text": "A bustling night market in Bangkok with neon signs reflected in puddles",
    "tags": ["setting", "lighting"],
    "highlights": [
      { "text": "bustling night market", "category": "environment.location" },
      { "text": "Bangkok", "category": "environment.location" },
      { "text": "neon signs", "category": "lighting.source" }
    ]
  },
  {
    "id": "setting_02",
    "text": "An abandoned 1950s diner overgrown with vines",
    "tags": ["setting", "subject"],
    "highlights": [
      {
        "text": "An abandoned 1950s diner",
        "category": "environment.location"
      },
      { "text": "overgrown with vines", "category": "environment.context" }
    ]
  },
  {
    "id": "compound_01",
    "text": "Handheld camera follows a chef through a busy restaurant kitchen, warm tungsten lighting, shallow focus pulls between faces",
    "tags": [
      "camera.movement",
      "subject",
      "setting",
      "lighting",
      "camera.shot"
    ],
    "highlights": [
      { "text": "Handheld camera", "category": "camera.movement" },
      { "text": "a chef", "category": "subject.identity" },
      { "text": "busy restaurant kitchen", "category": "environment.location" },
      { "text": "warm tungsten lighting", "category": "lighting.colorTemp" },
      { "text": "shallow focus", "category": "camera.focus" }
    ]
  },
  {
    "id": "compound_02",
    "text": "Wide angle establishing shot of a snowy village, dolly forward toward a single illuminated window",
    "tags": ["camera.shot", "camera.movement", "setting", "lighting"],
    "highlights": [
      { "text": "Wide angle", "category": "camera.lens" },
      { "text": "establishing shot", "category": "shot.type" },
      { "text": "snowy village", "category": "environment.location" },
      { "text": "dolly forward", "category": "camera.movement" }
    ]
  },
  {
    "id": "compound_03",
    "text": "Golden hour light catches dust motes in an antique library, slow vertical pan reveals towering bookshelves",
    "tags": ["lighting", "camera.movement", "setting"],
    "highlights": [
      { "text": "Golden hour light", "category": "lighting.timeOfDay" },
      { "text": "antique library", "category": "environment.location" },
      { "text": "slow vertical pan", "category": "camera.movement" }
    ]
  },
  {
    "id": "minimal_01",
    "text": "A red balloon floats up",
    "tags": ["subject", "action"],
    "highlights": [
      { "text": "A red balloon", "category": "subject.identity" },
      { "text": "floats up", "category": "action.movement" }
    ]
  },
  {
    "id": "minimal_02",
    "text": "Rain on a window",
    "tags": ["subject", "setting"],
    "highlights": [
      { "text": "Rain", "category": "environment.weather" },
      { "text": "a window", "category": "environment.location" }
    ]
  },
  {
    "id": "minimal_03",
    "text": "A single candle flickers",
    "tags": ["subject", "lighting"],
    "highlights": [
      { "text": "A single candle", "category": "subject.identity" },
      { "text": "flickers", "category": "action.movement" }
    ]
  }
]
```

Total: 20 prompts, 56 highlights.

- [ ] **Step 2: Run the validator against the real fixtures**

Write a one-off verification command (no file needed):

```bash
npx tsx -e "import('./scripts/synthetic/utils/request-helper.ts').then(async (m) => { const p = await m.loadPrompts(); const v = await import('./scripts/synthetic/utils/fixture-validation.ts'); v.validateSuggestionsFixtures(p); console.log('OK: ' + p.length + ' prompts, ' + p.reduce((n, x) => n + x.highlights.length, 0) + ' highlights'); })"
```

Expected output: `OK: 20 prompts, 56 highlights`

If validation throws, fix the offending fixture entry per the error message (typo in a category, text doesn't appear in prompt, etc.) and rerun.

- [ ] **Step 3: Type check**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add scripts/synthetic/fixtures/prompts.json
git commit -m "feat(synthetic): hand-author self-consistent highlights for all 20 fixtures

Each prompt now carries 2-5 (highlightedText, highlightedCategory) pairs
where the text is a substring of the prompt and the category is a real
taxonomy ID. Replaces the (first-two-words, tags[0]) heuristic that
produced contradictory pairs like ('Time-lapse of', camera.focus).

Validator from Task 2 confirms: 20 prompts, 56 highlights, all valid."
```

---

## Task 4: Rewrite the suggestions driver to consume highlights

**Files:**

- Modify: `scripts/synthetic/drivers/suggestions.driver.ts`

- [ ] **Step 1: Replace the entire driver file**

Replace `scripts/synthetic/drivers/suggestions.driver.ts` with:

```typescript
/**
 * Emits one `suggestions.completed` event per (prompt, highlight) pair
 * by invoking the live EnhancementV2Engine. Underlying `llm.call.completed`
 * events are emitted by the AIModelService telemetry hook — no fake records.
 *
 * Highlights are read directly from each fixture (validated at startup
 * against shared/taxonomy.ts) — no derivation. See
 * docs/superpowers/specs/2026-05-14-baseline-quality-improvement-design.md
 * for the Layer 5 false-signal context.
 */

import { EnhancementV2Engine } from "../../../server/src/services/enhancement/v2/EnhancementV2Engine.js";
import type {
  EnhancementV2RequestContext,
  EnhancementV2Execution,
} from "../../../server/src/services/enhancement/v2/types.js";
import { VideoPromptService } from "../../../server/src/services/video-prompt-analysis/index.js";
import { AIServiceVideoPromptLlmGateway } from "../../../server/src/services/video-prompt-analysis/services/llm/VideoPromptLlmGateway.js";
import { SuggestionDiversityEnforcer } from "../../../server/src/services/enhancement/services/SuggestionDeduplicator.js";
import type { AIModelService } from "../../../server/src/services/ai-model/index.js";
import type { SuggestionsTelemetryService } from "../../../server/src/services/observability/SuggestionsTelemetryService.js";
import { validateSuggestionsFixtures } from "../utils/fixture-validation.js";
import {
  runInSyntheticContext,
  syntheticDistinctId,
  type DriverSummary,
  type HarnessPrompt,
} from "../utils/request-helper.js";

interface DriverDeps {
  suggestions: SuggestionsTelemetryService;
  aiService: AIModelService;
}

const POLICY_VERSION = "2026-03-v2a";

function buildContext(
  prompt: HarnessPrompt,
  highlightedText: string,
  highlightedCategory: string,
): EnhancementV2RequestContext {
  const idx = prompt.text.indexOf(highlightedText);
  const contextBefore = idx > 0 ? prompt.text.slice(0, idx) : "";
  const contextAfter =
    idx >= 0 ? prompt.text.slice(idx + highlightedText.length) : "";

  return {
    highlightedText,
    contextBefore,
    contextAfter,
    fullPrompt: prompt.text,
    originalUserPrompt: prompt.text,
    brainstormContext: null,
    highlightedCategory,
    highlightedCategoryConfidence: 1,
    isPlaceholder: false,
    isVideoPrompt: true,
    phraseRole: highlightedCategory,
    highlightWordCount: highlightedText.split(/\s+/).length,
    videoConstraints: null,
    modelTarget: null,
    promptSection: null,
    spanAnchors: "",
    nearbySpanHints: "",
    lockedSpanCategories: [],
    debug: false,
  };
}

export async function driveSuggestions(
  deps: DriverDeps,
  prompts: HarnessPrompt[],
): Promise<DriverSummary> {
  validateSuggestionsFixtures(prompts);

  const distinctId = syntheticDistinctId();
  let surfaceEvents = 0;

  const videoPromptService = new VideoPromptService({
    videoPromptLlmGateway: new AIServiceVideoPromptLlmGateway(deps.aiService),
  });
  const diversityEnforcer = new SuggestionDiversityEnforcer(deps.aiService);
  const v2Engine = new EnhancementV2Engine({
    aiService: deps.aiService,
    videoPromptService,
    diversityEnforcer,
    policyVersion: POLICY_VERSION,
  });

  for (const prompt of prompts) {
    for (let h = 0; h < prompt.highlights.length; h++) {
      const highlight = prompt.highlights[h]!;
      const requestId = `synthetic-suggestions-${prompt.id}-h${h}`;

      await runInSyntheticContext(requestId, async () => {
        const trace = deps.suggestions.startSuggestionsTrace(
          requestId,
          distinctId,
        );
        const context = buildContext(
          prompt,
          highlight.text,
          highlight.category,
        );

        try {
          const execution: EnhancementV2Execution =
            await v2Engine.execute(context);
          const suggestionTexts = execution.finalSuggestions.map((s) => s.text);

          trace.complete({
            outcome: "success",
            promptLength: prompt.text.length,
            suggestionCount: suggestionTexts.length,
            highlightedCategory: highlight.category,
            isVideoPrompt: true,
            isPlaceholder: false,
            modelTarget: null,
            promptSection: null,
            phraseRole: highlight.category,
            policyVersion: POLICY_VERSION,
            categoryId: execution.debug.categoryId,
            engineMode: execution.debug.mode,
            modelCallCount: execution.debug.modelCallCount,
            fallbackApplied: false,
            debug: false,
            highlightedText: highlight.text,
            fullPrompt: prompt.text,
            suggestions: suggestionTexts,
          });
          surfaceEvents++;
          const dbg = execution.debug;
          console.log(
            `[suggestions] ${prompt.id}/h${h} "${highlight.text}" (cat=${dbg.categoryId} mode=${dbg.mode}) → ${suggestionTexts.length} suggestions | stages=${JSON.stringify(dbg.stageCounts)} rejects=${JSON.stringify(dbg.rejectionSummary)}`,
          );
        } catch (err) {
          trace.complete({
            outcome: "error",
            promptLength: prompt.text.length,
            suggestionCount: 0,
            highlightedCategory: highlight.category,
            isVideoPrompt: true,
            isPlaceholder: false,
            modelTarget: null,
            promptSection: null,
            phraseRole: highlight.category,
            policyVersion: POLICY_VERSION,
            categoryId: null,
            engineMode: null,
            modelCallCount: 0,
            fallbackApplied: false,
            debug: false,
            highlightedText: highlight.text,
            fullPrompt: prompt.text,
            suggestions: [],
          });
          console.warn(
            `[suggestions] ${prompt.id}/h${h} errored: ${(err as Error).message}`,
          );
        }
      });
    }
  }

  return {
    surface: "suggestions",
    promptCount: prompts.length,
    surfaceEventsEmitted: surfaceEvents,
    llmEventsEmitted: 0,
  };
}
```

Key changes vs the prior version:

- Imports `validateSuggestionsFixtures` and calls it as the first line of `driveSuggestions`.
- `TAG_TO_POLICY_ID`, `mapTagToPolicy`, and the word-slicing heuristic are deleted.
- `buildContext` now takes `(prompt, highlightedText, highlightedCategory)` directly rather than computing them.
- Outer loop iterates prompts; inner loop iterates `prompt.highlights[]`. RequestId includes `h${index}` for uniqueness.
- Per-highlight logging shows the text and category for easier dashboard correlation.

- [ ] **Step 2: Type check**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 3: Lint**

Run: `npx eslint --config config/lint/eslint.config.js scripts/synthetic/ --quiet`
Expected: 0 errors.

- [ ] **Step 4: Unit tests still pass**

Run: `npx vitest run scripts/synthetic/__tests__/fixture-validation.test.ts`
Expected: 6 tests pass.

- [ ] **Step 5: Smoke-test the validator by running the synthetic harness in dry mode (no API key)**

Temporarily unset `POSTHOG_API_KEY` so PostHog emits to the no-op stub, then run:

```bash
POSTHOG_API_KEY="" npm run synthetic -- --only suggestions 2>&1 | head -30
```

Expected: harness boots, validator passes (no error before LLM calls), then the harness proceeds to call the live LLM for each highlight. If your local env has no `GEMINI_API_KEY` / `GROQ_API_KEY` either, expect LLM-call errors per highlight — that's fine. The point of this smoke test is to confirm the validator runs without throwing on real fixtures.

If the validator throws, fix the offending fixture per the error and rerun. If LLM calls fail with API-key errors only, the validation passed and you're done with this step.

- [ ] **Step 6: Commit**

```bash
git add scripts/synthetic/drivers/suggestions.driver.ts
git commit -m "refactor(synthetic): suggestions driver consumes self-consistent highlights

Deletes TAG_TO_POLICY_ID, mapTagToPolicy, and the (first-two-words)
derivation. The driver now reads (text, category) pairs straight from
fixtures and validates them via fixture-validation.ts at startup —
loud fail before any LLM call fires.

Outer loop iterates prompts, inner loop iterates highlights, producing
~56 suggestions.completed events per run (vs the prior 20). Each event
carries the canonical (text, category) pair from the fixture.

Layer 5 of the false-signal hunt. See specs/2026-05-14-baseline-quality-improvement-design.md."
```

---

## Task 5: Rerun baseline and record results

**Files:**

- Modify: `docs/superpowers/programs/measurement.md`

- [ ] **Step 1: Run the synthetic harness for suggestions**

Run: `npm run synthetic -- --only suggestions`
Expected: ends with `=== Summary ===` showing `suggestions: 56 surface events (across 20 prompts)`.

Note: this calls real Gemini + Groq APIs and burns a few cents. The "TOTAL: ... events" line includes `llm.call.completed` events from `AIModelService` telemetry.

- [ ] **Step 2: Run the judge against the new events**

Wait until at least ~30 seconds have passed since the harness exited (PostHog ingestion lag — HogQL queries don't see in-flight events). Then:

```bash
npm run judge:run -- --surface suggestions
```

Expected: prints `[quality-judge] running for suggestions` and no per-event errors. Successful scores emit to PostHog as `quality.scored` events; only failures log.

- [ ] **Step 3: Query PostHog for post-fix dimension averages**

Use the PostHog HogQL query tool with this query (replace via the MCP `mcp__posthog__query-run` tool, or the PostHog web UI):

```sql
SELECT
  count() AS n,
  avg(toFloat(JSONExtractRaw(properties.dimensions, 'relevance'))) AS relevance,
  avg(toFloat(JSONExtractRaw(properties.dimensions, 'diversity'))) AS diversity,
  avg(toFloat(JSONExtractRaw(properties.dimensions, 'categoryFidelity'))) AS categoryFidelity,
  avg(toFloat(JSONExtractRaw(properties.dimensions, 'plausibility'))) AS plausibility,
  avg(toFloat(JSONExtractRaw(properties.dimensions, 'qualityRange'))) AS qualityRange,
  avg(toFloat(properties.totalScore)) AS totalScore
FROM events
WHERE event = 'quality.scored'
  AND properties.surface = 'suggestions'
  AND timestamp > now() - INTERVAL 15 MINUTE
```

Record the results in the table below for the reordering-log entry.

- [ ] **Step 4: Update the Measurement Program reordering log**

Edit `docs/superpowers/programs/measurement.md` — insert a new entry into the "### Reordering log" section, **at the top of the chronological list** (i.e., immediately after the existing `**2026-05-14 (later):**` entry, as the most recent layer fix).

Add this entry (replace `<NUMBER>` placeholders with actual measured values from Step 3):

```markdown
- **2026-05-14 (Layer 5):** Fifth measurement-system false-signal layer: synthetic suggestions fixture self-consistency. The 2026-05-14 baseline scored suggestions at 16.02/25, dragged by relevance (2.53) and categoryFidelity (2.49) — both due to the driver deriving `highlightedText` from `prompt.text`'s first two words and `highlightedCategory` from `prompt.tags[0]`, producing contradictory pairs like (`"Time-lapse of"`, `camera.focus`). The engine honestly produced `camera.focus` suggestions; the judge correctly penalized them as off-context. Fixed by extending fixtures with hand-authored `highlights: [{ text, category }][]` (20 prompts, 56 highlights), validated at driver startup against `shared/taxonomy.ts` v3.0.0. Post-fix: suggestions <NUMBER>/25 (relevance <NUMBER>, categoryFidelity <NUMBER>, plausibility <NUMBER>, diversity <NUMBER>, qualityRange <NUMBER>). New rule encoded: _fixture pairings that derive multiple consumer inputs from independent fixture fields are themselves classifiers — same risk as rubric / harness output / scorer layers, and need the same explicit verification._
```

Also update the "Tell when you're done" checklist if any item shifts status as a result of the rerun (most likely no — Phase 1 didn't change the calibration JSON or GH secrets state).

- [ ] **Step 5: Commit the program-doc update**

```bash
git add docs/superpowers/programs/measurement.md
git commit -m "docs(measurement): record Layer 5 fix and post-fix suggestions baseline

Layer 5 of the false-signal hunt closed: fixture self-consistency for
the synthetic suggestions driver. Post-fix per-dimension breakdown
recorded in the reordering log. Phase 2 (real product quality push)
opens once the new floor is identified from the post-fix numbers."
```

- [ ] **Step 6: Reflect on the result**

Compare post-fix relevance and categoryFidelity to the pre-fix 2.53 / 2.49:

- **If both lifted to ≥ 4.0:** the Layer 5 artifact was the dominant driver, as predicted. Phase 1 done. Move to Phase 2 brainstorm with whichever dimension is now the floor.
- **If they lifted only partially (e.g., 3.0-3.8):** there's a real product issue mixed with the artifact. Phase 2 brainstorm targets the residual gap with cleaner data.
- **If they barely moved:** the artifact was NOT the dominant driver. Phase 2 brainstorm starts from a different hypothesis — the engine has a categoryFidelity problem independent of input quality.

Report the outcome inline before opening Phase 2.

---

## Self-Review Notes

**Spec coverage:**

- Spec § 1 "Locked architectural decisions" — every row covered by Tasks 1-4.
- Spec § 2.1 "New fixture shape" — Task 3.
- Spec § 2.2 "Driver change" — Task 4.
- Spec § 2.3 "Verification" — Task 5 (steps 1-3).
- Spec § 4 "Phase 3 follow-ups" — explicitly out of scope for this plan; calibration JSON + GH secrets get their own plans.
- Spec § 5 "Risks" — mitigations baked into Task 2 (validator) and Task 3 (substring constraint).
- Spec § 6 "Sequencing" — Task 5 step 4 updates the reordering log per sequencing step 3.

**Type consistency:** `HarnessPrompt.highlights` shape, `validateSuggestionsFixtures` signature, and `buildContext` parameter list all agree across Tasks 1-4.

**No placeholders:** every step has actual content. The only `<NUMBER>` placeholders are in Task 5 step 4 because the values come from PostHog at runtime; that's the correct place for them.
