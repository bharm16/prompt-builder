# Suggestions Scene-Summary First — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Force the suggestions LLM to emit a one-sentence `scene_summary` field before the suggestions array, so its own scene articulation is in context while it generates each suggestion. Targets relevance 3.57 → 4.3+ with no regression below floors on other dimensions.

**Architecture:** Extend `StructuredOutputEnforcer.enforceJSON` with an opt-in `captureSiblings` option that returns the parent object's siblings alongside the unwrapped value. Add `scene_summary` as a required field on the enhancement JSON schema (both OpenAI strict + Groq simplified). Update the prompt builder to instruct the LLM to emit the summary first. Thread the captured summary through the engine's debug payload into `suggestions.completed` telemetry. Custom-request path untouched.

**Tech Stack:** TypeScript (ESM), Vitest, OpenAI/Groq JSON schemas, the existing `EnhancementV2` engine + telemetry stack.

**Spec:** [`docs/superpowers/specs/2026-05-15-suggestions-scene-summary-design.md`](../specs/2026-05-15-suggestions-scene-summary-design.md)

---

## File Structure

| Action | Path                                                                            | Responsibility                                                                                                                                                                   |
| ------ | ------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Modify | `server/src/utils/structured-output/unwrapper.ts`                               | Add `unwrapSuggestionsArrayWithSiblings` that returns `{ value, siblings, unwrapped }`.                                                                                          |
| Modify | `server/src/utils/structured-output/__tests__/unwrapper.test.ts`                | Add 3 unit tests for the new sibling-capture function.                                                                                                                           |
| Modify | `server/src/utils/structured-output/StructuredOutputEnforcer.ts`                | Add optional `captureSiblings: true` option that changes return type to `{ value: T, siblings: Record<string, unknown> }`.                                                       |
| Modify | `server/src/utils/structured-output/__tests__/StructuredOutputEnforcer.test.ts` | Add 2 tests covering the new option's return shape (siblings present and siblings empty).                                                                                        |
| Modify | `server/src/utils/provider/schemas/enhancement.ts`                              | Add `scene_summary` required field to both OpenAI strict and Groq simplified schemas.                                                                                            |
| Modify | `server/src/services/enhancement/v2/EnhancementV2PromptBuilder.ts`              | Update `buildPrompt()` to instruct scene_summary first; update the JSON-shape footer. Custom path untouched.                                                                     |
| Modify | `server/src/services/enhancement/v2/types.ts`                                   | Add `sceneSummary?: string \| null` to `EnhancementV2DebugPayload`. Add new internal `GuidedGenerationResult` type.                                                              |
| Modify | `server/src/services/enhancement/v2/EnhancementV2Engine.ts`                     | `_generateGuidedCandidates` returns `GuidedGenerationResult`. `_generatePrimaryCandidates` and `_generateRescueCandidates` propagate. `execute()` stashes sceneSummary on debug. |
| Modify | `server/src/services/enhancement/v2/__tests__/EnhancementV2Engine.test.ts`      | Add 2 tests: engine puts sceneSummary on debug when LLM returns it; engine tolerates missing scene_summary (logs info, no crash).                                                |
| Modify | `server/src/services/observability/types.ts`                                    | Add `sceneSummary?: string \| null` to `SuggestionsTraceCompleteSummary` and `SuggestionsEventProperties`.                                                                       |
| Modify | `server/src/services/observability/SuggestionsTelemetryService.ts`              | Pipe `summary.sceneSummary` into `properties.sceneSummary`.                                                                                                                      |
| Modify | `scripts/synthetic/drivers/suggestions.driver.ts`                               | Pass `execution.debug.sceneSummary ?? null` into `trace.complete(...)`.                                                                                                          |
| Modify | `docs/superpowers/specs/2026-05-14-baseline-quality-improvement-design.md`      | Record Sub-project B post-implementation baseline numbers in § 4 (or new section).                                                                                               |
| Modify | `docs/superpowers/programs/measurement.md`                                      | Add reordering-log entry for the Sub-project B result.                                                                                                                           |

---

## Task 1: Extend `unwrapSuggestionsArray` with sibling capture (TDD)

**Files:**

- Modify: `server/src/utils/structured-output/unwrapper.ts`
- Modify: `server/src/utils/structured-output/__tests__/unwrapper.test.ts`

- [ ] **Step 1: Add failing tests for the new function**

Append to `server/src/utils/structured-output/__tests__/unwrapper.test.ts`:

```typescript
import { unwrapSuggestionsArrayWithSiblings } from "../unwrapper";

describe("unwrapSuggestionsArrayWithSiblings", () => {
  it("returns value plus siblings when parent is an object with suggestions", () => {
    const parent = {
      scene_summary: "aerial drone — must be airborne",
      suggestions: [{ text: "drone glide" }],
    };
    const result = unwrapSuggestionsArrayWithSiblings<
      typeof parent.suggestions
    >(parent, true);
    expect(result.unwrapped).toBe(true);
    expect(result.value).toEqual([{ text: "drone glide" }]);
    expect(result.siblings).toEqual({
      scene_summary: "aerial drone — must be airborne",
    });
  });

  it("returns empty siblings when parent has only the suggestions field", () => {
    const parent = { suggestions: [{ text: "x" }] };
    const result = unwrapSuggestionsArrayWithSiblings<
      typeof parent.suggestions
    >(parent, true);
    expect(result.unwrapped).toBe(true);
    expect(result.siblings).toEqual({});
  });

  it("returns empty siblings and unwrapped=false when parent is not an object", () => {
    const parent = [{ text: "x" }];
    const result = unwrapSuggestionsArrayWithSiblings<typeof parent>(
      parent,
      true,
    );
    expect(result.unwrapped).toBe(false);
    expect(result.value).toEqual([{ text: "x" }]);
    expect(result.siblings).toEqual({});
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run server/src/utils/structured-output/__tests__/unwrapper.test.ts`
Expected: 3 new tests FAIL — `unwrapSuggestionsArrayWithSiblings` is not exported.

- [ ] **Step 3: Add the new function to `unwrapper.ts`**

Append to `server/src/utils/structured-output/unwrapper.ts`:

```typescript
/**
 * Same as unwrapSuggestionsArray but also returns the parent object's
 * non-`suggestions` fields ("siblings"). Used by callers that need to
 * read metadata fields the LLM emits alongside the suggestions array
 * (e.g., `scene_summary` for Sub-project B's prompt-engineering work).
 *
 * Siblings is always {} when the parent isn't an unwrappable object,
 * so callers don't have to null-check.
 */
export function unwrapSuggestionsArrayWithSiblings<T>(
  parsedJSON: unknown,
  isArray: boolean,
): { value: T; siblings: Record<string, unknown>; unwrapped: boolean } {
  if (
    isArray &&
    !Array.isArray(parsedJSON) &&
    typeof parsedJSON === "object" &&
    parsedJSON !== null
  ) {
    const wrapped = parsedJSON as Record<string, unknown>;
    if (Array.isArray(wrapped.suggestions)) {
      const siblings: Record<string, unknown> = {};
      for (const key of Object.keys(wrapped)) {
        if (key !== "suggestions") siblings[key] = wrapped[key];
      }
      return { value: wrapped.suggestions as T, siblings, unwrapped: true };
    }
  }

  return { value: parsedJSON as T, siblings: {}, unwrapped: false };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run server/src/utils/structured-output/__tests__/unwrapper.test.ts`
Expected: All tests pass (existing tests for `unwrapSuggestionsArray` still pass; 3 new tests for `unwrapSuggestionsArrayWithSiblings` now pass).

- [ ] **Step 5: Type check**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add server/src/utils/structured-output/unwrapper.ts server/src/utils/structured-output/__tests__/unwrapper.test.ts
git commit -m "feat(structured-output): add unwrapSuggestionsArrayWithSiblings

Same unwrap behavior as unwrapSuggestionsArray but also returns the
parent object's non-suggestions fields. Three TDD tests cover the
unwrappable-object case (siblings populated), the suggestions-only
case (empty siblings), and the non-unwrappable case (siblings={},
unwrapped=false).

Used by Sub-project B to capture scene_summary alongside the
suggestions array."
```

---

## Task 2: Add `captureSiblings` option to `StructuredOutputEnforcer.enforceJSON`

**Files:**

- Modify: `server/src/utils/structured-output/StructuredOutputEnforcer.ts:54-188`
- Modify: `server/src/utils/structured-output/__tests__/StructuredOutputEnforcer.test.ts`

- [ ] **Step 1: Read the existing `enforceJSON` signature**

Run: `sed -n '50,70p' server/src/utils/structured-output/StructuredOutputEnforcer.ts`
Note the current `EnforceJSONOptions` and the `<T>` generic.

- [ ] **Step 2: Add failing tests for the new option**

Append to `server/src/utils/structured-output/__tests__/StructuredOutputEnforcer.test.ts`:

```typescript
describe("enforceJSON with captureSiblings", () => {
  it("returns { value, siblings } when captureSiblings is true and response has siblings", async () => {
    const aiService = {
      execute: vi.fn().mockResolvedValue({
        text: JSON.stringify({
          scene_summary: "aerial drone — must be airborne",
          suggestions: [{ text: "drone glide", explanation: "stays aloft" }],
        }),
      }),
    };
    const result = await StructuredOutputEnforcer.enforceJSON<
      Array<{ text: string }>
    >(aiService as unknown as AIService, "prompt", {
      operation: "enhance_suggestions",
      isArray: true,
      maxRetries: 0,
      captureSiblings: true,
    });
    // When captureSiblings is true, result is { value, siblings }
    expect(result).toMatchObject({
      value: [{ text: "drone glide", explanation: "stays aloft" }],
      siblings: { scene_summary: "aerial drone — must be airborne" },
    });
  });

  it("returns { value, siblings: {} } when captureSiblings is true but response has no siblings", async () => {
    const aiService = {
      execute: vi.fn().mockResolvedValue({
        text: JSON.stringify({ suggestions: [{ text: "x" }] }),
      }),
    };
    const result = await StructuredOutputEnforcer.enforceJSON<
      Array<{ text: string }>
    >(aiService as unknown as AIService, "prompt", {
      operation: "enhance_suggestions",
      isArray: true,
      maxRetries: 0,
      captureSiblings: true,
    });
    expect(result).toMatchObject({
      value: [{ text: "x" }],
      siblings: {},
    });
  });
});
```

(Make sure the imports at top of the file include `vi` from vitest and the `AIService` type.)

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run server/src/utils/structured-output/__tests__/StructuredOutputEnforcer.test.ts`
Expected: 2 new tests FAIL — `captureSiblings` not recognized, or the return is the array, not the wrapped shape.

- [ ] **Step 4: Update the options interface and enforceJSON to support captureSiblings**

Find the `EnforceJSONOptions` interface near the top of `StructuredOutputEnforcer.ts` and add the field. (If it's in `./types.ts`, modify there instead.)

```typescript
// In whichever file defines EnforceJSONOptions:
export interface EnforceJSONOptions {
  // ...existing fields unchanged...
  /**
   * When true, enforceJSON returns `{ value, siblings }` where siblings
   * are the parent object's non-`suggestions` fields. Used to capture
   * LLM-emitted metadata alongside the unwrapped array. Default: false.
   */
  captureSiblings?: boolean;
}
```

Then update `StructuredOutputEnforcer.enforceJSON` to honor it. Replace the section at lines 153-165 (the unwrap + return block) with:

```typescript
// Unwrap path
if (options.captureSiblings) {
  const captured = unwrapSuggestionsArrayWithSiblings<T>(parsedJSON, isArray);
  if (captured.unwrapped) {
    logger.debug("Auto-unwrapping suggestions array from object wrapper");
  }
  logger.debug("Successfully extracted structured output", {
    type: isArray ? "array" : "object",
    provider,
    siblingsCount: Object.keys(captured.siblings).length,
  });
  return {
    value: captured.value,
    siblings: captured.siblings,
  } as unknown as T;
}

const unwrapped = unwrapSuggestionsArray(parsedJSON, isArray);
if (unwrapped.unwrapped) {
  logger.debug("Auto-unwrapping suggestions array from object wrapper");
}

parsedJSON = unwrapped.value;

logger.debug("Successfully extracted structured output", {
  type: isArray ? "array" : "object",
  provider,
});

return parsedJSON;
```

Add the import at the top of the file alongside the existing `unwrapSuggestionsArray` import:

```typescript
import {
  unwrapSuggestionsArray,
  unwrapSuggestionsArrayWithSiblings,
} from "./unwrapper";
```

(If the existing import is single-named, expand it.)

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run server/src/utils/structured-output/__tests__/StructuredOutputEnforcer.test.ts`
Expected: All tests pass (existing tests still pass; 2 new tests pass).

- [ ] **Step 6: Type check**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 7: Commit**

```bash
git add server/src/utils/structured-output/StructuredOutputEnforcer.ts server/src/utils/structured-output/__tests__/StructuredOutputEnforcer.test.ts
git commit -m "feat(structured-output): add captureSiblings option to enforceJSON

Opt-in option that changes the return shape from T to { value: T,
siblings: Record<string, unknown> }, capturing LLM-emitted metadata
fields alongside the unwrapped value. Default behavior unchanged
when option is absent — every existing caller continues to receive T.

Two TDD tests cover the populated-siblings and empty-siblings cases.
Sub-project B's engine change consumes this to capture scene_summary."
```

---

## Task 3: Add `scene_summary` to enhancement JSON schema (both provider variants)

**Files:**

- Modify: `server/src/utils/provider/schemas/enhancement.ts`

- [ ] **Step 1: Update the OpenAI strict schema**

In `server/src/utils/provider/schemas/enhancement.ts`, find `getOpenAIEnhancementSchema` (around line 32). Change:

```typescript
return {
  name: "enhancement_suggestions",
  strict: true,
  type: "object",
  required: ["suggestions"],
  additionalProperties: false,
  properties: {
    suggestions: {
      /* unchanged */
    },
  },
};
```

to:

```typescript
return {
  name: "enhancement_suggestions",
  strict: true,
  type: "object",
  required: ["scene_summary", "suggestions"],
  additionalProperties: false,
  properties: {
    scene_summary: {
      type: "string",
      description:
        "ONE sentence identifying the scene's setting, tone, and constraints visible in the full prompt (e.g., 'aerial drone shot over urban skyline at sunset — suggestions must be airborne; ground-based movements are invalid'). Emit BEFORE the suggestions array. The constraints stated here apply to every suggestion that follows.",
    },
    suggestions: {
      /* the existing suggestions object — unchanged */
    },
  },
};
```

The `suggestions` property block is unchanged — only the `required` array and a new `scene_summary` property are added.

- [ ] **Step 2: Update the Groq simplified schema**

In the same file, find `getGroqEnhancementSchema` (around line 107). Change:

```typescript
return {
  type: "object",
  required: ["suggestions"],
  properties: {
    suggestions: {
      /* unchanged */
    },
  },
};
```

to:

```typescript
return {
  type: "object",
  required: ["scene_summary", "suggestions"],
  properties: {
    scene_summary: { type: "string" },
    suggestions: {
      /* unchanged */
    },
  },
};
```

(Groq schema deliberately omits descriptions for token economy — the prompt itself carries the instruction.)

- [ ] **Step 3: Type check**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 4: Lint**

Run: `npx eslint --config config/lint/eslint.config.js server/src/utils/provider/schemas/enhancement.ts --quiet`
Expected: 0 errors.

- [ ] **Step 5: Run existing enhancement schema tests**

Run: `npx vitest run server/src/utils/provider/schemas`
Expected: pass (if any per-schema tests exist), or no test files matched (acceptable — schema integrity is exercised by V2 engine tests downstream).

- [ ] **Step 6: Commit**

```bash
git add server/src/utils/provider/schemas/enhancement.ts
git commit -m "feat(provider-schema): add scene_summary required field to enhancement schemas

Both OpenAI strict and Groq simplified variants gain scene_summary as
a required top-level field, positioned BEFORE suggestions in the
required array. The LLM emits scene_summary first; its tokens are
in the model's own context when it generates each suggestion that
follows (autoregressive conditioning).

The OpenAI variant carries a rich description of what the field
should contain; Groq omits it for token economy — the prompt
instruction carries the load. Custom-suggestion schema unchanged."
```

---

## Task 4: Update `EnhancementV2PromptBuilder` to instruct scene_summary first

**Files:**

- Modify: `server/src/services/enhancement/v2/EnhancementV2PromptBuilder.ts:25-83`

- [ ] **Step 1: Update `buildPrompt()` to instruct scene_summary**

In `EnhancementV2PromptBuilder.ts`, find the `buildPrompt` method (line 26). The current RULES section starts around line 61. Modify the method so it instructs scene_summary first AND updates the bottom JSON-shape instruction.

Replace the RULES section (lines 61-77) and the closing JSON instruction (line 76+) with:

```typescript
      "",
      "RULES:",
      "- BEFORE the suggestions array, emit `scene_summary` (one sentence): identify the scene's setting, tone, and constraints visible in `full_prompt`. Name any modifiers that constrain the slot (e.g., aerial vs ground-level, handheld vs stabilized, dim vs bright, abandoned vs occupied). State what would make a suggestion fit — and what would make it fail.",
      "- Every suggestion in `suggestions` must satisfy the constraints you named in `scene_summary`.",
      `- Stay inside taxonomy category "${policy.categoryId}". Each suggestion's "category" field MUST equal "${policy.categoryId}".`,
      "- Drop-in test: replacing `highlighted_text` with your suggestion inside `full_prompt` must leave a grammatical, coherent prompt. If substitution breaks the scene's meaning, the suggestion is invalid.",
      `- ${policy.promptGuidance}`,
      "- Keep the replacement literal and camera-visible.",
      "- Do not return advice, headings, or explanation text in the suggestion itself.",
      "- Do not repeat the highlighted text exactly.",
      context.isVideoPrompt
        ? "- Keep the suggestion usable as a drop-in replacement for a video prompt."
        : "",
      policy.forbiddenFamilies.length > 0
        ? `- Avoid semantic drift into: ${policy.forbiddenFamilies.join(", ")}.`
        : "",
      "",
      "Return a JSON object with these fields IN THIS ORDER:",
      "1. `scene_summary` (string): the one-sentence scene constraint statement.",
      "2. `suggestions` (array): each item is a suggestion object with `text`, `category`, `explanation`.",
    ];

    return lines.filter(Boolean).join("\n");
  }
```

Note: the existing "Scene-coherence" rule (the long one with example bullets in the current code at line 64) is REPLACED by the new scene_summary requirement plus the constraint that suggestions satisfy the summary. The drop-in test and other rules are preserved.

- [ ] **Step 2: Confirm `buildCustomPrompt` is untouched**

Run: `git diff server/src/services/enhancement/v2/EnhancementV2PromptBuilder.ts | grep -A 1 buildCustomPrompt`
Expected: no diff lines inside or before/after `buildCustomPrompt` — only the `buildPrompt` body and its rules changed.

- [ ] **Step 3: Type check**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add server/src/services/enhancement/v2/EnhancementV2PromptBuilder.ts
git commit -m "feat(enhancement): prompt LLM to emit scene_summary before suggestions

EnhancementV2PromptBuilder.buildPrompt now instructs the LLM to write
a one-sentence scene_summary BEFORE the suggestions array. The summary
identifies the scene's setting, tone, and constraints visible in
full_prompt. Every suggestion that follows must satisfy those
constraints.

Mechanism: LLMs generate left-to-right, so the scene_summary tokens
are in the model's own context while it generates each suggestion.
This is mechanistically stronger than restating constraints in the
RULES section (which the model may drift away from by the time it
emits the suggestions).

buildCustomPrompt is untouched — custom-request flows preserve their
existing behavior."
```

---

## Task 5: Extend types — `EnhancementV2DebugPayload.sceneSummary` + `GuidedGenerationResult`

**Files:**

- Modify: `server/src/services/enhancement/v2/types.ts:176-192`

- [ ] **Step 1: Add `sceneSummary` to `EnhancementV2DebugPayload` and define `GuidedGenerationResult`**

In `server/src/services/enhancement/v2/types.ts`, replace the `EnhancementV2DebugPayload` interface (line 176) with:

```typescript
export interface EnhancementV2DebugPayload {
  engineVersion: "v2";
  policyVersion: string;
  categoryId: string;
  mode: GenerationMode;
  stageCounts: Record<string, number>;
  rejectionSummary: Record<string, number>;
  modelCallCount: number;
  systemPromptSent?: string;
  /**
   * One-sentence scene constraint statement emitted by the LLM BEFORE
   * the suggestions array. Captured for telemetry; downstream code
   * does not validate or consume programmatically. Null when the
   * LLM omitted it or when the engine ran a non-guided mode.
   */
  sceneSummary?: string | null;
}
```

Then add a new type for the internal return shape of `_generateGuidedCandidates`. After `EnhancementV2Execution` (line 192), add:

```typescript
/**
 * Internal result shape for the V2 engine's guided-LLM generation path.
 * Carries the suggestion array (downstream consumers) plus the scene_summary
 * the LLM emitted (telemetry-only metadata).
 */
export interface GuidedGenerationResult {
  suggestions: Suggestion[];
  sceneSummary: string | null;
}
```

- [ ] **Step 2: Type check**

Run: `npx tsc --noEmit`
Expected: TypeScript will fail in `EnhancementV2Engine.ts` because `_generateGuidedCandidates` doesn't yet return `GuidedGenerationResult`. That's expected — Task 6 fixes it. Do NOT commit yet.

If the tsc output is broader than that (errors in other files), investigate before continuing.

---

## Task 6: Update `EnhancementV2Engine` to capture and propagate `sceneSummary`

**Files:**

- Modify: `server/src/services/enhancement/v2/EnhancementV2Engine.ts:35-280`

- [ ] **Step 1: Update `_generateGuidedCandidates` to use captureSiblings**

Replace lines 234-280 of `EnhancementV2Engine.ts` with:

```typescript
  private async _generateGuidedCandidates(
    prompt: string,
    context: EnhancementV2RequestContext,
    policy: SlotPolicy,
  ): Promise<GuidedGenerationResult> {
    const schemaName = policy.suggestionSchemaName ?? "enhancement";
    const operation =
      schemaName === "custom" ? "custom_suggestions" : "enhance_suggestions";
    const operationConfig =
      this.dependencies.aiService.getOperationConfig?.(operation);
    const temperature =
      typeof operationConfig?.temperature === "number"
        ? operationConfig.temperature
        : 0.7;
    const provider = operationConfig?.client as
      | "openai"
      | "groq"
      | "qwen"
      | undefined;
    const schemaOptions = provider ? { provider } : {};
    const schema =
      schemaName === "custom"
        ? getCustomSuggestionSchema(schemaOptions)
        : getEnhancementSchema(context.isPlaceholder, schemaOptions);

    // Custom-request path doesn't carry scene_summary — preserve the old shape.
    if (schemaName === "custom") {
      const customSuggestions = await StructuredOutputEnforcer.enforceJSON<
        Suggestion[]
      >(this.dependencies.aiService, prompt, {
        operation,
        schema: schema as {
          type: "object" | "array";
          required?: string[];
          items?: { required?: string[] };
        } | null,
        isArray: true,
        maxRetries: 1,
        temperature,
        ...(provider ? { provider } : {}),
      });
      return {
        suggestions: Array.isArray(customSuggestions)
          ? customSuggestions.map((s) => ({
              ...s,
              category: s.category || policy.categoryId,
            }))
          : [],
        sceneSummary: null,
      };
    }

    // Enhancement path: capture scene_summary alongside the unwrapped suggestions.
    const captured = (await StructuredOutputEnforcer.enforceJSON<Suggestion[]>(
      this.dependencies.aiService,
      prompt,
      {
        operation,
        schema: schema as {
          type: "object" | "array";
          required?: string[];
          items?: { required?: string[] };
        } | null,
        isArray: true,
        maxRetries: 1,
        temperature,
        captureSiblings: true,
        ...(provider ? { provider } : {}),
      },
    )) as unknown as {
      value: Suggestion[];
      siblings: Record<string, unknown>;
    };

    const rawSceneSummary = captured.siblings?.scene_summary;
    const sceneSummary =
      typeof rawSceneSummary === "string" && rawSceneSummary.trim().length > 0
        ? rawSceneSummary
        : null;

    if (sceneSummary === null) {
      this.log.info(
        "EnhancementV2 LLM omitted scene_summary — proceeding without telemetry",
        { categoryId: policy.categoryId },
      );
    }

    const suggestions = Array.isArray(captured.value)
      ? captured.value.map((s) => ({
          ...s,
          category: s.category || policy.categoryId,
        }))
      : [];

    return { suggestions, sceneSummary };
  }
```

Note the import for `GuidedGenerationResult` needs to be added at the top of the file alongside other type imports.

- [ ] **Step 2: Update `_generatePrimaryCandidates` to propagate `GuidedGenerationResult`**

Replace the existing `_generatePrimaryCandidates` (lines 139-156) with:

```typescript
  private async _generatePrimaryCandidates(
    policy: SlotPolicy,
    context: EnhancementV2RequestContext,
  ): Promise<GuidedGenerationResult> {
    if (policy.mode === "enumerated") {
      return {
        suggestions: this._generateEnumeratedCandidates(policy, context),
        sceneSummary: null,
      };
    }

    if (policy.mode === "templated") {
      return {
        suggestions: this._generateTemplatedCandidates(policy, context),
        sceneSummary: null,
      };
    }

    return this._generateGuidedCandidates(
      this.promptBuilder.buildPrompt(context, policy),
      context,
      policy,
    );
  }
```

- [ ] **Step 3: Update `_generateRescueCandidates` to propagate `GuidedGenerationResult`**

Replace `_generateRescueCandidates` (lines 158-183) with:

```typescript
  private async _generateRescueCandidates(
    policy: SlotPolicy,
    context: EnhancementV2RequestContext,
    existingSuggestions: Suggestion[],
  ): Promise<GuidedGenerationResult> {
    if (!policy.rescueStrategy?.enabled || policy.rescueStrategy.maxCalls < 1) {
      return { suggestions: [], sceneSummary: null };
    }

    if (policy.mode === "enumerated") {
      return { suggestions: [], sceneSummary: null };
    }

    const missingCount = Math.max(
      policy.minAcceptableCount - existingSuggestions.length,
      1,
    );
    const prompt = this.promptBuilder.buildRescuePrompt(
      context,
      policy,
      existingSuggestions.map((item) => item.text),
      missingCount,
    );

    return this._generateGuidedCandidates(prompt, context, policy);
  }
```

- [ ] **Step 4: Update `execute()` to extract `suggestions` and stash `sceneSummary` on debug**

In `execute()` (line 35-137), update the body to unpack `GuidedGenerationResult` and stash `sceneSummary` on the debug payload.

Replace lines 50-95 of the existing `execute()` body with:

```typescript
const primary = await this._generatePrimaryCandidates(policy, context);
const primaryCandidates = primary.suggestions;
stageCounts.generatedPrimary = primaryCandidates.length;
if (policy.mode === "guided_llm") {
  modelCallCount += 1;
}

// sceneSummary comes from the primary guided call (rescue overrides
// only when it actually fires AND emits its own summary).
let sceneSummary = primary.sceneSummary;

let evaluations = this.scorer.scoreCandidates(
  primaryCandidates,
  context,
  policy,
);
stageCounts.evaluatedPrimary = evaluations.length;
let rejectionSummary = this.scorer.summarizeRejections(evaluations);
let finalSuggestions = this._rankAndFilter(
  evaluations,
  context.highlightedText,
  policy.targetCount,
);
stageCounts.acceptedPrimary = finalSuggestions.length;

if (this._shouldRescue(policy, finalSuggestions.length)) {
  const rescue = await this._generateRescueCandidates(
    policy,
    context,
    finalSuggestions,
  );
  const rescueCandidates = rescue.suggestions;
  if (rescueCandidates.length > 0) {
    modelCallCount += 1;
    stageCounts.generatedRescue = rescueCandidates.length;
    if (rescue.sceneSummary) {
      sceneSummary = rescue.sceneSummary;
    }
    const merged = this._dedupeByText([
      ...primaryCandidates,
      ...rescueCandidates,
    ]);
    evaluations = this.scorer.scoreCandidates(merged, context, policy);
    stageCounts.evaluatedRescue = evaluations.length;
    rejectionSummary = this.scorer.summarizeRejections(evaluations);
    finalSuggestions = this._rankAndFilter(
      evaluations,
      context.highlightedText,
      policy.targetCount,
    );
  }
}
```

Then update the return at lines 122-135 — add `sceneSummary` to the debug payload:

```typescript
      debug: {
        engineVersion: "v2",
        policyVersion: this.registry.getVersion(),
        categoryId: policy.categoryId,
        mode: policy.mode,
        stageCounts,
        rejectionSummary,
        modelCallCount,
        sceneSummary,
        ...(policy.mode === "guided_llm"
          ? {
              systemPromptSent: this.promptBuilder.buildPrompt(context, policy),
            }
          : {}),
      },
```

- [ ] **Step 5: Add `GuidedGenerationResult` to the type imports at the top of `EnhancementV2Engine.ts`**

Find the import block from `./types.js` (or `./types`) and add `GuidedGenerationResult`:

```typescript
import type {
  // ...existing imports...
  GuidedGenerationResult,
} from "./types.js";
```

- [ ] **Step 6: Type check**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 7: Run V2 engine unit tests**

Run: `npx vitest run server/src/services/enhancement/v2/__tests__/EnhancementV2Engine.test.ts`
Expected: existing tests pass. If they fail, the failure should be in places where the test mocks \_generateGuidedCandidates or \_generatePrimaryCandidates with the old `Promise<Suggestion[]>` shape — update those mock returns to `{ suggestions: [...], sceneSummary: null }`. Re-run.

- [ ] **Step 8: Commit**

```bash
git add server/src/services/enhancement/v2/types.ts server/src/services/enhancement/v2/EnhancementV2Engine.ts
git commit -m "feat(enhancement): capture scene_summary into V2 engine debug payload

_generateGuidedCandidates now returns GuidedGenerationResult
({ suggestions, sceneSummary }) instead of Suggestion[]. The new
sceneSummary field is captured via StructuredOutputEnforcer's
captureSiblings option from the LLM response. Tolerant parse: missing
or empty scene_summary logs info but doesn't fail the call.

execute() stashes the primary call's sceneSummary on
EnhancementV2DebugPayload.sceneSummary. If a rescue call fires and
emits its own summary, that overrides. Custom-request path keeps the
old shape (no scene_summary).

Enumerated and templated paths return sceneSummary=null since they
don't invoke the LLM with the scene-summary instruction."
```

---

## Task 7: Add V2 engine tests for `sceneSummary` capture + tolerant parse

**Files:**

- Modify: `server/src/services/enhancement/v2/__tests__/EnhancementV2Engine.test.ts`

- [ ] **Step 1: Add tests**

Append two new tests to `EnhancementV2Engine.test.ts`. The pattern depends on how the existing tests mock `aiService`; mirror that shape. Skeleton:

```typescript
describe("scene_summary capture (Sub-project B)", () => {
  it("puts scene_summary onto execution.debug.sceneSummary when the LLM emits it", async () => {
    const aiService = {
      execute: vi.fn().mockResolvedValue({
        text: JSON.stringify({
          scene_summary: "aerial drone — suggestions must be airborne",
          suggestions: [
            {
              text: "slow drone glide",
              category: "camera.movement",
              explanation: "stays aloft",
            },
          ],
        }),
      }),
      getOperationConfig: () => ({ client: "groq", temperature: 0.7 }),
    };

    const engine = makeEngineForTest(aiService); // helper from existing tests
    const context = makeContextForTest({
      fullPrompt:
        "Aerial drone shot pulling back from a city skyline at sunset",
      highlightedText: "Aerial drone shot",
      highlightedCategory: "camera.movement",
    });

    const result = await engine.execute(context);

    expect(result.debug.sceneSummary).toBe(
      "aerial drone — suggestions must be airborne",
    );
    expect(result.finalSuggestions.length).toBeGreaterThan(0);
  });

  it("tolerates missing scene_summary in the LLM response (sceneSummary = null, no crash)", async () => {
    const aiService = {
      execute: vi.fn().mockResolvedValue({
        text: JSON.stringify({
          suggestions: [
            {
              text: "slow drone glide",
              category: "camera.movement",
              explanation: "x",
            },
          ],
        }),
      }),
      getOperationConfig: () => ({ client: "groq", temperature: 0.7 }),
    };

    const engine = makeEngineForTest(aiService);
    const context = makeContextForTest({
      fullPrompt: "Aerial drone shot",
      highlightedText: "Aerial drone shot",
      highlightedCategory: "camera.movement",
    });

    const result = await engine.execute(context);

    expect(result.debug.sceneSummary).toBeNull();
    expect(result.finalSuggestions.length).toBeGreaterThan(0);
  });
});
```

The exact mock-construction code depends on existing test helpers in the file (`makeEngineForTest`, `makeContextForTest`). Read the file's top section first and reuse whatever pattern is already there. If no helpers exist, follow the literal mock pattern from the most recent test in the file.

- [ ] **Step 2: Run the new tests**

Run: `npx vitest run server/src/services/enhancement/v2/__tests__/EnhancementV2Engine.test.ts`
Expected: All tests pass — existing + 2 new.

- [ ] **Step 3: Type check + lint**

Run: `npx tsc --noEmit && npx eslint --config config/lint/eslint.config.js server/src/services/enhancement/v2/ --quiet`
Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add server/src/services/enhancement/v2/__tests__/EnhancementV2Engine.test.ts
git commit -m "test(enhancement): cover scene_summary capture in V2 engine

Two tests for Sub-project B's engine changes: (a) LLM returns
scene_summary -> execution.debug.sceneSummary is set; (b) LLM omits
scene_summary -> execution.debug.sceneSummary is null with no crash."
```

---

## Task 8: Wire `sceneSummary` through suggestions telemetry

**Files:**

- Modify: `server/src/services/observability/types.ts`
- Modify: `server/src/services/observability/SuggestionsTelemetryService.ts`

- [ ] **Step 1: Add `sceneSummary` field to the telemetry types**

In `server/src/services/observability/types.ts`, find the `SuggestionsTraceCompleteSummary` and `SuggestionsEventProperties` interfaces.

Add to `SuggestionsTraceCompleteSummary`:

```typescript
  sceneSummary?: string | null;
```

Add to `SuggestionsEventProperties` (placed alongside the other content fields like `highlightedText`, `fullPrompt`, `suggestions`):

```typescript
  sceneSummary?: string | null;
```

- [ ] **Step 2: Update `SuggestionsTelemetryService` to thread the field through**

In `server/src/services/observability/SuggestionsTelemetryService.ts:61-87`, find the properties object construction in `complete()`. Add the new field alongside the other content fields (after `suggestions`):

```typescript
const properties: SuggestionsEventProperties = {
  // ...existing fields unchanged...
  highlightedText: summary.highlightedText,
  fullPrompt: summary.fullPrompt,
  suggestions: summary.suggestions,
  sceneSummary: summary.sceneSummary ?? null,
};
```

- [ ] **Step 3: Type check + lint**

Run: `npx tsc --noEmit && npx eslint --config config/lint/eslint.config.js server/src/services/observability/ --quiet`
Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add server/src/services/observability/types.ts server/src/services/observability/SuggestionsTelemetryService.ts
git commit -m "feat(telemetry): thread sceneSummary onto suggestions.completed events

SuggestionsTraceCompleteSummary and SuggestionsEventProperties gain
an optional sceneSummary string. SuggestionsTelemetryService.complete
pipes it onto the PostHog event payload. Null when the LLM omits the
field or when a non-guided engine mode ran.

Enables querying the scene_summary text from PostHog alongside the
existing content fields for quality review and future calibration
iterations."
```

---

## Task 9: Update synthetic harness suggestions driver

**Files:**

- Modify: `scripts/synthetic/drivers/suggestions.driver.ts`

- [ ] **Step 1: Pass `execution.debug.sceneSummary` into telemetry**

In `scripts/synthetic/drivers/suggestions.driver.ts`, find the `trace.complete({...})` call in the success branch (currently around line 135 of the post-Sub-project-A version of the file). Add `sceneSummary` alongside the other content fields:

```typescript
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
  sceneSummary: execution.debug.sceneSummary ?? null,
});
```

The error branch does not need a sceneSummary — error events have no LLM response. Leave it untouched.

- [ ] **Step 2: Type check + lint**

Run: `npx tsc --noEmit && npx eslint --config config/lint/eslint.config.js scripts/synthetic/ --quiet`
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add scripts/synthetic/drivers/suggestions.driver.ts
git commit -m "feat(synthetic): thread sceneSummary into synthetic suggestions events

The harness driver now passes execution.debug.sceneSummary into the
SuggestionsTrace.complete() call so post-implementation baseline runs
emit the scene_summary text on every suggestions.completed event,
queryable from PostHog alongside the existing content fields."
```

---

## Task 10: Run synthetic + judge, verify success criterion

**Files:**

- (read-only verification; docs updates in Task 11)

- [ ] **Step 1: Run the synthetic harness for suggestions only**

Run: `npm run synthetic -- --only suggestions 2>&1 | tail -20`
Expected: ends with `=== Summary ===` showing `suggestions: 58 surface events (across 20 prompts)` (or whatever count matches the current fixture's `highlights[]` total).

Inspect a few `[suggestions] {id}/h{idx}` log lines — verify the LLM is producing output normally (no schema-validation failures).

- [ ] **Step 2: Wait for PostHog ingestion**

PostHog HogQL queries see ingested events with a small lag (seconds to ~30s). Move directly to step 3; if step 3 returns < 30 events, wait another ~30s and retry.

- [ ] **Step 3: Run the judge**

Run: `npm run judge:run -- --surface suggestions 2>&1 | tail -10`
Expected: prints `[quality-judge] running for suggestions` and no per-event errors.

- [ ] **Step 4: Query PostHog for post-change averages**

Run this HogQL query via the PostHog MCP tool (`mcp__posthog__query-run`):

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
  AND timestamp > now() - INTERVAL 10 MINUTE
  AND properties.scoredEventId IN (
    SELECT toString(uuid) FROM events
    WHERE event = 'suggestions.completed'
      AND properties.requestId LIKE '%-h%'
      AND timestamp > now() - INTERVAL 15 MINUTE
  )
```

Record the per-dimension averages.

- [ ] **Step 5: Verify `sceneSummary` is on the events**

Run this query:

```sql
SELECT
  count() AS total_events,
  countIf(properties.sceneSummary IS NOT NULL AND properties.sceneSummary != '') AS with_summary,
  any(properties.sceneSummary) AS sample_summary
FROM events
WHERE event = 'suggestions.completed'
  AND properties.requestId LIKE '%-h%'
  AND timestamp > now() - INTERVAL 15 MINUTE
```

Expected: `with_summary` ≥ 80% of `total_events` (some Groq/Qwen JSON-mode misses are acceptable). `sample_summary` is a non-empty, readable sentence.

- [ ] **Step 6: Check success criterion**

Compare post-change numbers to the post-Phase-1 baseline (relevance 3.57, total 20.06):

| Dimension        | Pre-fix | Post-fix | Floor  | Pass? |
| ---------------- | ------- | -------- | ------ | ----- |
| relevance        | 3.57    | (record) | ≥ 4.3  | ?     |
| categoryFidelity | 4.19    | (record) | ≥ 4.0  | ?     |
| plausibility     | 4.70    | (record) | ≥ 4.5  | ?     |
| diversity        | 3.83    | (record) | ≥ 3.5  | ?     |
| qualityRange     | 3.77    | (record) | ≥ 3.5  | ?     |
| total            | 20.06   | (record) | ≥ 22.0 | ?     |

**If all pass:** proceed to Task 11.

**If relevance lifts but a floor regresses:** do NOT ship. Capture the result, surface to the user, brainstorm whether the change should narrow (e.g., drop the JSON-shape footer change and just keep the rule bullet) or revert.

**If relevance doesn't lift to ≥ 4.3:** capture the result. Either the mechanism is too weak (add Approach B's wordlist rule on top) or the rubric scoring is the bottleneck. Surface to the user.

---

## Task 11: Update parent spec + Measurement Program reordering log

**Files:**

- Modify: `docs/superpowers/specs/2026-05-14-baseline-quality-improvement-design.md`
- Modify: `docs/superpowers/programs/measurement.md`

- [ ] **Step 1: Update the parent spec**

In the baseline-quality-improvement-design.md spec, find or add a section for Sub-project B. Add:

```markdown
### Sub-project B (shipped 2026-05-15)

Scene-summary-first JSON output landed. Post-change suggestions
baseline (synthetic, n=<fill>):

| Dimension        | Pre-fix | Post-fix | Δ      |
| ---------------- | ------- | -------- | ------ |
| relevance        | 3.57    | <fill>   | <fill> |
| categoryFidelity | 4.19    | <fill>   | <fill> |
| plausibility     | 4.70    | <fill>   | <fill> |
| diversity        | 3.83    | <fill>   | <fill> |
| qualityRange     | 3.77    | <fill>   | <fill> |
| total            | 20.06   | <fill>   | <fill> |

See [`2026-05-15-suggestions-scene-summary-design.md`](./2026-05-15-suggestions-scene-summary-design.md) and [`../plans/2026-05-15-suggestions-scene-summary.md`](../plans/2026-05-15-suggestions-scene-summary.md).
```

Replace `<fill>` with the actual measured numbers from Task 10 step 4.

- [ ] **Step 2: Add a reordering-log entry to the Measurement Program doc**

In `docs/superpowers/programs/measurement.md`, find the `### Reordering log` section. Insert a new entry at the top of the chronological list (after the most recent 2026-05-15 Sub-project A entry):

```markdown
- **2026-05-15 (Sub-project B):** Suggestions scene-summary first shipped. EnhancementV2 prompt now instructs the LLM to emit a one-sentence `scene_summary` before the suggestions array; schema makes the field required (both OpenAI strict + Groq simplified). Mechanism: autoregressive conditioning — the LLM's own summary tokens are in context while it generates each suggestion, so scene-specific constraints are enforced by the model's recent generation history rather than by re-reading the rules section. Implementation expanded `StructuredOutputEnforcer.enforceJSON` with an opt-in `captureSiblings` option to surface scene_summary into V2 engine telemetry without breaking the existing unwrap-to-array contract. Post-change baseline (n=<fill>, judge ρ=0.755 anchor): relevance <fill> (Δ <fill> from 3.57), categoryFidelity <fill> (floor 4.0), plausibility <fill>, diversity <fill>, qualityRange <fill>, total <fill>. <Outcome statement: success criterion met / partially met / not met; next step>.
```

Replace `<fill>` and the outcome statement with actual values.

- [ ] **Step 3: Type/lint sanity**

Run: `npx tsc --noEmit && npx eslint --config config/lint/eslint.config.js . --quiet`
Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/specs/2026-05-14-baseline-quality-improvement-design.md docs/superpowers/programs/measurement.md
git commit -m "docs(measurement): record Sub-project B post-implementation baseline

Parent spec gains the Sub-project B section with measured pre/post
deltas across all 5 suggestions dimensions. Measurement Program
reordering log gets a 2026-05-15 entry documenting the structural
change (captureSiblings opt-in in enforceJSON, scene_summary in the
schema and prompt) and the result against the success criterion."
```

---

## Self-Review

**Spec coverage check:**

- Spec § 0 motivation (relevance gap, mechanism hypothesis, success criterion) → captured in plan goal + Tasks 10's verification.
- Spec § 1 locked decisions: Approach A → all tasks. Field name `scene_summary` → Tasks 3, 4. Field position first → Tasks 3, 4. Required in schema → Task 3. Engine logs but doesn't validate → Task 6. Schema variants in lockstep → Task 3 single commit. Custom path untouched → Task 6 (custom branch in `_generateGuidedCandidates`), Task 4 (only `buildPrompt`, not `buildCustomPrompt`). Telemetry in scope → Tasks 8, 9. Fallback tolerant parse → Task 6 step 1.
- Spec § 2.1 schema details → Task 3.
- Spec § 2.2 prompt builder details → Task 4.
- Spec § 2.3 engine extraction → Task 6.
- Spec § 2.4 telemetry → Tasks 8, 9.
- Spec § 2.5 verification → Task 10.
- Spec § 4 risks: missing field → Task 6 step 1 tolerant parse + Task 7 test. categoryFidelity regression → Task 10 step 6 floor check. Token cost → cited in spec as low; no extra task. PII → cited as none.
- Spec § 5 sequencing → matches task order.

**Placeholder scan:** the `<fill>` markers in Task 11 are intentional (real numbers come from Task 10 at execution time). No "TBD" or "implement later" anywhere. Every code step has full code.

**Type consistency:**

- `GuidedGenerationResult` defined in Task 5, used in Tasks 6 (engine functions).
- `EnhancementV2DebugPayload.sceneSummary` defined in Task 5, written in Task 6, read in Task 9.
- `SuggestionsTraceCompleteSummary.sceneSummary` defined in Task 8, written in Task 9.
- `captureSiblings` option in Task 2, consumed in Task 6.
- `unwrapSuggestionsArrayWithSiblings` in Task 1, used in Task 2.

No naming drift.

**No-regex compliance:** all new code uses string `.includes`, `.indexOf`, or structural patterns. No `RegExp` literals introduced.
