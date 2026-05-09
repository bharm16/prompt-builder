# I2V Pipeline Simplification — Design Spec

**Date:** 2026-05-09
**Owner:** Prompt-pipeline pod
**Estimate:** ~1–2 sprints (server deletions, client surface swap, new Motion Ideas component)
**Branch:** off `main`
**Feature flag:** none (this is a one-shot replacement; old surfaces are deleted in the same PR series)

---

## 0. Why

The current I2V pipeline encodes a model-side fiction: that the user can dial how strictly the start image governs visual properties of the output via a three-way "constraint mode" (`strict | flexible | transform`). In practice, modern I2V video providers (Wan 2.2, Kling, Veo, Runway Gen-3, Sora) all anchor visual properties to the start image regardless of what the prompt says. The mode dial does not change what the model does — it only changes what _we_ do to the user's prompt before sending it.

The result is a pipeline whose behavior the user cannot predict:

- A "Strict" optimization pays for an LLM call to split motion vs visual, then discards the visual half.
- "Transform" mode is barely I2V at all — it pass-throughs the prompt and treats the image as a stylistic seed.
- Span-click suggestions are filtered or blocked by a `LockMap` that's re-derived twice (once client-side for UI, once server-side for optimization), with category mappings that quietly discard or substitute the user's words.
- Conflict detection is brittle substring matching (`"woman".includes("man")` returns false conflicts on "woman near a man").
- The constraint mode UI is buried in a kebab menu and a 10px badge, despite dictating whether the user's typed words survive optimization.
- A _separate_ camera-motion-ID control adds another implicit hard lock on top of the mode dial.

The user's mental model of I2V is straightforward: **the image fixes visuals; the prompt drives motion.** This spec collapses the pipeline to match that mental model, deletes the entire mode/lock subsystem, and replaces span-click suggestions in I2V with a single image-aware "Motion Ideas" surface.

## 1. Locked architectural decisions

| Decision                                  | Choice                                                                   | Reason                                                                                                                                                        |
| ----------------------------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Constraint modes                          | **Removed.** I2V has no modes.                                           | "Mode" doesn't change model behavior, only client-side text rewriting. Removes a control that doesn't map to an output difference.                            |
| Conflict detection / rewriting            | **Removed.** Trust the model.                                            | All current providers anchor visuals to the image regardless of prompt. Detection is brittle and silent rewriting destroys user trust.                        |
| Optimize button in I2V                    | **Hidden** when `isI2VMode` is true.                                     | Optimize is a text-rewriting helper. With image-anchored visuals, motion-aware rewriting added inconsistent value and the user couldn't predict its behavior. |
| Generate button with empty prompt + image | **Allowed.**                                                             | Image alone is a valid I2V input. Each video provider's empty-prompt support is verified per-provider in §6.                                                  |
| Span-click suggestions in I2V             | **Disabled.** Span clicks are a no-op (or focus the Motion Ideas panel). | Visual edits don't change output (broken feature). Motion-word swapping is too marginal to justify the complexity of a scoped click model.                    |
| Span highlighting in I2V                  | **Kept visible.**                                                        | Highlighting is structural information, independent of click behavior. Editor reads identically across T2V and I2V.                                           |
| Motion Ideas panel                        | **New surface.** Image-aware motion phrases as clickable chips.          | Replaces the gating role of image observation with a help-the-user role. Solves empty-prompt anxiety and motion-vocabulary discovery.                         |
| Camera-motion ID control                  | **Independent feature, unchanged.**                                      | This is a model-specific camera preset (Kling/Veo presets), not an I2V lock. Decoupled from I2V mode entirely.                                                |
| Image observation service                 | **Kept.** Now powers Motion Ideas only.                                  | Vision call cost is justified by visible UX value rather than invisible suggestion gating.                                                                    |
| LockMap deduplication                     | **N/A — deleted entirely** from both client and server.                  | No consumer remains.                                                                                                                                          |

## 2. The contract

When a start image is set on the workspace, the system enters I2V mode. The contract is:

- **The image is the visual anchor.** The video model receives it and uses it to determine subject, framing, lighting, environment, color, and shot type. Nothing the user types or the system does will override this in the output.
- **The prompt is optional motion + intent.** Any text the user types is sent to the model as-is. The system does not parse, classify, conflict-check, or rewrite it.
- **The Motion Ideas panel is the I2V-specific assistance surface.** It surfaces motion phrases tailored to the current start image. Users add motion to their prompt by clicking chips (literal text insertion).
- **Standard editor affordances still work.** Type, select, delete, undo/redo, copy, paste — all unchanged from T2V. Span highlighting renders normally.
- **Empty prompt + image is a valid Generate input.** The model handles it.

Everything below in this spec is in service of that contract.

## 3. UI surface changes

### 3.1 The Optimize button

| State                | Today                                                                                                              | New                 |
| -------------------- | ------------------------------------------------------------------------------------------------------------------ | ------------------- |
| T2V mode             | Visible, enabled when prompt non-empty                                                                             | Unchanged           |
| I2V mode (image set) | Visible, enabled when prompt non-empty; calls `/api/optimize` with `inputMode: "i2v"` and runs `I2VMotionStrategy` | **Hidden entirely** |

The button is gated by `isI2VMode === false`, not by `prompt.length > 0`. When the user removes the start image, the button reappears.

### 3.2 The Generate button

| State                      | Today    | New         |
| -------------------------- | -------- | ----------- |
| T2V mode, empty prompt     | Disabled | Unchanged   |
| T2V mode, non-empty prompt | Enabled  | Unchanged   |
| I2V mode, empty prompt     | Disabled | **Enabled** |
| I2V mode, non-empty prompt | Enabled  | Unchanged   |

The Generate button's enable condition becomes: `(prompt.length > 0) || isI2VMode`.

### 3.3 The Motion Ideas panel (new)

A persistent surface visible whenever `isI2VMode` is true. Renders as an inline section directly below the prompt editor.

**Contents:**

- A header label: _"Motion ideas"_
- 3–5 clickable chips (motion phrases tailored to the current start image)
- A "New ideas" re-roll button (regenerates chips with higher temperature)
- A subtle loading state while observation is in flight

**Chip click behavior:**

- Inserts the chip's text at the current cursor position in the prompt editor
- If no cursor position exists, appends to the end of the prompt with a comma separator
- The chip is **not removed** from the panel after click — user can click multiple chips or click the same one twice
- Insertion is **literal text** — no LLM-mediated merging

**Visibility:**

- Always visible while in I2V mode (not dismissible)
- Auto-hides when start image is removed (i.e., when `isI2VMode` flips to false)

### 3.4 Span clicks in I2V

In I2V mode, clicking a highlighted span in the editor:

- Does not open the suggestions popover
- Does not call `/api/suggestions` or `/api/enhance`
- **Default behavior: silent no-op** (the click handler returns early when `isI2VMode === true`)
- An alternative — focus the Motion Ideas panel on click — is recorded in §8.1 as an open UX choice. Default to silent no-op unless a UX review changes the call.

Span highlighting itself is unchanged — same colors, same labels, same hover affordances. The click handler is the only behavioral difference.

### 3.5 Removed UI elements

- The `ConstraintModeSelector` component (referenced in `client/src/features/prompt-optimizer/components/ConstraintModeSelector.tsx`)
- The kebab-menu mode list inside `PromptCanvasEditorSection`
- The "I2V strict" badge in the editor header
- The conflict warnings popover/inline indicator on visual spans
- The "image is fixed" tooltip on hard-locked spans

## 4. Server changes

### 4.1 Routes

| Route                                        | Today                                                                                                               | New                                                                                                                                                                                                                                     |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /api/optimize`                         | Branches on `inputMode: "t2v" \| "i2v"`; I2V path runs `I2VMotionStrategy` and returns `i2v: I2VOptimizationResult` | **Branch removed.** Always runs T2V optimization. If a client sends `startImage`, the server logs a warning and ignores it. The `inputMode` field is removed from the request and response schemas.                                     |
| `POST /api/suggestions`, `POST /api/enhance` | Both run `I2VConstrainedSuggestions.filter()` when image observation is provided                                    | **Filter removed.** Both run the standard T2V suggestion pipeline regardless of image presence. The `lockMap` and `observation` fields on the request body are removed.                                                                 |
| `POST /api/image/observe`                    | Returns `{subject, framing, lighting, motion}`                                                                      | **Unchanged in shape.** Sole consumer becomes the Motion Ideas panel.                                                                                                                                                                   |
| `POST /api/i2v/motion-ideas` (new)           | —                                                                                                                   | **New route.** Takes `{image, observation?}`, returns `{ideas: string[]}` (3–5 phrases). Internally calls observation if not provided, then runs a small LLM pass that translates the observation into natural-sounding motion phrases. |

The new motion-ideas route is independent of `/api/optimize` and `/api/suggestions`. It runs entirely server-side without coupling to the prompt-optimization service.

**Motion-ideas request body shape** (matches the existing `/api/image/observe` contract for the image field):

```ts
{
  image: string;            // URL, GCS signed URL, or base64 data URI
  sourcePrompt?: string;    // optional; enables the observation fast-path
  observation?: ImageObservation; // optional; skip the observation step entirely
}
```

Response: `{ ideas: string[] }` — 3 to 5 phrases.

### 4.2 Files deleted

```
server/src/services/prompt-optimization/strategies/I2VMotionStrategy.ts
server/src/services/prompt-optimization/strategies/__tests__/I2VMotionStrategy.test.ts
server/src/services/prompt-optimization/workflows/i2vFlow.ts
server/src/services/prompt-optimization/types/i2v.ts
server/src/services/enhancement/services/I2VConstrainedSuggestions.ts
```

Plus all `parse_i2v_prompt` AI execution registration in the `aiService` config.

### 4.3 Files modified

```
server/src/services/prompt-optimization/PromptOptimizationService.ts
  └── remove i2vStrategy field, runI2vFlow import, constraintMode parameter, inputMode branching
server/src/services/prompt-optimization/types.ts
  └── remove I2VOptimizationResult / I2VConstraintMode imports
  └── remove inputMode field from OptimizationResponse
  └── remove constraintMode from OptimizeParams
server/src/services/prompt-optimization/workflows/types.ts
  └── remove I2VStrategyLike, I2VFlowArgs
server/src/routes/optimize/handlers/optimize.ts
  └── remove `i2v: result.i2v` field on response (line 177)
server/src/routes/enhancement/enhancementSuggestionsRoute.ts
  └── remove lockMap/observation request fields and filter call
server/src/services/enhancement/EnhancementService.ts
  └── remove I2VConstrainedSuggestions injection and filter pass
```

### 4.4 Files added

```
server/src/services/i2v-motion-ideas/MotionIdeaService.ts
server/src/services/i2v-motion-ideas/templates/motion-ideas-prompt.md
server/src/routes/i2v/motionIdeas.routes.ts
```

The MotionIdeaService is a thin orchestrator: takes an image (URL or hash), resolves an observation via the existing `ImageObservationService` (cache-friendly), then runs a single LLM call with the observation as input and a templated prompt asking for 3–5 short motion phrases. Returns a string array.

The service is registered via a new `i2v.services.ts` DI registration file, following the existing domain-scoped pattern.

### 4.5 ImageObservationService changes

The service itself is unchanged. Its only consumer is now the new `MotionIdeaService`. The fast-path (parsing observation from `sourcePrompt` heuristics) is **kept** because it remains cheaper than a vision call when the user generated the image from a prompt in this same session.

The cache key issue (today's `sha256(image_url)` invalidates whenever GCS re-signs the URL, even for the same underlying image) is documented in §8.9 as a known follow-up — out of scope for this spec.

## 5. Client changes

### 5.1 Files deleted

```
client/src/features/prompt-optimizer/components/ConstraintModeSelector.tsx
client/src/features/prompt-optimizer/PromptCanvas/hooks/useCanvasI2V.ts
```

### 5.2 Files modified

```
client/src/features/prompt-optimizer/types/i2v.ts
  └── delete: I2VConstraintMode, LockStatus, LockableCategory, LockMap,
              deriveLockMap, ConflictWarning, I2VOptimizationResult
  └── keep: ImageObservation, I2VContext (slimmed — see below)

client/src/features/prompt-optimizer/hooks/useI2VContext.ts
  └── remove constraintMode and setConstraintMode from returned shape
  └── remove cameraMotionLocked → lockMap derivation
  └── return shape becomes: { isI2VMode, startImageUrl, startImageSourcePrompt, observation, isAnalyzing, error, refreshObservation }

client/src/features/prompt-optimizer/PromptCanvas/PromptCanvas.tsx
  └── remove constraint-mode prop drilling
  └── remove showI2VLockIndicator / resolvedI2VReason / i2vMotionAlternatives / handleLockedAlternativeClick wiring

client/src/features/prompt-optimizer/PromptCanvas/components/PromptCanvasEditorSection.tsx
  └── remove "I2V {mode}" badge
  └── remove kebab-menu mode list

client/src/features/prompt-optimizer/PromptOptimizerContainer/PromptOptimizerWorkspace.tsx
  └── stop sending constraintMode in optimize requests
  └── conditionally render <MotionIdeasPanel /> when isI2VMode

client/src/features/prompt-optimizer/PromptOptimizerContainer/hooks/usePromptOptimization.ts
  └── stop branching on isI2VMode (always runs T2V path)

client/src/features/prompt-optimizer/PromptCanvas/components/PromptCanvasSuggestionsPanel.tsx
  └── remove i2vContext-aware blocking branches

client/src/features/prompt-optimizer/api/i2vApi.ts
  └── add: getMotionIdeas(image): Promise<{ideas: string[]}>

client/src/features/generation-controls/context/GenerationControlsStore.tsx
  └── remove ui.constraintMode field, setConstraintMode action, related reducer cases
  └── remove ConstraintMode type import

client/src/features/prompt-optimizer/components/PromptActions.tsx
  └── gate Optimize button visibility on !isI2VMode

client/src/components/ToolSidebar/components/panels/GenerationControlsPanel/components/GenerationFooter.tsx
  └── update Generate button enable condition: (prompt.length > 0) || isI2VMode
```

### 5.3 Files added

```
client/src/features/prompt-optimizer/components/MotionIdeasPanel.tsx
client/src/features/prompt-optimizer/components/MotionIdeasPanel.module.css (or Tailwind)
client/src/features/prompt-optimizer/hooks/useMotionIdeas.ts
```

The new hook owns the lifecycle:

- Fires `getMotionIdeas(image)` whenever `isI2VMode` is true and `startImageUrl` changes
- Caches the result keyed by `imageHash`
- Exposes `{ ideas, isLoading, error, reroll }` to the panel
- Aborts in-flight requests on image change (same pattern as `useI2VContext` today)

### 5.4 Shared layer changes

```
shared/schemas/optimization.schemas.ts
  └── remove inputMode field from OptimizationResponseSchema
  └── remove I2V-related branches from request schema
  └── remove constraintMode field
shared/schemas/preview.schemas.ts
  └── update video preview request schema to allow empty prompt
```

This is a contract change. Per the project's cross-layer change protocol, run `tsc --noEmit` immediately after these schema edits and verify no consumer breaks.

## 6. Empty-prompt support per video provider

The Generate button can now fire with `prompt = ""`. Each provider's adapter under `server/src/services/video-generation/` must handle this:

| Provider         | Empty prompt support                   | Required adapter change                                                                      |
| ---------------- | -------------------------------------- | -------------------------------------------------------------------------------------------- |
| Wan 2.2          | Native — image alone is valid input    | None                                                                                         |
| Kling I2V        | Requires non-empty prompt per API docs | Adapter substitutes `"natural motion"` if prompt is empty (server-side, transparent to user) |
| Veo I2V          | Native — image alone is valid input    | None                                                                                         |
| Runway Gen-3 I2V | Requires non-empty prompt              | Adapter substitutes `"subtle ambient motion"` if empty                                       |
| Sora I2V         | Native                                 | None                                                                                         |
| Luma             | Native                                 | None                                                                                         |

The substitution policy lives in each provider adapter, not in the route layer. The client still sends `""`; the adapter is the single source of truth for that provider's requirements.

A new test asserts each adapter handles empty prompts without erroring: `tests/integration/video-generation-empty-prompt.integration.test.ts`.

## 7. The lifecycle of an I2V session (after this spec)

```
1. User uploads or generates a start image
   └── domain.startFrame.url is set in generation-controls store
   └── isI2VMode flips to true

2. UI updates:
   ├── Optimize button hides
   ├── Motion Ideas panel mounts, fetches ideas
   ├── Generate button becomes enabled even with empty prompt
   └── Span highlighting in editor renders normally

3. Motion Ideas panel renders:
   ├── useMotionIdeas hook fires getMotionIdeas(startImageUrl)
   ├── Server: POST /api/i2v/motion-ideas
   │     ├── ImageObservationService.observe (cache hit, fast path, or vision)
   │     └── MotionIdeaService.generate(observation) → 3-5 phrases via LLM
   └── Chips render; user clicks one → text inserts into prompt at cursor

4. User types or edits prompt (or leaves it empty):
   ├── No /api/optimize calls
   ├── No /api/suggestions calls (span clicks no-op)
   ├── No conflict detection
   └── No rewriting

5. User clicks Generate:
   ├── Client POSTs to /api/preview/video with the literal prompt + start image
   ├── Provider adapter handles empty prompt per §6 if needed
   └── Video renders

6. User removes start image:
   ├── isI2VMode flips to false
   ├── Motion Ideas panel unmounts
   ├── Optimize button reappears
   └── Generate button reverts to T2V enable rules
```

## 8. Open sub-decisions (lock down at implementation time)

These don't change the architecture; they're UI/policy choices that get decided during implementation review.

1. **Span click in I2V — silent no-op or focus Motion Ideas?** Either: clicking a span does nothing, or clicking any span scrolls/highlights the Motion Ideas panel as a discovery aid. Recommended: silent no-op. Discovery is the Motion Ideas panel's job; redirecting clicks may feel like a bug.

2. **Motion Ideas panel placement — inline or sidebar?** Inline below the editor maximizes discoverability. A sidebar variant could go alongside the editor on wide screens. Recommended: inline below. Review during UI implementation.

3. **Re-roll behavior — same observation, new phrases vs new observation entirely?** Re-roll likely runs the LLM pass again with higher temperature on the cached observation. Recommended: same observation, new phrases. Re-running observation is wasteful.

4. **Motion Ideas chip click — literal text or LLM merge?** Literal insert is predictable. LLM-merged insertion produces more polished output but is less predictable and adds tokens per click. Recommended: literal insert.

5. **Chip count — fixed 3, fixed 5, or variable?** Recommended: 3–5 inclusive, returned by the LLM. Display whatever count the server returns up to a max of 5.

6. **Loading state UX — skeleton chips or spinner?** Recommended: 3 skeleton chips while observation is in flight. Matches the eventual rendered shape.

7. **Failure UX — generic fallback chips or error pill?** When observation/ideas fail: render generic fallback chips (`subtle natural movement`, `gentle ambient motion`, `slow camera push`) with no error message. Recommended: silent fallback. Don't draw attention to a backend hiccup the user can't fix.

8. **Camera-motion ID lock control's UI placement.** With I2V locks gone, the camera-motion-ID control is an independent feature. It may continue living wherever it does today (likely the generation-controls panel). No change required by this spec, but worth confirming during UI review.

9. **`ImageObservation` cache key issue.** Today the cache key is `sha256(image_url)`, and signed URLs change on resign even for the same underlying image. This wastes vision calls. Recommended follow-up (separate ticket): key by GCS storage path when available, fall back to URL hash otherwise. Out of scope for this spec.

## 9. Out of scope

- **Multi-shot continuity changes.** The `ContinuitySessionService` continues to use I2V chaining as it does today. This spec is scoped to the single-shot I2V editor flow.
- **Model-specific motion presets / controls.** The camera-motion-ID feature stays as-is. Not folded into Motion Ideas.
- **T2V workflow changes.** All T2V behavior is unchanged. Only the I2V-specific branches are removed.
- **Span-labeling category changes.** The labeler's outputs are unchanged. We're not categorizing spans differently — we're just not using the categories to gate I2V edits.
- **The Image Observation cache key fix** (§8.9). Documented as a follow-up.
- **`/api/i2v/motion-ideas` rate limiting / quota policy.** Initial implementation reuses existing `aiService` rate limits. A dedicated quota for motion-ideas may emerge if usage justifies it.

## 10. Migration & rollout

This is a single-PR-series change. There's no flag, no parallel rollout, and no migration of stored constraint-mode values (the field never persisted to user data — it lived only in the React Context `ui` state in `GenerationControlsStore`).

Suggested PR sequence:

1. **Server deletions (mechanical).** Delete `I2VMotionStrategy`, `i2vFlow`, `I2VConstrainedSuggestions`, types/i2v on the server, `parse_i2v_prompt` AI execution. Update `PromptOptimizationService` to remove i2v branching. Remove I2V fields from optimize / suggestions / enhance request and response schemas. Run `npx tsc --noEmit` and the integration test gate.

2. **Shared schema cleanup.** Remove `inputMode`, `constraintMode`, `i2v` fields from `shared/schemas/*`. Ensure preview schema accepts empty prompts. `tsc --noEmit` immediately.

3. **Client deletions.** Delete `ConstraintModeSelector`, `useCanvasI2V`, the constraint-mode kebab list, the I2V badge, the lock-indicator UI. Slim `useI2VContext`. Remove `ui.constraintMode` from generation-controls store. Stop sending I2V fields in optimize/suggestions/enhance requests.

4. **Optimize / Generate button gating.** Update visibility/enable conditions per §3.1 and §3.2.

5. **Empty-prompt provider adapter changes.** Per §6. New integration test asserting each adapter handles empty prompts.

6. **Motion Ideas — server.** New `MotionIdeaService`, route, DI registration, tests.

7. **Motion Ideas — client.** New `MotionIdeasPanel` component, `useMotionIdeas` hook, `getMotionIdeas` API client. Mount in `PromptOptimizerWorkspace` conditionally on `isI2VMode`.

8. **Polish.** UX details from §8: re-roll button, loading state, failure fallback chips.

Each PR should pass the project's commit protocol (`tsc --noEmit`, lint, unit tests) and stay within the ~10-files-per-commit guideline. Steps 1–4 are deletions and may exceed the guideline as mechanical refactors — note this in the commit message.

## 11. Risk register

| Risk                                                                | Likelihood                   | Mitigation                                                                                                                          |
| ------------------------------------------------------------------- | ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| A video provider's empty-prompt behavior changes silently           | Low                          | Per-provider integration test (§6) catches at CI                                                                                    |
| Motion Ideas LLM produces low-quality phrases for unusual images    | Medium                       | Re-roll button + fallback chips give the user a safety valve                                                                        |
| Users miss inline motion-word swapping                              | Low–Medium                   | Standard text editing remains; chips serve the same need with different ergonomics. Monitor support feedback for ~2 weeks post-ship |
| Image observation cache misses inflate cost                         | Low (already the status quo) | Documented as a follow-up (§8.9), not a regression introduced by this spec                                                          |
| Span-click no-op feels broken in I2V                                | Low                          | Span highlighting is preserved (still informative). If complaints surface, revisit §8.1 — focus Motion Ideas on click               |
| Schema removals break a downstream consumer not on the team's radar | Low                          | `tsc --noEmit` after schema edits + the existing contract test suite catches client/server contract drift                           |

## 12. Success criteria

- All deletions in §4.2 and §5.1 land without re-introduction.
- `/api/optimize`, `/api/suggestions`, `/api/enhance` request schemas have no I2V-specific fields.
- The Generate button fires successfully with `prompt = ""` and a start image set, on every supported provider.
- The Motion Ideas panel renders 3–5 chips within 2 seconds for cache-hit images, within 4 seconds for cache-miss images on a vision-capable provider.
- Clicking a Motion Ideas chip inserts the literal phrase at cursor with no LLM round-trip.
- Span clicks in I2V mode produce no network calls (`/api/suggestions` and `/api/enhance` are not hit).
- The `ConstraintModeSelector`, kebab-menu mode list, and "I2V strict" badge are absent from the rendered editor.
- Unit, integration, and e2e suites pass. The `prompt-optimization-service.contract.test.ts`, `constraint-mode-selector.test.tsx`, and other I2V-mode-related tests are deleted (their behavior is gone).
