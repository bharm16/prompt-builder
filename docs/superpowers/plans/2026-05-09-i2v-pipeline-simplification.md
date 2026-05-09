# I2V Pipeline Simplification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Collapse the I2V pipeline from a three-mode (strict/flexible/transform) constraint system to a single mode where the start image anchors visuals and the prompt drives motion. Delete the entire mode/lock subsystem (~600 lines of server code, several client components) and add a Motion Ideas panel that surfaces image-aware motion phrases.

**Architecture:** The change is by-subtraction more than by-addition. Server-side, `PromptOptimizationService` loses its I2V branch and `EnhancementService` loses its `I2VConstrainedSuggestions` filter; both routes always run their T2V pipelines regardless of image presence. A new `MotionIdeaService` (thin orchestrator over the existing `ImageObservationService`) feeds a new client `MotionIdeasPanel` component. Client editor hides the Enhance button in I2V mode (the user-facing "Optimize" trigger), the Generate button gains an empty-prompt allowance gated on `isI2VMode`, and per-provider video adapters substitute placeholder prompts for providers that require non-empty input (Kling, Runway).

**Tech Stack:** Node 20 + Express + tsx + TypeScript (server), React 18 + Vite + Tailwind + DaisyUI (client), Vitest (unit/integration), Playwright (e2e), Zod (schema validation), `aiService` (LLM router).

**Source spec:** [`docs/superpowers/specs/2026-05-09-i2v-pipeline-simplification-design.md`](../specs/2026-05-09-i2v-pipeline-simplification-design.md)

**Key terminology note for implementers:** The spec calls the button to hide the "Optimize" button. In this codebase the corresponding UI control is the **Enhance** button (`aria-label="Enhance prompt"` in `TuneDrawer.tsx` line 140; also surfaced as `aria-label="AI Enhance"` in `VideoPromptToolbar.tsx` line 119). It triggers `handleEnhance` → `onReoptimize` → `handleOptimize` → `POST /api/optimize`. There is no literal "Optimize" button. Tasks reference the Enhance button explicitly.

---

## Phase 1 — Server I2V deletions

**Goal:** Remove `I2VMotionStrategy`, `i2vFlow`, `I2VConstrainedSuggestions`, server-side I2V types, and the `parse_i2v_prompt` AI execution. After this phase, `/api/optimize` and `/api/suggestions` no longer have I2V branches.

### Task 1.1: Slim `PromptOptimizationService` of I2V

**Files:**

- Modify: `server/src/services/prompt-optimization/PromptOptimizationService.ts`
- Modify: `server/src/services/prompt-optimization/types.ts`
- Modify: `server/src/services/prompt-optimization/workflows/types.ts`

- [ ] **Step 1: Verify the test guard exists**

Run: `npx vitest run server/src/services/prompt-optimization --config config/test/vitest.unit.config.js`
Expected: existing tests pass (this gives us a baseline before deletion).

- [ ] **Step 2: Remove I2V branching from `optimize` and delete `optimizeI2V` method**

Edit `server/src/services/prompt-optimization/PromptOptimizationService.ts`. The new `optimize` method must always run `runOptimizeFlow` regardless of `startImage`:

Replace lines 92-127 (the `async optimize(...)` method body and `optimizeI2V`) with:

```ts
async optimize(request: OptimizationRequest): Promise<OptimizationResponse> {
  if (request.startImage) {
    this.log.warn(
      "Received startImage on /api/optimize; ignoring — I2V optimization is no longer supported",
      { operation: "optimize.i2vIgnored" },
    );
  }

  return runOptimizeFlow({
    request,
    log: this.log,
    optimizationCache: this.optimizationCache,
    shotInterpreter: this.shotInterpreter,
    strategy: this.videoStrategy,
    compilationService: this.compilationService,
    applyConstitutionalAI: (nextPrompt, mode, signal) =>
      this.applyConstitutionalAI(nextPrompt, mode, signal),
    logOptimizationMetrics: (originalPrompt, optimizedPrompt, mode) =>
      this.logOptimizationMetrics(originalPrompt, optimizedPrompt, mode),
    intentLock: this.intentLock,
    promptLint: this.promptLint,
  });
}
```

Also delete the `private optimizeI2V` method (lines 129-142).

Remove these unused imports at the top:

```ts
import { I2VMotionStrategy } from "./strategies/I2VMotionStrategy";
import type { I2VConstraintMode } from "./types/i2v";
import { runI2vFlow } from "./workflows/i2vFlow";
```

Remove the `i2vStrategy` field declaration (line 41) and its constructor initialization (line 71).

- [ ] **Step 3: Strip `inputMode` and `i2v` from `OptimizationResponse`**

Edit `server/src/services/prompt-optimization/types.ts` — replace the entire interface (lines 138-145):

```ts
export interface OptimizationResponse {
  prompt: string;
  metadata?: Record<string, unknown>;
  artifactKey?: string;
  compilation?: CompilationState;
}
```

Remove these fields from `OptimizationRequest` (lines 74-78):

```ts
  // I2V-specific
  startImage?: string;
  constraintMode?: I2VConstraintMode;
  /** server-only fast path for platform-generated images */
  sourcePrompt?: string;
```

> **Note:** `startImage` was used as the I2V trigger; we keep accepting it on the wire (the frontend still sends it) but log+ignore it as in Step 2. The schema removal happens in Phase 2 (shared layer).

Wait — keep `startImage`, `sourcePrompt` and remove only `constraintMode`. The other two are referenced by the `optimize.routes.ts` parser; we drain them via the warning log path. Replace the I2V-specific block with:

```ts
  /** Present in legacy I2V calls; ignored after the I2V pipeline removal. */
  startImage?: string;
  /** Present in legacy I2V calls; ignored after the I2V pipeline removal. */
  sourcePrompt?: string;
```

Remove the `I2VConstraintMode, I2VOptimizationResult` import from line 8.

- [ ] **Step 4: Update workflow types**

Edit `server/src/services/prompt-optimization/workflows/types.ts`. Delete:

- The `import type { I2VConstraintMode, I2VOptimizationResult } from "../types/i2v";` line (line 15)
- The `ImageObservationLike` type (lines 153-163)
- The `I2VStrategyLike` type (lines 165-167)
- The `I2VFlowArgs` interface (lines 169-180)

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: errors only at sites that consumed deleted types — `routes/optimize/handlers/optimize.ts` will need updating in the next task. Note remaining errors and proceed.

- [ ] **Step 6: Run unit tests for the optimization service**

Run: `npx vitest run server/src/services/prompt-optimization --config config/test/vitest.unit.config.js`
Expected: any previously passing test that asserted on `inputMode === "i2v"` or `result.i2v` will now fail. Don't fix yet — the tests themselves are getting deleted in Task 1.5.

- [ ] **Step 7: Commit**

```bash
git add server/src/services/prompt-optimization/PromptOptimizationService.ts \
        server/src/services/prompt-optimization/types.ts \
        server/src/services/prompt-optimization/workflows/types.ts
git commit -m "refactor(prompt-optimization): remove I2V branching from optimize service"
```

### Task 1.2: Update `optimize.routes.ts` to drop the `i2v` response field

**Files:**

- Modify: `server/src/routes/optimize/handlers/optimize.ts`

- [ ] **Step 1: Locate the response-shape line**

Read `server/src/routes/optimize/handlers/optimize.ts` and find the response construction near line 177 (was `...(result.i2v ? { i2v: result.i2v } : {}),`).

- [ ] **Step 2: Remove the i2v spread**

Delete the line `...(result.i2v ? { i2v: result.i2v } : {}),` from the response object.

If there's also an `inputMode` field in the response (e.g., `inputMode: result.inputMode`), delete that too.

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: clean for this file. Other modules may still have errors; those are addressed in subsequent tasks.

- [ ] **Step 4: Commit**

```bash
git add server/src/routes/optimize/handlers/optimize.ts
git commit -m "refactor(optimize-route): drop i2v field from response"
```

### Task 1.3: Delete `I2VMotionStrategy` and `i2vFlow`

**Files:**

- Delete: `server/src/services/prompt-optimization/strategies/I2VMotionStrategy.ts`
- Delete: `server/src/services/prompt-optimization/strategies/__tests__/I2VMotionStrategy.test.ts`
- Delete: `server/src/services/prompt-optimization/workflows/i2vFlow.ts`

- [ ] **Step 1: Remove the files**

```bash
rm server/src/services/prompt-optimization/strategies/I2VMotionStrategy.ts
rm server/src/services/prompt-optimization/strategies/__tests__/I2VMotionStrategy.test.ts
rm server/src/services/prompt-optimization/workflows/i2vFlow.ts
```

- [ ] **Step 2: Sweep for any remaining references**

Run: `git grep -nE "I2VMotionStrategy|runI2vFlow|i2vFlow"`
Expected: No matches in `server/src/`, `client/src/`, or `shared/`. If matches exist, they are stale — remove them.

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: clean for these specific deletions; other phase-1 errors may remain.

- [ ] **Step 4: Commit**

```bash
git add -A server/src/services/prompt-optimization/strategies/ \
           server/src/services/prompt-optimization/workflows/
git commit -m "refactor(prompt-optimization): delete I2VMotionStrategy and i2vFlow"
```

### Task 1.4: Delete server-side I2V types module

**Files:**

- Delete: `server/src/services/prompt-optimization/types/i2v.ts`

- [ ] **Step 1: Verify no remaining importers**

Run: `git grep -nE "from.*prompt-optimization/types/i2v"`
Expected: zero matches in `server/src/`. (Earlier tasks removed the importers in `types.ts` and `workflows/types.ts`.)

- [ ] **Step 2: Delete the file**

```bash
rm server/src/services/prompt-optimization/types/i2v.ts
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors from this deletion.

- [ ] **Step 4: Commit**

```bash
git add -A server/src/services/prompt-optimization/types/
git commit -m "refactor(prompt-optimization): delete server I2V types module"
```

### Task 1.5: Delete I2V-specific tests in prompt-optimization

**Files:**

- Delete: any test file under `server/src/services/prompt-optimization/` whose subject is I2V optimization
- Modify: any test file that retains valid coverage but currently asserts on I2V fields

- [ ] **Step 1: Locate I2V-specific tests**

Run: `git grep -lE "constraintMode|inputMode.*i2v|I2VOptimizationResult|i2v:|i2vStrategy" server/src/services/prompt-optimization/ tests/`
Note each result.

- [ ] **Step 2: Triage and act**

For each file:

- If the entire file is about I2V optimization — delete it.
- If the file is mostly T2V optimization with stray I2V assertions — delete the I2V-specific tests, keep the rest.

A specific file expected to be in the second category: `tests/unit/prompt-optimization-service.contract.test.ts` (per CLAUDE.md). Read it, locate its I2V-related contract assertions (search for `constraintMode`, `inputMode`, `i2v`), and remove those assertions while keeping the T2V contract checks intact.

- [ ] **Step 3: Run unit tests**

Run: `npm run test:unit`
Expected: passes (or at minimum, all I2V-related test failures are gone).

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "test(prompt-optimization): drop I2V-specific assertions"
```

### Task 1.6: Slim `EnhancementService` of `I2VConstrainedSuggestions`

**Files:**

- Modify: `server/src/services/enhancement/EnhancementService.ts`
- Delete: `server/src/services/enhancement/services/I2VConstrainedSuggestions.ts`
- Delete: any tests under `server/src/services/enhancement/` that target I2VConstrainedSuggestions

- [ ] **Step 1: Locate I2V hooks in `EnhancementService.ts`**

Read `server/src/services/enhancement/EnhancementService.ts` in full. Identify:

- The import of `I2VConstrainedSuggestions` (line 8)
- The field declaration `private readonly i2vConstraints: I2VConstrainedSuggestions;` (line 83)
- The constructor initialization (where `new I2VConstrainedSuggestions()` is called)
- All call sites of `this.i2vConstraints.filterSuggestions(...)` (search for `i2vConstraints`)
- Any pass-through of the `i2vContext` param into the filter

- [ ] **Step 2: Delete those hooks**

Edit `EnhancementService.ts`:

- Remove the import line.
- Remove the `private readonly i2vConstraints` field.
- Remove the constructor line that instantiates it.
- At every call site, remove the filter wrapping and use the unfiltered `Suggestion[]` directly (the variable previously fed into `filterSuggestions` is the raw output of the standard pipeline; just return it).

- [ ] **Step 3: Find and remove any `i2vContext` request fields routed into `getEnhancementSuggestions`**

Search: `grep -n "i2vContext" server/src/services/enhancement/EnhancementService.ts server/src/services/enhancement/services/types.ts`

For each occurrence:

- Drop `i2vContext` from the public `EnhancementRequestParams` type (in `services/types.ts`).
- Drop `i2vContext` destructuring inside the method body of `getEnhancementSuggestions`.
- Stop forwarding `i2vContext` into any internal call.

- [ ] **Step 4: Delete the standalone class file**

```bash
rm server/src/services/enhancement/services/I2VConstrainedSuggestions.ts
```

If a sibling test file targets it specifically (e.g., `I2VConstrainedSuggestions.test.ts`), delete that too:

```bash
git ls-files server/src/services/enhancement/services/__tests__/ | grep -i i2v | xargs --no-run-if-empty rm
```

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: zero errors in `server/src/services/enhancement/`. If errors remain, inspect — it usually means a stray import or a related route file (`enhancementSuggestionsRoute.ts`) still references `i2vContext`; that's fixed in Task 1.7.

- [ ] **Step 6: Commit**

```bash
git add -A server/src/services/enhancement/
git commit -m "refactor(enhancement): remove I2VConstrainedSuggestions filter"
```

### Task 1.7: Drop `i2vContext` from the suggestions route handler

**Files:**

- Modify: `server/src/routes/enhancement/enhancementSuggestionsRoute.ts`
- Modify: `server/src/config/schemas/suggestionSchemas.ts` (if it contains `i2vContext`)

- [ ] **Step 1: Edit the route handler**

In `server/src/routes/enhancement/enhancementSuggestionsRoute.ts`, remove `i2vContext` from the destructure (currently line 51) and from the call payload (currently line 87):

Replace lines 36-51 (the destructure) with the version that omits `i2vContext`:

```ts
const {
  highlightedText,
  contextBefore,
  contextAfter,
  fullPrompt,
  originalUserPrompt,
  brainstormContext,
  highlightedCategory,
  highlightedCategoryConfidence,
  highlightedPhrase,
  allLabeledSpans,
  nearbySpans,
  editHistory,
} = req.body;
```

Replace the `enhancementService.getEnhancementSuggestions({...})` call (lines 74-89) — drop the `i2vContext` line:

```ts
const result = await enhancementService.getEnhancementSuggestions({
  highlightedText,
  contextBefore,
  contextAfter,
  fullPrompt,
  originalUserPrompt,
  brainstormContext,
  highlightedCategory,
  highlightedCategoryConfidence,
  highlightedPhrase,
  allLabeledSpans,
  nearbySpans,
  editHistory,
  debug,
});
```

- [ ] **Step 2: Update the request schema**

Read `server/src/config/schemas/suggestionSchemas.ts`. Locate the `i2vContext` field on the request schema and remove it.

If the schema uses `.passthrough()`, the field can simply be deleted (existing clients sending it won't break). If `.strict()` is used, removing means the server will reject requests with `i2vContext`. Coordinate with Phase 3 (client deletions) so the client stops sending this field before this server-side strictness lands. Either way, if `.strict()` is used, change it to `.passthrough()` for one release and revisit later.

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: zero errors.

- [ ] **Step 4: Commit**

```bash
git add server/src/routes/enhancement/enhancementSuggestionsRoute.ts \
        server/src/config/schemas/suggestionSchemas.ts
git commit -m "refactor(enhancement-route): drop i2vContext from suggestions route"
```

### Task 1.8: Remove the `parse_i2v_prompt` AI execution config

**Files:**

- Modify: `server/src/config/modelConfig.ts`

- [ ] **Step 1: Locate the `parse_i2v_prompt` config block**

Read `server/src/config/modelConfig.ts` lines 468-480. The config block looks like:

```ts
/**
 * Parse i2v prompts into motion vs visual components
 */
parse_i2v_prompt: {
  client: process.env.I2V_PARSE_PROVIDER || "openai",
  model: process.env.I2V_PARSE_MODEL || "gpt-4o-mini-2024-07-18",
  temperature: 0.1,
  maxTokens: 800,
  timeout: 20000,
  responseFormat: "json_object",
  useSeed: true,
  useDeveloperMessage: true,
},
```

- [ ] **Step 2: Delete the entire block (including the doc comment above it)**

Confirm with `git grep -n "parse_i2v_prompt"` afterward — zero matches in the codebase (the only call site, `I2VMotionStrategy.ts`, was already deleted in Task 1.3).

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 4: Run unit tests for the AI service**

Run: `npx vitest run server/src/services/ai-model --config config/test/vitest.unit.config.js`
Expected: clean (no test references `parse_i2v_prompt`).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore(aiService): drop parse_i2v_prompt execution registration"
```

### Task 1.9: Phase-1 verification gates

- [ ] **Step 1: Type check**

Run: `npx tsc --noEmit`
Expected: zero errors.

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: zero errors.

- [ ] **Step 3: Unit tests**

Run: `npm run test:unit`
Expected: all pass.

- [ ] **Step 4: Integration test gate (touched DI/config)**

Run: `PORT=0 npx vitest run tests/integration/bootstrap.integration.test.ts tests/integration/di-container.integration.test.ts --config config/test/vitest.integration.config.js`
Expected: all pass.

- [ ] **Step 5: Repo-wide I2V residue scan**

Run: `git grep -nE "I2VMotionStrategy|I2VConstrainedSuggestions|runI2vFlow|i2vFlow|parse_i2v_prompt" server/`
Expected: zero matches.

If issues found, fix and re-run from Step 1.

---

## Phase 2 — Shared schema cleanup

**Goal:** Remove I2V-specific schemas from `shared/schemas/optimization.schemas.ts` and update `preview.schemas.ts` to allow empty prompts in video preview requests.

### Task 2.1: Strip I2V types from optimization schemas

**Files:**

- Modify: `shared/schemas/optimization.schemas.ts`

- [ ] **Step 1: Identify all I2V-specific exports**

Read `shared/schemas/optimization.schemas.ts`. The I2V exports start at line 26 (`InputModeSchema`) through line 85 (`I2VOptimizationResult` type alias).

- [ ] **Step 2: Delete I2V-specific schemas and types**

Edit `shared/schemas/optimization.schemas.ts`. Remove these declarations:

```ts
export const InputModeSchema = z.enum(["t2v", "i2v"]);
export const I2VConstraintModeSchema = z.enum(["strict", "flexible", "transform"]);
export const LockStatusSchema = z.enum(["hard", "soft", "unlocked"]);
export const LockableCategorySchema = z.enum([...]); // 8-element enum
export const LockMapSchema = z.object({...}).passthrough();
export const ConflictWarningSchema = z.object({...}).passthrough();
export const I2VOptimizationResultSchema = z.object({...}).passthrough();
export type I2VOptimizationResult = z.infer<typeof I2VOptimizationResultSchema>;
```

In the `OptimizeResponseSchema` (currently lines 131-141), drop these fields:

```ts
inputMode: InputModeSchema.optional(),
i2v: I2VOptimizationResultSchema.optional(),
```

The new schema:

```ts
export const OptimizeResponseSchema = z
  .object({
    prompt: z.string(),
    optimizedPrompt: z.string().optional(),
    artifactKey: z.string().optional(),
    compilation: CompilationStateSchema.optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })
  .passthrough();
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: errors at every consumer of the deleted exports. Note the file paths — they will be addressed in Phase 3.

- [ ] **Step 4: Commit**

```bash
git add shared/schemas/optimization.schemas.ts
git commit -m "refactor(shared): drop I2V schemas from optimization contract"
```

### Task 2.2: Allow empty prompts in preview schemas

**Files:**

- Modify: `shared/schemas/preview.schemas.ts`

- [ ] **Step 1: Locate the video preview request schema**

Read `shared/schemas/preview.schemas.ts`. The video preview request schema may live elsewhere — search for it:

```bash
git grep -nE "videoPreviewRequest|generateVideoRequest|GenerateVideoRequestSchema" shared/ server/src/
```

Note the actual schema file path (likely `server/src/contracts/preview.contracts.ts` or similar).

- [ ] **Step 2: Inspect the prompt field**

Read the schema. The `prompt` field currently requires `z.string().min(1)` or similar. Change it to `z.string()` (allowing empty), but keep a validation guard at the route level: prompt may be empty only when `startImage` is set.

- [ ] **Step 3: Add a refinement at the route boundary**

In the schema file, add a `.refine()` to the request schema:

```ts
.refine(
  (data) => data.prompt.length > 0 || (typeof data.startImage === "string" && data.startImage.length > 0),
  { message: "prompt must be non-empty unless a startImage is provided", path: ["prompt"] },
)
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: clean for the schema file.

- [ ] **Step 5: Commit**

```bash
git add shared/schemas/preview.schemas.ts # adjust path as discovered in Step 1
git commit -m "refactor(shared): allow empty prompt for I2V video previews"
```

### Task 2.3: Phase-2 verification

- [ ] **Step 1: Type check (will surface client-side breakage)**

Run: `npx tsc --noEmit`
Expected: errors only in `client/src/` files that imported deleted schemas. These are addressed in Phase 3. Confirm no server-side errors remain.

- [ ] **Step 2: Run contract tests**

Run: `npx vitest run tests/unit/preview-schemas.contract.test.ts tests/unit/prompt-optimization-service.contract.test.ts`
Expected: tests that asserted I2V schema fields will fail; the test file `prompt-optimization-service.contract.test.ts` was already cleaned in Task 1.5. If `preview-schemas.contract.test.ts` asserts that empty prompts are rejected, update it to assert the new behavior (rejected when `startImage` is also missing; allowed when `startImage` is present).

- [ ] **Step 3: If preview-schemas test needs updating, do so and commit**

```bash
git add tests/unit/preview-schemas.contract.test.ts
git commit -m "test(preview-schemas): assert empty-prompt allowance with startImage"
```

---

## Phase 3 — Client I2V deletions

**Goal:** Remove `ConstraintModeSelector`, `useCanvasI2V`, the kebab-menu mode list in the canvas editor, the "I2V strict" badge, and slim `useI2VContext` so it stops returning `constraintMode`/`setConstraintMode`. Stop sending `constraintMode` and `i2vContext` in client API requests.

### Task 3.1: Slim `useI2VContext`

**Files:**

- Modify: `client/src/features/prompt-optimizer/hooks/useI2VContext.ts`
- Modify: `client/src/features/prompt-optimizer/types/i2v.ts`

- [ ] **Step 1: Update the I2VContext type to remove mode/lock fields**

Edit `client/src/features/prompt-optimizer/types/i2v.ts`. Delete:

- `I2VConstraintMode` type alias
- `LockStatus` type alias
- `LockableCategory` type alias
- `LockMap` interface
- `deriveLockMap` function
- `ConflictWarning` interface
- `I2VOptimizationResult` interface

Keep `ImageObservation` interface and `I2VContext` interface — but rewrite `I2VContext`:

```ts
export interface I2VContext {
  isI2VMode: boolean;
  startImageUrl: string | null;
  startImageSourcePrompt: string | null;
  observation: ImageObservation | null;
  isAnalyzing: boolean;
  error: string | null;
  refreshObservation: () => Promise<void>;
}
```

(Notice no `lockMap`, no `constraintMode`, no `setConstraintMode`.)

- [ ] **Step 2: Slim `useI2VContext` hook**

Edit `client/src/features/prompt-optimizer/hooks/useI2VContext.ts`. Delete:

- The `setConstraintMode` destructure from `useGenerationControlsStoreActions()` (line 41)
- The `constraintMode` and `cameraMotionLocked` derivations (lines 47-48, 55)
- The `lockMap` `useMemo` (lines 57-61)
- The `handleSetConstraintMode` callback (lines 63-68)
- `constraintMode`, `setConstraintMode: handleSetConstraintMode`, `lockMap` from the return value

The new return statement (replaces lines 163-174):

```ts
return {
  isI2VMode,
  startImageUrl,
  startImageSourcePrompt,
  observation,
  isAnalyzing,
  error,
  refreshObservation,
};
```

- [ ] **Step 3: Sweep for references**

Run: `git grep -nE "constraintMode|setConstraintMode|lockMap|i2vContext\\.constraintMode" client/src/`
Expected: many matches in components and other files. These are addressed in subsequent tasks. List them in a scratch note for now.

- [ ] **Step 4: Don't type-check yet — leaving broken on purpose**

Other tasks in this phase will fix the consuming sites. Skipping type-check now.

- [ ] **Step 5: Commit**

```bash
git add client/src/features/prompt-optimizer/types/i2v.ts \
        client/src/features/prompt-optimizer/hooks/useI2VContext.ts
git commit -m "refactor(i2v): slim I2VContext to image-anchor-only fields"
```

### Task 3.2: Delete `ConstraintModeSelector` and `useCanvasI2V`

**Files:**

- Delete: `client/src/features/prompt-optimizer/components/ConstraintModeSelector.tsx`
- Delete: `client/src/features/prompt-optimizer/PromptCanvas/hooks/useCanvasI2V.ts`
- Delete: any related test files

- [ ] **Step 1: Find consumers of `ConstraintModeSelector`**

Run: `git grep -nE "ConstraintModeSelector"`
Expected: import sites. Note them.

- [ ] **Step 2: Find consumers of `useCanvasI2V`**

Run: `git grep -nE "useCanvasI2V"`
Expected: import sites. Note them.

- [ ] **Step 3: Delete the files**

```bash
rm client/src/features/prompt-optimizer/components/ConstraintModeSelector.tsx
rm client/src/features/prompt-optimizer/PromptCanvas/hooks/useCanvasI2V.ts
git ls-files tests/ | xargs grep -l "ConstraintModeSelector\|useCanvasI2V" 2>/dev/null | xargs --no-run-if-empty rm
```

- [ ] **Step 4: Don't type-check yet**

Consumers still reference these — they're cleaned next.

- [ ] **Step 5: Commit (deferred until Task 3.3 cleans up consumers, to avoid a non-compiling commit)**

Hold this commit. Move directly to Task 3.3 and bundle these deletions with the consumer-cleanup commit.

### Task 3.3: Remove `ConstraintModeSelector` consumer wiring

**Files (consumers — verify with grep before editing):**

- Modify: `client/src/features/prompt-optimizer/PromptCanvas/PromptCanvas.tsx`
- Modify: `client/src/features/prompt-optimizer/PromptCanvas/components/PromptCanvasEditorSection.tsx`
- Modify: `client/src/features/prompt-optimizer/PromptCanvas/components/PromptCanvasView.tsx`
- Modify: `client/src/features/prompt-optimizer/PromptCanvas/components/PromptCanvasView.types.ts`
- Modify: `client/src/features/prompt-optimizer/PromptOptimizerContainer/PromptOptimizerWorkspace.tsx`

- [ ] **Step 1: PromptCanvas.tsx — remove I2V prop drilling**

Edit `client/src/features/prompt-optimizer/PromptCanvas/PromptCanvas.tsx`:

- Remove the `useCanvasI2V` import.
- Remove the call site (search for `useCanvasI2V({`) and the destructure that consumed its output.
- Drop the props: `showI2VLockIndicator`, `resolvedI2VReason`, `i2vMotionAlternatives`, `handleLockedAlternativeClick`, `effectiveConstraintMode`, `lockedSpanIndicators`.
- Stop passing `i2vContext.constraintMode` to children. Other I2V context fields (`isI2VMode`, `observation`) may still flow.

- [ ] **Step 2: PromptCanvasEditorSection.tsx — remove badge and kebab mode list**

Edit `client/src/features/prompt-optimizer/PromptCanvas/components/PromptCanvasEditorSection.tsx`:

- Delete lines 230-234 (the `i2vContext?.isI2VMode && <span>I2V {i2vContext.constraintMode}</span>` block — the "I2V strict" badge).
- Delete lines 320-359 (the kebab-menu "I2V Mode" group with the strict/flexible/transform buttons). Search for `["strict", "flexible", "transform"]` to confirm the exact range.
- Drop the `i2vContext` prop from the component's props interface if it's no longer used after these removals (run `grep -n "i2vContext" client/src/features/prompt-optimizer/PromptCanvas/components/PromptCanvasEditorSection.tsx` to verify).

- [ ] **Step 3: PromptCanvasView and types — drop unused props**

Edit `client/src/features/prompt-optimizer/PromptCanvas/components/PromptCanvasView.tsx` and its `.types.ts` sibling: remove props that came from `useCanvasI2V` (the lock indicator props especially).

- [ ] **Step 4: PromptOptimizerWorkspace — drop the `constraintMode` arg passed into `usePromptOptimization`**

Edit `client/src/features/prompt-optimizer/PromptOptimizerContainer/PromptOptimizerWorkspace.tsx` line 669:

```ts
constraintMode: i2vContext.constraintMode,
```

Delete this line. The `usePromptOptimization` hook will receive no `constraintMode` (which is fine — Task 3.5 deletes the param entirely).

- [ ] **Step 5: Search for residual references**

Run: `git grep -nE "constraintMode|setConstraintMode|showI2VLockIndicator|i2vMotionAlternatives" client/src/`
Expected: only matches in `generation-controls/context/GenerationControlsStore.tsx` (handled in Task 3.4) and `usePromptOptimization.ts` (handled in Task 3.5).

- [ ] **Step 6: Type-check**

Run: `npx tsc --noEmit`
Expected: errors only in the two files mentioned in Step 5.

- [ ] **Step 7: Commit (bundles Task 3.2 deletions with consumer cleanup)**

```bash
git add -A client/src/features/prompt-optimizer/components/ConstraintModeSelector.tsx \
           client/src/features/prompt-optimizer/PromptCanvas/hooks/useCanvasI2V.ts \
           client/src/features/prompt-optimizer/PromptCanvas/PromptCanvas.tsx \
           client/src/features/prompt-optimizer/PromptCanvas/components/PromptCanvasEditorSection.tsx \
           client/src/features/prompt-optimizer/PromptCanvas/components/PromptCanvasView.tsx \
           client/src/features/prompt-optimizer/PromptCanvas/components/PromptCanvasView.types.ts \
           client/src/features/prompt-optimizer/PromptOptimizerContainer/PromptOptimizerWorkspace.tsx \
           tests/
git commit -m "refactor(prompt-optimizer): delete ConstraintModeSelector + canvas I2V mode UI"
```

### Task 3.4: Remove `constraintMode` from generation-controls store

**Files:**

- Modify: `client/src/features/generation-controls/context/GenerationControlsStore.tsx`
- Modify: `client/src/features/generation-controls/context/generationControlsStoreTypes.ts` (where `ConstraintMode` is defined, line 7)
- Modify: `client/src/features/generation-controls/index.ts` (re-export, line 28)

- [ ] **Step 1: Locate the constraint-mode state, action, and reducer cases**

Read `client/src/features/generation-controls/context/GenerationControlsStore.tsx`. Identify:

- Line 57: action variant `{ type: "setConstraintMode"; value: ConstraintMode }`
- Line 86: actions interface field `setConstraintMode: (mode: ConstraintMode) => void;`
- Lines 479-483: reducer case
- Lines 568-569: action creator
- Any place where `state.ui.constraintMode` is read

- [ ] **Step 2: Delete those declarations**

Remove the action variant, the actions interface field, the reducer case, and the action creator. Drop `constraintMode` from the initial `ui` state. Drop the `ConstraintMode` import from the file's imports.

- [ ] **Step 3: Drop the `ConstraintMode` type alias**

Find the alias (likely in `client/src/features/generation-controls/types.ts`) and delete the export.

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: errors only in `usePromptOptimization.ts` (handled in Task 3.5) and possibly `useI2VContext.ts` (already handled in Task 3.1).

- [ ] **Step 5: Commit**

```bash
git add client/src/features/generation-controls/context/GenerationControlsStore.tsx \
        client/src/features/generation-controls/types.ts
git commit -m "refactor(generation-controls): drop constraintMode state + action"
```

### Task 3.5: Drop I2V wiring from `usePromptOptimization`

**Files:**

- Modify: `client/src/features/prompt-optimizer/PromptOptimizerContainer/hooks/usePromptOptimization.ts`

- [ ] **Step 1: Drop the `constraintMode` param**

Edit `client/src/features/prompt-optimizer/PromptOptimizerContainer/hooks/usePromptOptimization.ts`:

- Delete `constraintMode?: "strict" | "flexible" | "transform";` from `UsePromptOptimizationParams` (line 136).
- Delete `constraintMode,` from the destructure in `usePromptOptimization({...})` (line 179).
- In `effectiveOptions` (lines 287-291), delete the entire `...(normalizedOptions?.constraintMode ? {} : constraintMode ? { constraintMode } : {}),` block.
- Remove `constraintMode` from the dependency array (line 419).

- [ ] **Step 2: Add early-exit for I2V**

Per the spec: when an image is set, the Enhance/Optimize button is hidden and `handleOptimize` shouldn't run. The current call sites still trigger handleOptimize from keyboard shortcuts. Add a guard at the top of `handleOptimize`:

After line 211 (`let normalizedOptions = options;`), insert:

```ts
// I2V mode: there is no text-rewrite step. Image anchors visuals; user's prompt
// goes to the model verbatim. Bypass the optimize call entirely.
if (typeof startImageUrl === "string" && startImageUrl.length > 0) {
  const directPrompt = (promptToOptimize ?? inputPrompt ?? "").trim();
  setDisplayedPromptSilently(directPrompt);
  setShowResults(true);
  return;
}
```

This makes the keyboard-shortcut and Enhance-button paths inert in I2V (they'll just transition the UI to results view with the user's literal prompt, no API call).

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: zero errors.

- [ ] **Step 4: Smoke-test the editor (manual)**

Skip if working in a worktree (per CLAUDE.md). Otherwise:

```bash
npm run dev
```

Open the editor, set a start image, type a prompt, press Cmd+Enter. The UI should transition to results without a network call to `/api/optimize`. Verify in DevTools network tab.

If working in a worktree, verify by reading the code change carefully and trust the type checker for now; e2e in main checkout will catch regressions.

- [ ] **Step 5: Commit**

```bash
git add client/src/features/prompt-optimizer/PromptOptimizerContainer/hooks/usePromptOptimization.ts
git commit -m "refactor(prompt-optimization): bypass /api/optimize in I2V mode"
```

### Task 3.6: Drop `i2vContext` from useEnhancementSuggestions

**Files:**

- Modify: `client/src/features/prompt-optimizer/PromptOptimizerContainer/hooks/useEnhancementSuggestions.ts`
- Modify: `client/src/api/enhancementSuggestionsApi.ts` (if it forwards `i2vContext`)
- Modify: `client/src/features/prompt-optimizer/PromptCanvas/components/PromptCanvasSuggestionsPanel.tsx`

- [ ] **Step 1: Audit i2vContext usage**

Run: `git grep -n "i2vContext" client/src/features/prompt-optimizer/PromptOptimizerContainer/`
Expected: hook input + forward to API + likely a panel branch.

- [ ] **Step 2: Drop `i2vContext` from the suggestions hook param**

Edit `useEnhancementSuggestions.ts`. Remove `i2vContext` from the input destructure and from any forwarded request body.

- [ ] **Step 3: Drop `i2vContext` from the API client**

Edit `client/src/api/enhancementSuggestionsApi.ts`. Remove `i2vContext` from the request payload type and the actual fetch body.

- [ ] **Step 4: Stop short-circuiting suggestions on I2V locks in the suggestions panel**

Edit `client/src/features/prompt-optimizer/PromptCanvas/components/PromptCanvasSuggestionsPanel.tsx`. Find any branch that reads `i2vContext` to short-circuit results into `motionAlternatives` or `blockedReason`. Delete those branches; the suggestion panel renders standard results.

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: zero errors.

- [ ] **Step 6: Run unit tests**

Run: `npm run test:unit`
Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add -A client/src/features/prompt-optimizer/ client/src/api/enhancementSuggestionsApi.ts
git commit -m "refactor(suggestions): drop i2vContext from client suggestion flow"
```

### Task 3.7: Phase-3 verification gates

- [ ] **Step 1: Type check**

Run: `npx tsc --noEmit`
Expected: zero errors.

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: zero errors.

- [ ] **Step 3: Unit tests**

Run: `npm run test:unit`
Expected: all pass.

- [ ] **Step 4: Repo-wide I2V residue scan**

Run: `git grep -nE "ConstraintModeSelector|useCanvasI2V|deriveLockMap|LockableCategory|LockMap[^a-zA-Z]|I2VOptimizationResult|I2VConstrainedSuggestions|i2vMotionAlternatives|setConstraintMode" client/src/ shared/ server/src/`
Expected: zero matches.

- [ ] **Step 5: Re-run integration test gate (DI/config not touched in this phase, but cheap)**

Run: `PORT=0 npx vitest run tests/integration/bootstrap.integration.test.ts tests/integration/di-container.integration.test.ts --config config/test/vitest.integration.config.js`
Expected: pass.

---

## Phase 4 — Hide the Enhance button in I2V

**Goal:** When `isI2VMode === true`, hide the "Enhance prompt" button (which is the user-facing trigger for the optimize pipeline).

### Task 4.1: Hide Enhance in `TuneDrawer`

**Files:**

- Modify: `client/src/features/workspace-shell/components/TuneDrawer.tsx`

- [ ] **Step 1: Read the current Enhance button**

Read `client/src/features/workspace-shell/components/TuneDrawer.tsx`. The button has `aria-label={isEnhancing ? "Enhancing prompt…" : "Enhance prompt"}` (line 140).

The component receives an `onEnhance` callback. Currently `showEnhance = Boolean(onEnhance)` (line 47).

- [ ] **Step 2: Add an `isI2VMode` prop**

Add to the component's props interface (the section that includes `onEnhance?`, `enhanceDisabled?`, `isEnhancing?`):

```ts
/** When true, the Enhance button is hidden — image-anchored I2V has no text-rewrite step. */
isI2VMode?: boolean;
```

In the component body, update `showEnhance`:

```ts
const showEnhance = Boolean(onEnhance) && !isI2VMode;
```

- [ ] **Step 3: Wire the prop from the workspace**

Find where `<TuneDrawer ... onEnhance={...}>` is rendered. Run:

```bash
git grep -n "<TuneDrawer" client/src/
```

For each render site, pass `isI2VMode={i2vContext.isI2VMode}`.

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: zero errors.

- [ ] **Step 5: Commit**

```bash
git add client/src/features/workspace-shell/components/TuneDrawer.tsx
# also any caller files updated in Step 3
git commit -m "feat(i2v): hide Enhance button when start image is set"
```

### Task 4.2: Hide Enhance in `VideoPromptToolbar`

**Files:**

- Modify: `client/src/components/ToolSidebar/components/panels/GenerationControlsPanel/components/VideoPromptToolbar.tsx`

- [ ] **Step 1: Inspect the toolbar's Enhance button**

Read the file; the button is at line 119 with `aria-label="AI Enhance"`.

- [ ] **Step 2: Add an `isI2VMode` prop and gate visibility**

Add `isI2VMode?: boolean` to the component's props. Wrap the AI-Enhance button JSX in:

```tsx
{!isI2VMode && (
  <button ... aria-label="AI Enhance" ...>
    {/* existing markup */}
  </button>
)}
```

- [ ] **Step 3: Wire the prop from caller(s)**

Find render sites of `VideoPromptToolbar`:

```bash
git grep -n "<VideoPromptToolbar" client/src/
```

Pass `isI2VMode={i2vContext.isI2VMode}` to each.

- [ ] **Step 4: Type-check + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add client/src/components/ToolSidebar/components/panels/GenerationControlsPanel/components/VideoPromptToolbar.tsx
# also any caller files
git commit -m "feat(i2v): hide AI Enhance button in VideoPromptToolbar when I2V"
```

### Task 4.3: Disable the optimize keyboard shortcut in I2V

**Files:**

- Modify: `client/src/features/prompt-optimizer/PromptOptimizerContainer/PromptOptimizerWorkspace.tsx`

- [ ] **Step 1: Find the keyboard-shortcut binding**

Read `client/src/features/prompt-optimizer/PromptOptimizerContainer/PromptOptimizerWorkspace.tsx` lines 760-792 (the `useKeyboardShortcuts` block). The optimize binding is line 764-767.

- [ ] **Step 2: Make the shortcut a no-op in I2V**

Replace lines 764-767:

```ts
optimize: () =>
  !i2vContext.isI2VMode &&
  !promptOptimizer.isProcessing &&
  showResults === false &&
  handleOptimize(),
```

(`i2vContext` is already in scope from earlier in the function — verify with the read.)

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add client/src/features/prompt-optimizer/PromptOptimizerContainer/PromptOptimizerWorkspace.tsx
git commit -m "feat(i2v): disable optimize keyboard shortcut in I2V mode"
```

---

## Phase 5 — Generate button enable in I2V with empty prompt

**Goal:** The Generate button should be enabled when `isI2VMode === true` even if the prompt is empty. Provider adapters handle empty prompts in Phase 6.

### Task 5.1: Update `GenerationFooter` enable logic

**Files:**

- Modify: `client/src/components/ToolSidebar/components/panels/GenerationControlsPanel/components/GenerationFooter.tsx`

- [ ] **Step 1: Locate the disable logic**

Read `client/src/components/ToolSidebar/components/panels/GenerationControlsPanel/components/GenerationFooter.tsx`. The current disable computation is at line 65: `const isDisabled = isGenerateDisabled || !hasSufficientCredits;`.

The `isGenerateDisabled` prop is computed by the parent component (likely from `prompt.length === 0`). We don't change `GenerationFooter` itself — we change the parent that computes `isGenerateDisabled`.

- [ ] **Step 2: Find the parent that computes `isGenerateDisabled`**

Run: `git grep -n "isGenerateDisabled" client/src/`

- [ ] **Step 3: Update the parent**

In the parent, change the disable condition. Where it currently reads (paraphrased):

```ts
const isGenerateDisabled = prompt.trim().length === 0 || /* other checks */;
```

Change to:

```ts
const isGenerateDisabled =
  (prompt.trim().length === 0 && !i2vContext.isI2VMode) || /* other checks */;
```

(`i2vContext` should be in scope; if not, plumb it through from the workspace.)

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add -A client/src/
git commit -m "feat(i2v): allow Generate with empty prompt when start image is set"
```

### Task 5.2: Adjust the editor's empty-state placeholder

**Files:**

- Modify: `client/src/features/prompt-optimizer/PromptCanvas/components/PromptCanvasEditorSection.tsx` (line ~437 — call site of `<PromptEditor placeholder={...} />`)
- Modify: `client/src/features/workspace-shell/components/PromptEditorSurface.tsx` (other call site)

> **Note:** `PromptEditor` itself is a thin wrapper (`data-placeholder={placeholder}`); the placeholder _value_ is computed by the parent. Update each parent.

- [ ] **Step 1: Inspect the existing placeholder values**

Read both files. Find the line `placeholder={...}` on the `<PromptEditor>` JSX element.

- [ ] **Step 2: Compute an I2V-specific placeholder**

In each call site, replace the existing `placeholder` value with an `i2vContext`-aware computation:

```tsx
placeholder={
  i2vContext?.isI2VMode
    ? "Optional: add motion direction (or leave blank to animate the image)"
    : "Describe what you want to see..."
}
```

If the placeholder is sourced from a config/constants file, update there.

- [ ] **Step 3: Type-check + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add client/src/features/prompt-optimizer/components/PromptEditor.tsx
git commit -m "feat(i2v): empty-state placeholder explains optional prompt"
```

---

## Phase 6 — Empty prompt support per video provider

**Goal:** The Generate path can now fire with `prompt = ""`. Each provider adapter must handle this without crashing the request. Per the spec §6: Wan 2.2, Veo, Sora, and Luma natively accept empty prompts; Kling and Runway require non-empty and need adapter-side substitution.

### Task 6.1: Provider adapter map (already discovered)

The provider adapters in this repo:

| Provider | Adapter file                                                                                 |
| -------- | -------------------------------------------------------------------------------------------- |
| Kling    | `server/src/services/video-generation/providers/klingProvider.ts`                            |
| Luma     | `server/src/services/video-generation/providers/lumaProvider.ts`                             |
| Sora     | `server/src/services/video-generation/providers/soraProvider.ts`                             |
| Veo      | `server/src/services/video-generation/providers/veoProvider.ts`                              |
| Wan 2.2  | `server/src/services/video-generation/providers/replicateProvider.ts` (routed via Replicate) |
| Runway   | `server/src/services/video-generation/providers/replicateProvider.ts` (routed via Replicate) |

> **Note:** Wan and Runway both go through `replicateProvider.ts` rather than having their own files. Per-provider empty-prompt handling inside that file may need to branch on the model identifier.

- [ ] **Step 1: Confirm the provider list**

```bash
ls server/src/services/video-generation/providers/
```

Expected: matches the table above. If any new providers exist (added since this plan was written), apply the same Phase-6 treatment to them.

### Task 6.2: Write a failing integration test asserting empty-prompt acceptance

**Files:**

- Create: `tests/integration/video-generation-empty-prompt.integration.test.ts`

- [ ] **Step 1: Write the test**

Create `tests/integration/video-generation-empty-prompt.integration.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { buildVideoGenerationService } from "@server/services/video-generation/buildVideoGenerationService";
// Adjust the import to match the actual factory used by the DI container.

interface MockProviderClient {
  generate: ReturnType<typeof vi.fn>;
}

const buildMockClient = (): MockProviderClient => ({
  generate: vi.fn().mockResolvedValue({
    success: true,
    videoUrl: "https://example/video.mp4",
  }),
});

describe("video-generation empty-prompt support", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const providers: Array<{ id: string; expectsSubstitution: boolean }> = [
    { id: "wan", expectsSubstitution: false },
    { id: "veo", expectsSubstitution: false },
    { id: "sora", expectsSubstitution: false },
    { id: "luma", expectsSubstitution: false },
    { id: "kling", expectsSubstitution: true },
    { id: "runway", expectsSubstitution: true },
  ];

  for (const provider of providers) {
    it(`accepts empty prompt with start image for provider=${provider.id}`, async () => {
      const mockClient = buildMockClient();
      const service = buildVideoGenerationService({
        providers: { [provider.id]: mockClient },
      });

      await service.generate({
        provider: provider.id,
        prompt: "",
        startImage: "https://example/start.png",
      });

      expect(mockClient.generate).toHaveBeenCalledTimes(1);
      const sentPrompt = mockClient.generate.mock.calls[0][0].prompt;
      if (provider.expectsSubstitution) {
        expect(sentPrompt.trim().length).toBeGreaterThan(0);
      } else {
        expect(sentPrompt).toBe("");
      }
    });
  }
});
```

> **Note:** The exact factory and method shape (`buildVideoGenerationService`, `service.generate`, mock client interface) need to be aligned with the actual codebase. After Step 2 below, adjust the test to match the real public API of the video-generation module.

- [ ] **Step 2: Inspect the real video-generation API**

```bash
git ls-files server/src/services/video-generation/ | head
```

Read the main entry-point file (likely `index.ts` or `VideoGenerationService.ts`). Adjust the test from Step 1 to match the real public methods, factory function, and types.

- [ ] **Step 3: Run the test (it should fail)**

Run: `PORT=0 npx vitest run tests/integration/video-generation-empty-prompt.integration.test.ts --config config/test/vitest.integration.config.js`
Expected: FAILS — either with "function not defined" type errors or with "Kling adapter rejected empty prompt" runtime errors.

- [ ] **Step 4: Commit**

```bash
git add tests/integration/video-generation-empty-prompt.integration.test.ts
git commit -m "test(video-generation): assert empty-prompt acceptance per provider"
```

### Task 6.3: Add empty-prompt substitution to Kling adapter

**Files:**

- Modify: the Kling provider adapter file (located in Task 6.1)

- [ ] **Step 1: Open the Kling adapter and locate the request builder**

The adapter constructs the outbound request to the Kling API. Find the function that maps internal request → Kling API payload.

- [ ] **Step 2: Substitute empty prompts**

At the top of the request builder, add:

```ts
const KLING_EMPTY_PROMPT_SUBSTITUTE = "natural motion";

const effectivePrompt =
  prompt.trim().length > 0 ? prompt : KLING_EMPTY_PROMPT_SUBSTITUTE;
```

Use `effectivePrompt` everywhere the original `prompt` was placed into the outbound payload.

- [ ] **Step 3: Run the integration test**

Run: `PORT=0 npx vitest run tests/integration/video-generation-empty-prompt.integration.test.ts -t "kling" --config config/test/vitest.integration.config.js`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add server/src/services/video-generation/providers/klingProvider.ts
git commit -m "feat(kling-adapter): substitute placeholder for empty prompt"
```

### Task 6.4: Add empty-prompt substitution to Runway path in replicateProvider

**Files:**

- Modify: `server/src/services/video-generation/providers/replicateProvider.ts`

- [ ] **Step 1: Open replicateProvider.ts and locate the Runway branch**

Read the file. Runway is one of the model identifiers routed through this adapter — search for `runway` (case-insensitive) inside the file to find the relevant branch in the request builder. There may be a single shared request-build path, or per-model branches.

- [ ] **Step 2: Substitute empty prompts**

```ts
const RUNWAY_EMPTY_PROMPT_SUBSTITUTE = "subtle ambient motion";

const effectivePrompt =
  prompt.trim().length > 0 ? prompt : RUNWAY_EMPTY_PROMPT_SUBSTITUTE;
```

- [ ] **Step 3: Run the integration test**

Run: `PORT=0 npx vitest run tests/integration/video-generation-empty-prompt.integration.test.ts -t "runway" --config config/test/vitest.integration.config.js`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add server/src/services/video-generation/providers/replicateProvider.ts
git commit -m "feat(runway-adapter): substitute placeholder for empty prompt"
```

### Task 6.5: Verify native-empty-prompt providers (Wan, Veo, Sora, Luma)

**Files:**

- Read-only: each provider adapter

- [ ] **Step 1: Run the full test for the four providers**

Run: `PORT=0 npx vitest run tests/integration/video-generation-empty-prompt.integration.test.ts -t "wan|veo|sora|luma" --config config/test/vitest.integration.config.js`
Expected: PASS for all four. If any fails, treat that adapter the same way as Kling/Runway — add a substitution.

- [ ] **Step 2: Commit (no-op or substitution depending on Step 1)**

If any substitutions were needed:

```bash
git add server/src/services/video-generation/
git commit -m "feat(video-adapters): substitute placeholder where provider rejects empty prompt"
```

Otherwise no commit.

### Task 6.6: Validate the route-level guard

**Files:**

- Read-only: the route handler that consumes the preview schema

- [ ] **Step 1: Verify the route rejects empty-prompt with no startImage**

Read `server/src/routes/preview/handlers/videoGenerate.ts` (registered as `POST /preview/video/generate` in `server/src/routes/preview.routes.ts:82`, mounted under `/api/`). Ensure the schema refinement from Task 2.2 is the source of truth — there should be no separate `if (!prompt) return 400` check that contradicts.

- [ ] **Step 2: Add a route-level integration test**

Create `tests/integration/video-preview-empty-prompt-route.integration.test.ts` (or extend an existing route test):

```ts
import { describe, it, expect } from "vitest";
import request from "supertest";
import { buildApp } from "@server/buildApp";
// adjust import as needed

describe("POST video preview — empty prompt", () => {
  const app = buildApp({
    /* test deps */
  });

  it("rejects empty prompt without startImage", async () => {
    const res = await request(app)
      .post("/api/preview/video/generate")
      .set("Authorization", "Bearer test-token")
      .send({ prompt: "", model: "wan-2.2" });
    expect(res.status).toBe(400);
  });

  it("accepts empty prompt with startImage", async () => {
    const res = await request(app)
      .post("/api/preview/video/generate")
      .set("Authorization", "Bearer test-token")
      .send({
        prompt: "",
        model: "wan-2.2",
        startImage: "https://example/start.png",
      });
    expect(res.status).not.toBe(400);
  });
});
```

> **Note:** The auth wiring and the exact `buildApp` shape need adjusting per project conventions; consult `tests/integration/bootstrap.integration.test.ts` for the canonical test scaffolding.

- [ ] **Step 3: Run the test**

Run: `PORT=0 npx vitest run tests/integration/video-preview-empty-prompt-route.integration.test.ts --config config/test/vitest.integration.config.js`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add tests/integration/video-preview-empty-prompt-route.integration.test.ts
git commit -m "test(preview): assert empty-prompt route guard requires startImage"
```

---

## Phase 7 — Motion Ideas server

**Goal:** Build `MotionIdeaService`, the new `/api/i2v/motion-ideas` route, the prompt template, and DI registration. The service is a thin orchestrator over `ImageObservationService` plus an LLM pass.

### Task 7.1: Define the `MotionIdeaService` interface and types

**Files:**

- Create: `server/src/services/i2v-motion-ideas/types.ts`

- [ ] **Step 1: Write the types**

```ts
import type { ImageObservation } from "@services/image-observation/types";

export interface MotionIdeaRequest {
  /** Image URL, GCS signed URL, or base64 data URI. */
  image: string;
  /** Optional fast-path hint: prompt that produced this image. */
  sourcePrompt?: string;
  /** Optional pre-resolved observation; bypasses the observation step. */
  observation?: ImageObservation;
  /** Optional: bypass the observation cache. */
  skipCache?: boolean;
  /** Optional: set higher for the "New ideas" re-roll. */
  temperature?: number;
}

export interface MotionIdeaResponse {
  /** 3 to 5 short motion phrases tailored to the image. */
  ideas: string[];
  /** Was the observation cached? */
  observationCached: boolean;
  /** Did the observation use the source-prompt fast path? */
  observationUsedFastPath: boolean;
  /** Total time in ms for observation + LLM. */
  durationMs: number;
}

export const MOTION_IDEAS_FALLBACK: readonly string[] = Object.freeze([
  "subtle natural movement",
  "gentle ambient motion",
  "slow camera push",
]);
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add server/src/services/i2v-motion-ideas/types.ts
git commit -m "feat(motion-ideas): types for MotionIdeaService"
```

### Task 7.2: Write the prompt template

**Files:**

- Create: `server/src/services/i2v-motion-ideas/templates/motion-ideas-prompt.md`

- [ ] **Step 1: Author the template**

````markdown
You are helping a video creator add motion to a still image. Given the image observation below, return 3 to 5 short, concrete motion phrases that suit the image. Each phrase should be 2-6 words and read like prompt vocabulary, not a sentence.

Constraints:

- Do NOT describe the image's visual content (subject, lighting, environment, color, framing). The image already controls those.
- ONLY suggest motion: subject actions, gestures, expressions, ambient/environmental motion, camera moves, or pacing.
- Avoid risky moves listed under `motion.risky`.
- Prefer recommended moves listed under `motion.recommended`.
- Output JSON only: `{ "ideas": ["phrase 1", "phrase 2", ...] }` — no markdown, no commentary.

Image observation:

```json
{{observation}}
```
````

Output strict JSON now.

````

- [ ] **Step 2: Commit**

```bash
git add server/src/services/i2v-motion-ideas/templates/motion-ideas-prompt.md
git commit -m "feat(motion-ideas): prompt template"
````

### Task 7.3: Write a failing test for `MotionIdeaService`

**Files:**

- Create: `server/src/services/i2v-motion-ideas/__tests__/MotionIdeaService.test.ts`

- [ ] **Step 1: Write the test**

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MotionIdeaService } from "../MotionIdeaService";
import type { ImageObservation } from "@services/image-observation/types";

const makeObservation = (): ImageObservation => ({
  imageHash: "abc",
  observedAt: new Date(),
  subject: {
    type: "person",
    description: "woman in golden light",
    position: "center",
    confidence: 0.9,
  },
  framing: { shotType: "close-up", angle: "eye-level", confidence: 0.9 },
  lighting: { quality: "natural", timeOfDay: "golden-hour", confidence: 0.9 },
  motion: {
    recommended: ["subtle drift", "slow push-in"],
    risky: ["extreme zoom"],
  },
  confidence: 0.9,
});

describe("MotionIdeaService", () => {
  const mockObservation = {
    observe: vi.fn(),
  };
  const mockAi = {
    execute: vi.fn(),
  };

  beforeEach(() => {
    mockObservation.observe.mockReset();
    mockAi.execute.mockReset();
  });

  it("returns 3-5 ideas from a successful LLM response", async () => {
    mockObservation.observe.mockResolvedValue({
      success: true,
      observation: makeObservation(),
      cached: false,
      usedFastPath: false,
      durationMs: 100,
    });
    mockAi.execute.mockResolvedValue({
      text: JSON.stringify({
        ideas: [
          "hair drifts in the breeze",
          "subtle blink and breath",
          "slow push-in",
          "soft lens flicker",
        ],
      }),
    });

    const service = new MotionIdeaService(
      mockAi as never,
      mockObservation as never,
    );
    const result = await service.generate({ image: "https://example/img.png" });

    expect(result.ideas).toHaveLength(4);
    expect(result.ideas[0]).toBe("hair drifts in the breeze");
    expect(result.observationCached).toBe(false);
  });

  it("uses caller-supplied observation without calling observe()", async () => {
    mockAi.execute.mockResolvedValue({
      text: JSON.stringify({ ideas: ["a", "b", "c"] }),
    });

    const service = new MotionIdeaService(
      mockAi as never,
      mockObservation as never,
    );
    await service.generate({
      image: "https://example/img.png",
      observation: makeObservation(),
    });

    expect(mockObservation.observe).not.toHaveBeenCalled();
  });

  it("returns fallback ideas when the LLM returns invalid JSON", async () => {
    mockObservation.observe.mockResolvedValue({
      success: true,
      observation: makeObservation(),
      cached: false,
      usedFastPath: false,
      durationMs: 100,
    });
    mockAi.execute.mockResolvedValue({ text: "not json" });

    const service = new MotionIdeaService(
      mockAi as never,
      mockObservation as never,
    );
    const result = await service.generate({ image: "https://example/img.png" });

    expect(result.ideas).toEqual([
      "subtle natural movement",
      "gentle ambient motion",
      "slow camera push",
    ]);
  });

  it("returns fallback ideas when observation fails", async () => {
    mockObservation.observe.mockRejectedValue(new Error("vision unavailable"));

    const service = new MotionIdeaService(
      mockAi as never,
      mockObservation as never,
    );
    const result = await service.generate({ image: "https://example/img.png" });

    expect(result.ideas).toEqual([
      "subtle natural movement",
      "gentle ambient motion",
      "slow camera push",
    ]);
  });

  it("clamps the LLM output to at most 5 ideas", async () => {
    mockObservation.observe.mockResolvedValue({
      success: true,
      observation: makeObservation(),
      cached: false,
      usedFastPath: false,
      durationMs: 100,
    });
    mockAi.execute.mockResolvedValue({
      text: JSON.stringify({
        ideas: ["a", "b", "c", "d", "e", "f", "g"],
      }),
    });

    const service = new MotionIdeaService(
      mockAi as never,
      mockObservation as never,
    );
    const result = await service.generate({ image: "https://example/img.png" });

    expect(result.ideas).toHaveLength(5);
  });
});
```

- [ ] **Step 2: Run the test (it should fail)**

Run: `npx vitest run server/src/services/i2v-motion-ideas/__tests__/MotionIdeaService.test.ts --config config/test/vitest.unit.config.js`
Expected: FAIL — "Cannot find module '../MotionIdeaService'".

- [ ] **Step 3: Commit (test only)**

```bash
git add server/src/services/i2v-motion-ideas/__tests__/MotionIdeaService.test.ts
git commit -m "test(motion-ideas): unit tests for MotionIdeaService"
```

### Task 7.4: Implement `MotionIdeaService`

**Files:**

- Create: `server/src/services/i2v-motion-ideas/MotionIdeaService.ts`

- [ ] **Step 1: Write the service**

````ts
import { promises as fs } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { z } from "zod";
import { logger } from "@infrastructure/Logger";
import type { AIExecutionPort as AIService } from "@services/ai-model/ports/AIExecutionPort";
import type { ImageObservationService } from "@services/image-observation/ImageObservationService";
import type { MotionIdeaRequest, MotionIdeaResponse } from "./types";
import { MOTION_IDEAS_FALLBACK } from "./types";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const TEMPLATE_PATH = join(__dirname, "templates", "motion-ideas-prompt.md");

const MAX_IDEAS = 5;
const MIN_IDEAS = 3;

const ResponseSchema = z.object({
  ideas: z.array(z.string()).min(1),
});

export class MotionIdeaService {
  private static cachedTemplate: string | null = null;
  private readonly ai: AIService;
  private readonly observationService: ImageObservationService;
  private readonly log = logger.child({ service: "MotionIdeaService" });

  constructor(ai: AIService, observationService: ImageObservationService) {
    this.ai = ai;
    this.observationService = observationService;
  }

  async generate(request: MotionIdeaRequest): Promise<MotionIdeaResponse> {
    const startedAt = performance.now();

    let observation = request.observation ?? null;
    let observationCached = false;
    let observationUsedFastPath = false;

    if (!observation) {
      try {
        const observeResult = await this.observationService.observe({
          image: request.image,
          ...(request.sourcePrompt
            ? { sourcePrompt: request.sourcePrompt }
            : {}),
          ...(request.skipCache !== undefined
            ? { skipCache: request.skipCache }
            : {}),
        });
        if (!observeResult.success || !observeResult.observation) {
          return this.fallback(startedAt);
        }
        observation = observeResult.observation;
        observationCached = observeResult.cached;
        observationUsedFastPath = observeResult.usedFastPath;
      } catch (error) {
        this.log.warn("Image observation failed; returning fallback ideas", {
          error: error instanceof Error ? error.message : String(error),
        });
        return this.fallback(startedAt);
      }
    }

    const template = await this.loadTemplate();
    const systemPrompt = template.replace(
      "{{observation}}",
      JSON.stringify(observation, null, 2),
    );

    try {
      const response = await this.ai.execute("i2v_motion_ideas", {
        systemPrompt,
        userMessage: "Generate motion ideas now.",
        maxTokens: 200,
        temperature:
          typeof request.temperature === "number" ? request.temperature : 0.4,
        jsonMode: true,
      });

      const ideas = this.parseAndClamp(response.text);
      if (ideas.length === 0) {
        return this.fallback(
          startedAt,
          observationCached,
          observationUsedFastPath,
        );
      }

      return {
        ideas,
        observationCached,
        observationUsedFastPath,
        durationMs: Math.round(performance.now() - startedAt),
      };
    } catch (error) {
      this.log.warn("Motion-idea LLM pass failed; returning fallback", {
        error: error instanceof Error ? error.message : String(error),
      });
      return this.fallback(
        startedAt,
        observationCached,
        observationUsedFastPath,
      );
    }
  }

  private parseAndClamp(text: string): string[] {
    const cleaned = text
      .replace(/```json\s*/g, "")
      .replace(/```\s*/g, "")
      .trim();
    let parsed: unknown;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      return [];
    }
    const validated = ResponseSchema.safeParse(parsed);
    if (!validated.success) return [];

    const ideas = validated.data.ideas
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    if (ideas.length < MIN_IDEAS) return [];
    return ideas.slice(0, MAX_IDEAS);
  }

  private async loadTemplate(): Promise<string> {
    if (MotionIdeaService.cachedTemplate) {
      return MotionIdeaService.cachedTemplate;
    }
    const content = await fs.readFile(TEMPLATE_PATH, "utf-8");
    MotionIdeaService.cachedTemplate = content;
    return content;
  }

  private fallback(
    startedAt: number,
    observationCached = false,
    observationUsedFastPath = false,
  ): MotionIdeaResponse {
    return {
      ideas: [...MOTION_IDEAS_FALLBACK],
      observationCached,
      observationUsedFastPath,
      durationMs: Math.round(performance.now() - startedAt),
    };
  }
}
````

- [ ] **Step 2: Run the test (it should pass)**

Run: `npx vitest run server/src/services/i2v-motion-ideas/__tests__/MotionIdeaService.test.ts --config config/test/vitest.unit.config.js`
Expected: PASS for all five test cases.

- [ ] **Step 3: Type-check + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add server/src/services/i2v-motion-ideas/MotionIdeaService.ts
git commit -m "feat(motion-ideas): MotionIdeaService implementation"
```

### Task 7.5: Register `i2v_motion_ideas` AI execution config

**Files:**

- Modify: `server/src/config/modelConfig.ts`

- [ ] **Step 1: Add the new config block**

Insert near `image_observation` (around line 458) — same shape:

```ts
/**
 * Generate motion idea phrases from an image observation (I2V)
 */
i2v_motion_ideas: {
  client: process.env.MOTION_IDEAS_PROVIDER || "groq",
  model: process.env.MOTION_IDEAS_MODEL || "llama-3.3-70b-versatile",
  temperature: 0.4,
  maxTokens: 200,
  timeout: 15000,
  responseFormat: "json_object",
  useSeed: false,
},
```

> **Note on model choice:** Groq's Llama 3.3 70B handles short JSON outputs quickly and cheaply, which fits the Motion Ideas use case. If the codebase has a preference for a different fast JSON model (check what's used for `role_classification` or other short-output executions), match that instead.

- [ ] **Step 3: Type-check + run the unit tests**

Run: `npx tsc --noEmit && npx vitest run server/src/services/ai-model server/src/services/i2v-motion-ideas --config config/test/vitest.unit.config.js`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(aiService): register i2v_motion_ideas execution"
```

### Task 7.6: Add the `/api/i2v/motion-ideas` route

**Files:**

- Create: `server/src/routes/i2v/motionIdeas.routes.ts`
- Modify: the route registration central file (likely `server/src/routes/index.ts` or `server/src/app.ts`)

- [ ] **Step 1: Write the route**

```ts
import type { Router } from "express";
import { z } from "zod";
import { logger } from "@infrastructure/Logger";
import { asyncHandler } from "@middleware/asyncHandler";
import { validateRequest } from "@middleware/validateRequest";
import type { MotionIdeaService } from "@services/i2v-motion-ideas/MotionIdeaService";

const requestSchema = z.object({
  image: z.string().min(1),
  sourcePrompt: z.string().optional(),
  skipCache: z.boolean().optional(),
  temperature: z.number().min(0).max(2).optional(),
});

interface Deps {
  motionIdeas: MotionIdeaService;
}

export function registerMotionIdeasRoute(
  router: Router,
  { motionIdeas }: Deps,
): void {
  router.post(
    "/i2v/motion-ideas",
    validateRequest(requestSchema),
    asyncHandler(async (req, res) => {
      const startTime = Date.now();
      const requestId = req.id || "unknown";
      const log = logger.child({ route: "/i2v/motion-ideas", requestId });

      log.info("motion-ideas request received");

      const result = await motionIdeas.generate(req.body);

      log.info("motion-ideas request completed", {
        durationMs: Date.now() - startTime,
        ideaCount: result.ideas.length,
        observationCached: result.observationCached,
      });

      res.json({
        success: true,
        ideas: result.ideas,
        observationCached: result.observationCached,
        observationUsedFastPath: result.observationUsedFastPath,
        durationMs: result.durationMs,
      });
    }),
  );
}
```

- [ ] **Step 2: Wire into the router registration**

Find where other I2V-or-image routes are registered (e.g., `image/observe`). Add a call to `registerMotionIdeasRoute(router, { motionIdeas: container.resolve("motionIdeaService") })` (adjust to match the actual DI resolution pattern).

- [ ] **Step 3: Smoke-test via curl in dev (manual; skip in worktree)**

In the main checkout, start the dev server and:

```bash
curl -X POST http://localhost:3001/api/i2v/motion-ideas \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <test-token>" \
  -d '{"image":"https://example/test.png"}'
```

Expected: 200 with an `ideas` array.

- [ ] **Step 4: Type-check + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add server/src/routes/i2v/motionIdeas.routes.ts
# also any registration-site file
git commit -m "feat(motion-ideas): POST /api/i2v/motion-ideas route"
```

### Task 7.7: DI registration

**Files:**

- Create: `server/src/config/services/i2v.services.ts`
- Modify: `server/src/config/services.config.ts`

- [ ] **Step 1: Inspect the existing DI pattern**

Read `server/src/config/services/llm.services.ts` to confirm the canonical shape:

```ts
import type { DIContainer } from "@infrastructure/DIContainer";

export function registerXxxServices(container: DIContainer): void {
  container.register(
    "tokenName",
    (depA: TypeA, depB: TypeB) => new MyService(depA, depB),
    ["tokenForDepA", "tokenForDepB"],
  );
}
```

`DIContainer.register(token, factory, dependencies[])` — the third array lists DI tokens whose resolved instances are passed positionally into the factory.

- [ ] **Step 2: Write the new registration**

Create `server/src/config/services/i2v.services.ts`:

```ts
import type { DIContainer } from "@infrastructure/DIContainer";
import type { AIExecutionPort } from "@services/ai-model/ports/AIExecutionPort";
import type { ImageObservationService } from "@services/image-observation/ImageObservationService";
import { MotionIdeaService } from "@services/i2v-motion-ideas/MotionIdeaService";

export function registerI2VServices(container: DIContainer): void {
  container.register(
    "motionIdeaService",
    (ai: AIExecutionPort, observation: ImageObservationService) =>
      new MotionIdeaService(ai, observation),
    ["aiService", "imageObservationService"],
  );
}
```

> **Note:** Confirm the actual DI tokens by reading `core.services.ts` (registers image observation) and `llm.services.ts` (registers AI service). The token names used here (`aiService`, `imageObservationService`) match the patterns observed in those files but should be verified.

- [ ] **Step 3: Wire into the central DI config**

In `server/src/config/services.config.ts`, import `registerI2VServices` and call it alongside the other domain registrations (after `registerCoreServices` and `registerLLMServices`, since those provide the dependencies).

- [ ] **Step 4: Run the integration test gate**

Run: `PORT=0 npx vitest run tests/integration/bootstrap.integration.test.ts tests/integration/di-container.integration.test.ts --config config/test/vitest.integration.config.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/src/config/services/i2v.services.ts \
        server/src/config/services.config.ts
git commit -m "feat(di): register MotionIdeaService"
```

### Task 7.8: Phase-7 verification

- [ ] **Step 1: Type check**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: clean.

- [ ] **Step 3: Unit tests**

Run: `npm run test:unit`
Expected: pass.

- [ ] **Step 4: Integration test gate**

Run: `PORT=0 npx vitest run tests/integration --config config/test/vitest.integration.config.js`
Expected: pass.

---

## Phase 8 — Motion Ideas client

**Goal:** Build the client-side `MotionIdeasPanel` component, the `useMotionIdeas` hook, and the `getMotionIdeas` API client. Mount the panel in `PromptOptimizerWorkspace` conditionally on `isI2VMode`.

### Task 8.1: API client — `getMotionIdeas`

**Files:**

- Modify: `client/src/features/prompt-optimizer/api/i2vApi.ts`

- [ ] **Step 1: Add the request and response types**

Append to `client/src/features/prompt-optimizer/api/i2vApi.ts`:

```ts
export interface GetMotionIdeasRequest {
  image: string;
  sourcePrompt?: string;
  skipCache?: boolean;
  temperature?: number;
}

export interface GetMotionIdeasResponse {
  success: boolean;
  ideas: string[];
  observationCached: boolean;
  observationUsedFastPath: boolean;
  durationMs: number;
}

const GetMotionIdeasResponseSchema = z
  .object({
    success: z.boolean(),
    ideas: z.array(z.string()),
    observationCached: z.boolean(),
    observationUsedFastPath: z.boolean(),
    durationMs: z.number(),
  })
  .passthrough();

export async function getMotionIdeas(
  payload: GetMotionIdeasRequest,
  options: ImageObservationFetchOptions = {},
): Promise<GetMotionIdeasResponse> {
  const fetchFn =
    options.fetchImpl || (typeof fetch !== "undefined" ? fetch : undefined);
  if (!fetchFn) throw new Error("Fetch is not available in this environment.");

  const authHeaders = await buildFirebaseAuthHeaders();
  const response = await fetchFn("/api/i2v/motion-ideas", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders,
    },
    body: JSON.stringify(payload),
    ...(options.signal ? { signal: options.signal } : {}),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch motion ideas: ${response.status}`);
  }

  const responsePayload = (await response.json()) as unknown;
  return GetMotionIdeasResponseSchema.parse(
    responsePayload,
  ) as GetMotionIdeasResponse;
}
```

Update the bottom export:

```ts
export const i2vApi = {
  observeImage,
  getMotionIdeas,
};
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add client/src/features/prompt-optimizer/api/i2vApi.ts
git commit -m "feat(motion-ideas): client API for getMotionIdeas"
```

### Task 8.2: Hook — `useMotionIdeas`

**Files:**

- Create: `client/src/features/prompt-optimizer/hooks/useMotionIdeas.ts`

- [ ] **Step 1: Write the hook**

```ts
import { useCallback, useEffect, useRef, useState } from "react";
import { getMotionIdeas } from "../api/i2vApi";

export interface UseMotionIdeasParams {
  isI2VMode: boolean;
  startImageUrl: string | null;
  startImageSourcePrompt?: string | null;
}

export interface UseMotionIdeasResult {
  ideas: string[];
  isLoading: boolean;
  error: string | null;
  reroll: () => Promise<void>;
}

const FALLBACK_IDEAS: readonly string[] = Object.freeze([
  "subtle natural movement",
  "gentle ambient motion",
  "slow camera push",
]);

export function useMotionIdeas({
  isI2VMode,
  startImageUrl,
  startImageSourcePrompt,
}: UseMotionIdeasParams): UseMotionIdeasResult {
  const [ideas, setIdeas] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const lastImageRef = useRef<string | null>(null);

  const fetchIdeas = useCallback(
    async (rerollTemperature?: number): Promise<void> => {
      if (!isI2VMode || !startImageUrl) {
        return;
      }
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setIsLoading(true);
      setError(null);

      try {
        const response = await getMotionIdeas(
          {
            image: startImageUrl,
            ...(startImageSourcePrompt
              ? { sourcePrompt: startImageSourcePrompt }
              : {}),
            ...(typeof rerollTemperature === "number"
              ? { temperature: rerollTemperature }
              : {}),
          },
          { signal: controller.signal },
        );
        if (!controller.signal.aborted) {
          setIdeas(response.ideas);
        }
      } catch (err) {
        if (controller.signal.aborted) return;
        const message =
          err instanceof Error ? err.message : "Failed to load motion ideas";
        setError(message);
        setIdeas([...FALLBACK_IDEAS]);
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    },
    [isI2VMode, startImageUrl, startImageSourcePrompt],
  );

  useEffect(() => {
    if (!isI2VMode || !startImageUrl) {
      abortRef.current?.abort();
      lastImageRef.current = null;
      setIdeas([]);
      setError(null);
      setIsLoading(false);
      return;
    }
    const key = `${startImageUrl}|${startImageSourcePrompt ?? ""}`;
    if (lastImageRef.current === key) return;
    lastImageRef.current = key;
    void fetchIdeas();
    return () => {
      abortRef.current?.abort();
    };
  }, [fetchIdeas, isI2VMode, startImageUrl, startImageSourcePrompt]);

  const reroll = useCallback(async () => {
    await fetchIdeas(0.9);
  }, [fetchIdeas]);

  return { ideas, isLoading, error, reroll };
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add client/src/features/prompt-optimizer/hooks/useMotionIdeas.ts
git commit -m "feat(motion-ideas): useMotionIdeas hook"
```

### Task 8.3: Component — `MotionIdeasPanel`

**Files:**

- Create: `client/src/features/prompt-optimizer/components/MotionIdeasPanel.tsx`

- [ ] **Step 1: Write the component**

```tsx
import React from "react";
import { cn } from "@/utils/cn";

export interface MotionIdeasPanelProps {
  ideas: string[];
  isLoading: boolean;
  onChipClick: (idea: string) => void;
  onReroll: () => void;
  className?: string;
}

const SKELETON_COUNT = 3;

export function MotionIdeasPanel({
  ideas,
  isLoading,
  onChipClick,
  onReroll,
  className,
}: MotionIdeasPanelProps): React.ReactElement {
  return (
    <section
      className={cn(
        "border-border bg-surface-1 mt-2 rounded-lg border p-3",
        className,
      )}
      aria-label="Motion ideas for the start image"
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="text-label-sm text-muted font-semibold uppercase tracking-wide">
          Motion ideas
        </span>
        <button
          type="button"
          onClick={onReroll}
          disabled={isLoading}
          className="text-label-xs text-muted hover:text-foreground transition-colors disabled:opacity-50"
          aria-label="Regenerate motion ideas"
        >
          New ideas
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {isLoading
          ? Array.from({ length: SKELETON_COUNT }).map((_, i) => (
              <div
                key={i}
                className="bg-surface-2 h-7 w-32 animate-pulse rounded-full"
                aria-hidden="true"
              />
            ))
          : ideas.map((idea) => (
              <button
                key={idea}
                type="button"
                onClick={() => onChipClick(idea)}
                className="bg-surface-2 hover:bg-surface-3 text-body-sm text-foreground rounded-full px-3 py-1 transition-colors"
                aria-label={`Insert motion phrase: ${idea}`}
              >
                {idea}
              </button>
            ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Type-check + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add client/src/features/prompt-optimizer/components/MotionIdeasPanel.tsx
git commit -m "feat(motion-ideas): MotionIdeasPanel component"
```

### Task 8.4: Wire `MotionIdeasPanel` into the workspace

**Files:**

- Modify: `client/src/features/prompt-optimizer/PromptOptimizerContainer/PromptOptimizerWorkspace.tsx` (or the appropriate child that renders the editor)

- [ ] **Step 1: Locate where the editor is rendered**

Read the workspace file. Find where the prompt input/editor is mounted (likely a `<PromptEditor>` or `<PromptCanvas>` block).

- [ ] **Step 2: Add the panel below the editor when in I2V**

Import the hook and component:

```ts
import { useMotionIdeas } from "@features/prompt-optimizer/hooks/useMotionIdeas";
import { MotionIdeasPanel } from "@features/prompt-optimizer/components/MotionIdeasPanel";
```

Inside the workspace component, after `i2vContext` is in scope:

```tsx
const motionIdeas = useMotionIdeas({
  isI2VMode: i2vContext.isI2VMode,
  startImageUrl: i2vContext.startImageUrl,
  startImageSourcePrompt: i2vContext.startImageSourcePrompt,
});

const handleMotionChipClick = useCallback(
  (idea: string): void => {
    const current = promptOptimizer.inputPrompt ?? "";
    const trimmed = current.trim();
    const next = trimmed.length === 0 ? idea : `${trimmed}, ${idea}`;
    promptOptimizer.setInputPrompt?.(next);
  },
  [promptOptimizer],
);
```

In the JSX, after the editor (and only when `i2vContext.isI2VMode`):

```tsx
{
  i2vContext.isI2VMode && (
    <MotionIdeasPanel
      ideas={motionIdeas.ideas}
      isLoading={motionIdeas.isLoading}
      onChipClick={handleMotionChipClick}
      onReroll={motionIdeas.reroll}
    />
  );
}
```

> **Note on cursor-position insertion:** the spec §3.3 prefers chip insertion at the _cursor position_ rather than the end. The workspace's `setInputPrompt` is a value-replacement setter, not a cursor-aware editor command. For the initial implementation, append-with-comma is acceptable. A follow-up task can wire the panel directly into the editor's command surface for cursor-position insertion. Note this in §8.4-followup below.

- [ ] **Step 3: Type-check + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add client/src/features/prompt-optimizer/PromptOptimizerContainer/PromptOptimizerWorkspace.tsx
git commit -m "feat(motion-ideas): mount MotionIdeasPanel in workspace for I2V"
```

### Task 8.4-followup: cursor-position insertion (deferred / optional)

If a future implementation cycle wants chip insertion at the cursor:

- [ ] Pass an editor ref / command into the panel (or hoist the chip handler into the editor itself)
- [ ] Use the editor's existing command surface (`insertText` style API) instead of `setInputPrompt`
- [ ] Add a unit test covering: empty prompt → insert at start; cursor mid-prompt → insert at cursor

Skip in initial implementation. Track as out-of-scope per spec §8.

### Task 8.5: Make span-clicks no-op in I2V

**Files:**

- Modify: `client/src/features/prompt-optimizer/PromptCanvas/PromptCanvas.tsx`

- [ ] **Step 1: Find the span-click handler**

Read `client/src/features/prompt-optimizer/PromptCanvas/PromptCanvas.tsx`. Search for the click handler that opens the suggestions popover. Likely calls `fetchEnhancementSuggestions` or sets a `selectedSpanId` and triggers a fetch.

- [ ] **Step 2: Early-return on isI2VMode**

At the top of the click handler:

```ts
if (i2vContext?.isI2VMode) {
  return;
}
```

(`i2vContext` is already in scope from the props.)

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add client/src/features/prompt-optimizer/PromptCanvas/PromptCanvas.tsx
git commit -m "feat(i2v): no-op span clicks when start image is set"
```

### Task 8.6: Phase-8 verification

- [ ] **Step 1: Type check**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: clean.

- [ ] **Step 3: Unit tests**

Run: `npm run test:unit`
Expected: pass.

- [ ] **Step 4: Manual smoke test (skip if worktree)**

Start dev server. Set a start image. Verify:

- Motion Ideas panel appears below the editor
- 3-5 chips render after a brief loading state
- Clicking a chip appends its text to the prompt
- "New ideas" button regenerates chips
- Span clicks in the editor do nothing
- Enhance button is hidden
- Generate button is enabled even with empty prompt

In a worktree, defer the manual smoke test to the main checkout.

---

## Phase 9 — Final verification & polish

### Task 9.1: Repo-wide residue scan

- [ ] **Step 1: Confirm zero residue**

```bash
git grep -nE "I2VMotionStrategy|I2VConstrainedSuggestions|runI2vFlow|i2vFlow|parse_i2v_prompt|deriveLockMap|LockableCategory|ConstraintModeSelector|useCanvasI2V|setConstraintMode|i2vMotionAlternatives" .
```

Expected: zero matches outside the deleted spec/plan docs and the design spec itself (which references these for historical context).

If matches in tests, delete those tests (the behavior they test is gone).

If matches anywhere else, address them.

### Task 9.2: Full validation suite

- [ ] **Step 1: Type check**

Run: `npx tsc --noEmit`
Expected: zero errors.

- [ ] **Step 2: Lint everything**

Run: `npm run lint:all`
Expected: zero errors.

- [ ] **Step 3: Unit tests**

Run: `npm run test:unit`
Expected: all pass.

- [ ] **Step 4: Integration tests**

Run: `npx vitest run tests/integration --config config/test/vitest.integration.config.js`
Expected: pass.

- [ ] **Step 5: Build**

Run: `npm run build`
Expected: succeeds.

- [ ] **Step 6: E2E (skip if worktree)**

Run: `npm run test:e2e`
Expected: pass. In a worktree, defer to the main checkout per CLAUDE.md.

### Task 9.3: Update CLAUDE.md feature-flag table if needed

The spec doesn't add or remove any feature flags, but verify `server/src/config/feature-flags.ts` is unchanged. If it was edited, run:

- [ ] `npx tsx scripts/generate-flag-docs.ts --write` to regenerate the table in `CLAUDE.md`

### Task 9.4: Final commit and PR

- [ ] **Step 1: Verify branch state**

```bash
git status
git log --oneline main..HEAD
```

The log should show a clean sequence of phase-by-phase commits. No half-finished commits, no skipped phases.

- [ ] **Step 2: Open the PR(s)**

Per the spec §10, this is best landed as multiple PRs (one per phase) rather than a single mega-PR. If a phase exceeds the project's ~10-files-per-commit guideline, split tasks into smaller commits within that phase. The deletion-heavy phases (1, 3) may need explicit notes in commit messages: "Mechanical deletion; see plan §X."

---

## Summary

**Phases 1–3** delete the entire I2V mode/lock subsystem (server + shared + client). **Phases 4–5** wire the I2V hide/show logic for the Enhance button and the empty-prompt allowance for the Generate button. **Phase 6** ensures every video provider can accept empty prompts (with adapter-side substitution where required). **Phases 7–8** build the new Motion Ideas surface end-to-end. **Phase 9** verifies and lands.

Each phase ends with type-check, lint, unit tests, and (where relevant) the integration test gate. Each task within a phase is one small commit.
