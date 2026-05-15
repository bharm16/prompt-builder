# Suggestions Scene-Summary First — Design Spec

**Date:** 2026-05-15
**Program:** Sub-project B under the [Baseline Quality Improvement plan](./2026-05-14-baseline-quality-improvement-design.md). First product-quality push after Sub-project A's calibration unblocked B/C/D.
**Estimate:** ~half day for prompt + schema + telemetry + verification.
**Branch:** off `main`
**Feature flag:** none — applies to all live suggestions traffic; rollback is reverting the schema + prompt commits.

---

## 0. Why

The 2026-05-14 post-Phase-1 baseline scored suggestions at 20.06/25 with this per-dimension breakdown:

| Dimension        | Score    | Reading  |
| ---------------- | -------- | -------- |
| plausibility     | 4.70     | strong   |
| categoryFidelity | 4.19     | strong   |
| diversity        | 3.83     | mid      |
| qualityRange     | 3.77     | mid      |
| **relevance**    | **3.57** | **weak** |

Calibration data confirmed the failure mode is consistent and structural: the engine produces category-correct, grammatical drop-ins that nonetheless miss the prompt's specific scene context. Five observed examples from the calibration set:

- `"Aerial drone shot pulling back from a city skyline at sunset"` + `camera.movement` → suggestions like "slow dolly forward" (ground-based, contradicts aerial).
- `"Wes Anderson symmetrical composition, pastel palette"` + `style` → "Pastel", "Symmetrical", "Stylized" (descriptors of his style rather than alternative directors/aesthetics).
- `"Handheld camera follows a chef..."` + `camera.movement` → "slow dolly" suggestions (confuses handheld stabilization with dolly movement).
- `"...neon signs reflected in puddles"` + `lighting.source` → "soft window light" (misses the urban-neon scene).
- `"A barista pours steamed milk..."` + `subject.identity` → single suggestion "A coffee shop employee" (zero diversity, downgraded specificity).

Sub-project A's calibration anchors the suggestions surface at Spearman ρ=0.755 vs Claude labels, MAE=2.95. Score deltas from this work will be measurable as judge-vs-judge agreement deltas (the cross-model agreement caveat from Sub-project A still applies — see [A's spec § 0](./2026-05-15-quality-judge-calibration-seeding-design.md)).

### Mechanism hypothesis

LLMs follow stated constraints but don't independently reason about unstated ones. The current EnhancementV2 prompt:

- Tells the LLM the category to honor
- Tells the LLM the grammar/word-range constraints
- Provides `<full_prompt>...</full_prompt>` as context
- Has a general "scene-coherence" rule with example bullets

The LLM honors category and grammar (categoryFidelity 4.19, plausibility 4.70) but doesn't extract scene-specific constraints from the full_prompt unless asked to. The proposed fix: force the LLM to write a one-sentence `scene_summary` BEFORE generating suggestions. Because LLMs generate left-to-right and condition on their own prior output, the model emits the summary first and then has its own scene-articulation in context while emitting each suggestion.

### Success criterion (locked 2026-05-15)

- **Primary:** relevance 3.57 → 4.3+ on the post-Phase-1 synthetic baseline.
- **No regression:** categoryFidelity ≥ 4.0 (currently 4.19), plausibility ≥ 4.5 (currently 4.70), diversity ≥ 3.5 (currently 3.83), qualityRange ≥ 3.5 (currently 3.77).
- **Total:** 20.06 → 22+ on suggestions surface.

If relevance lifts but categoryFidelity or plausibility regress below their floors, the work is incomplete — narrow the change before shipping.

---

## 1. Locked architectural decisions

| Decision            | Choice                                                                                                                     | Reason                                                                                                                                                                     |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Approach            | **Force scene-narrative-first JSON output** (Approach A from the brainstorm)                                               | Targets the structural failure (LLM doesn't articulate scene constraints unless asked). Cheap (~30-50 tokens/call). Mechanistically grounded in autoregressive generation. |
| Field name          | **`scene_summary`**                                                                                                        | Snake-case to match the existing JSON field naming convention (e.g., `enhancement_suggestions`, `suggestionSchemaName`).                                                   |
| Field position      | **First key in the output object, BEFORE `suggestions`**                                                                   | Autoregressive ordering matters — the summary tokens must be in the LLM's own context when it generates each suggestion.                                                   |
| Field requirement   | **Required** in the schema (both OpenAI strict + Groq simplified variants)                                                 | A missing field defeats the mechanism.                                                                                                                                     |
| Engine consumption  | **Log to telemetry, do not validate or use programmatically**                                                              | The field's purpose is to influence the model's own reasoning. Downstream code (scoring, ranking) operates on `suggestions` as before.                                     |
| Schema variants     | **Both OpenAI strict and Groq simplified updated in same commit**                                                          | Schema drift between providers is a known false-signal class; keep them in lockstep.                                                                                       |
| Custom-request path | **Untouched** — `buildCustomPrompt` and `getCustomSuggestionSchema` keep the current shape                                 | The user's custom request IS the scene constraint. Scope this sub-project to the slot-policy path.                                                                         |
| Telemetry plumbing  | **In scope** — `sceneSummary` rides on the `suggestions.completed` event                                                   | Enables future calibration iteration; cheap (~30-50 tokens/event in storage).                                                                                              |
| Fallback behavior   | **Tolerant parse**: if `scene_summary` is missing or empty, log a warning, proceed with `suggestions` extraction unchanged | Schema marks it required but the engine's robustness should not regress if a provider drifts.                                                                              |
| Acceptance          | Synthetic baseline rerun + judge rerun, query the calibrated judge, verify the success criterion above                     | Same measurement pipeline used by Sub-project A.                                                                                                                           |

---

## 2. The contract

### 2.1 New output schema (both provider variants)

The outer object's required array changes from `["suggestions"]` to `["scene_summary", "suggestions"]`. Properties gain:

```jsonc
{
  "scene_summary": {
    "type": "string",
    "description": "ONE SENTENCE identifying the scene's setting, tone, and constraints (e.g., 'aerial drone shot over urban skyline at sunset — suggestions must be airborne; ground-based movements are invalid'). Emit this BEFORE the suggestions array. The constraints you state here apply to every suggestion that follows.",
  },
  // ...existing suggestions array shape unchanged...
}
```

OpenAI strict mode requires the `additionalProperties: false` invariant — adding `scene_summary` is safe (it's a new known field). Groq simplified schema accepts the change with no special handling.

### 2.2 Prompt builder update

`EnhancementV2PromptBuilder.buildPrompt()` adds these lines to the prompt, near the top of the RULES section:

```
- BEFORE the suggestions array, emit `scene_summary` (one sentence): identify
  the scene's setting, tone, and constraints visible in `full_prompt`. Name
  any modifiers that constrain the slot (e.g., aerial vs ground-level,
  handheld vs stabilized, dim vs bright, abandoned vs occupied). State what
  would make a suggestion fit — and what would make it fail.
- Every suggestion in `suggestions` must satisfy the constraints you named
  in `scene_summary`.
```

The existing "Scene-coherence" rule (lines 64) is updated to point at `scene_summary` instead of restating its content.

The final JSON-shape instruction at the bottom of the prompt changes from:

```
Return a JSON array of suggestion objects with fields:
- text
- category
- explanation
```

to:

```
Return a JSON object with these fields IN THIS ORDER:
1. `scene_summary` (string): the one-sentence scene constraint statement.
2. `suggestions` (array): each item is a suggestion object with `text`,
   `category`, `explanation`.
```

### 2.3 Engine extraction

`EnhancementV2Engine.execute()` currently calls `StructuredOutputEnforcer.enforceJSON()` and presumably gets an object with `suggestions` field. The engine continues using `response.suggestions` for downstream scoring/ranking. Additionally:

- If `response.scene_summary` is a non-empty string, stash on `execution.debug.sceneSummary`.
- If missing or empty, log a single info-level message (not a warning — this is expected during early rollout) and proceed.

### 2.4 Telemetry

`SuggestionsTelemetryService.startSuggestionsTrace(...).complete(opts)` gains an optional `sceneSummary?: string` field in its options. The `suggestions.completed` PostHog event gains `sceneSummary` in its properties payload alongside the existing `highlightedText`, `fullPrompt`, `suggestions`, etc.

The synthetic harness's suggestions driver passes through `execution.debug.sceneSummary` into the telemetry call.

### 2.5 Acceptance test

After implementation, the verification protocol from Sub-project A's spec applies:

1. Run `npm run synthetic -- --only suggestions`.
2. Wait for PostHog ingestion (~30 seconds).
3. Run `npm run judge:run -- --surface suggestions`.
4. Query the calibrated judge for per-dim averages on the new synthetic events (filter on `requestId LIKE '%-h%'` to isolate post-Phase-1 + post-B output).
5. Compare to the post-Phase-1 baseline (relevance 3.57, total 20.06).
6. **Ship if and only if:** relevance ≥ 4.3 AND no dim regresses below its floor (categoryFidelity 4.0, plausibility 4.5, diversity 3.5, qualityRange 3.5).

---

## 3. What this is NOT

- Not a change to `V2CandidateScorer`, `SuggestionDiversityEnforcer`, or any downstream scoring/ranking code.
- Not a change to `aiService` routing, the model selection (Qwen-32B via Groq for primary), or rescue behavior.
- Not a change to the custom-request path (`buildCustomPrompt`, `getCustomSuggestionSchema`).
- Not a change to the calibration JSON files — new baseline measurements use the same 20-entry calibration set as Sub-project A.
- Not adding word-list trigger modifiers ("aerial", "handheld", etc.) to the prompt. That's the regex-in-another-form anti-pattern; the structural fix subsumes it.
- Not adding few-shot examples to the prompt.

---

## 4. Risks and what we accept

| Risk                                                                                                                  | Mitigation                                                                                                                                                                 | Residual                                                                                         |
| --------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Groq/Qwen JSON-mode drops or malforms the new required field                                                          | Tolerant parse in engine: missing `scene_summary` logs info but doesn't fail. Verification queries a sample of PostHog events to confirm the field IS present in practice. | Low — Groq strict JSON mode honors top-level required fields reliably in the existing test data. |
| categoryFidelity regresses (model spends thinking tokens on summary, less rigor on category)                          | Hard floor in success criterion (≥ 4.0). If breached, narrow change or revert.                                                                                             | Medium — observable in the post-change baseline.                                                 |
| Total token cost rises noticeably                                                                                     | ~30-50 tokens per call × ~58 events per harness run ≈ negligible (~$0.001 per harness run).                                                                                | Low.                                                                                             |
| Scene-summary itself becomes a vector for prompt injection (user prompt steers the summary, which steers suggestions) | Suggestions already operate on user-controlled `full_prompt` text; injection surface is unchanged. The summary doesn't get fed into another LLM.                           | Low.                                                                                             |
| Rubric counter-acts the structural fix (e.g., judge interprets summary as fluff and penalizes "explanation" length)   | Rubric is unchanged; explanation field is per-suggestion, not the new top-level. Risk is theoretical.                                                                      | Low.                                                                                             |

---

## 5. Sequencing

1. Update both schema variants (OpenAI strict + Groq simplified) in one commit. Type-check.
2. Update `EnhancementV2PromptBuilder.buildPrompt` to emit the new instruction. Type-check.
3. Update `EnhancementV2Engine.execute` to extract `scene_summary` into `execution.debug.sceneSummary` with tolerant fallback. Type-check.
4. Update `EnhancementV2Execution.debug` type in `types.ts`. Type-check.
5. Update `SuggestionsTelemetryService` to accept and emit `sceneSummary`. Type-check.
6. Update the synthetic harness's suggestions driver to thread `sceneSummary` through to telemetry. Type-check.
7. Add or update at least one unit test in `server/src/services/enhancement/v2/__tests__/` covering the new debug.sceneSummary plumbing (test the engine's behavior when the LLM response contains or omits `scene_summary`).
8. Lint + unit test pass.
9. Run synthetic for suggestions only. Verify it completes without errors and emits `sceneSummary` on events.
10. Run judge for suggestions. Query the per-dim averages against the calibration baseline.
11. Update the Measurement Program reordering log with the result.
12. If success criterion is met, ship. If not, revert and reopen brainstorm.

---

## 6. What this spec does not specify

- The detailed implementation plan. Next artifact via writing-plans.
- The exact phrasing of the `scene_summary` description in the schema (will be finalized during the plan; the spec gives a representative version).
- Sub-project C or D scope. They're tracked separately.
