# Fix: GenerationControlsPanel State Fragmentation

## Problem

Generation settings are split across 3 state scopes with inconsistent persistence:

| Setting | Current Location | Persisted? | Survives Mode Switch? |
|---------|-----------------|------------|----------------------|
| aspect_ratio, duration | `PromptStateContext.generationParams` | ✅ localStorage | ✅ |
| selectedModel | `PromptStateContext` | ✅ localStorage | ✅ |
| videoTier | Local `useState('render')` in Workspace | ❌ | ❌ |
| selectedMode | Local `useState('video')` in usePromptConfigState | ❌ | ❌ |
| cameraMotion | `GenerationControlsContext` useState | ❌ | ❌ Force-cleared |
| subjectMotion | `GenerationControlsContext` useState | ❌ | ❌ Force-cleared |

Additional bugs: convergence handoff logs but never applies motion values; subjectMotion omitted from optimization params; capability options not re-validated on tier change.

## All 9 Issues Found

1. **videoTier not persisted** — resets to 'render' on reload (local useState) — `PromptOptimizerWorkspace.tsx:154` ✅
2. **Camera motion force-cleared on mode switch** — useEffect clears on entering Studio — `PromptOptimizerWorkspace.tsx:156-160` ✅
3. **Camera motion not persisted** — pure useState in GenerationControlsContext — `GenerationControlsContext.tsx:76` ✅
4. **Convergence handoff drops camera/subject motion** — logs values but never calls setCameraMotion/setSubjectMotion, AND races with the clearing effect — `PromptOptimizerWorkspace.tsx:187-217` ✅
5. **subjectMotion missing from optimization params** — builds optimizationGenerationParams but only includes cameraMotion — `PromptOptimizerWorkspace.tsx:611-616` ✅
6. **showMotionControls hardcoded to Create-only** — Studio can't access motion UI — `PromptOptimizerWorkspace.tsx:811` ✅
7. **selectedMode not persisted** — hardcoded useState('video') — `usePromptConfigState.ts:13` ✅
8. **Capability options not re-validated on tier change** — orphaned/invalid aspect_ratio or duration values — `useGenerationControlsPanel.ts:230-257` ✅
9. **Generation triggers don't carry params explicitly** — rely on context reads in GenerationsPanel (this is fine as long as context state is correct) ✅ (no change needed)

## Solution: 6 Incremental Commits

### Commit 1: Persist `videoTier` and `selectedMode` ✅ DONE

**Pattern**: Extend the existing `promptStateStorage.ts` → `usePromptConfigState` → `usePromptStatePersistence` pipeline.

**Files changed**:
- `client/src/features/prompt-optimizer/context/promptStateStorage.ts` — Added keys, Zod schemas, load/persist functions
- `client/src/features/prompt-optimizer/context/hooks/usePromptConfigState.ts` — Init from localStorage, added videoTier state
- `client/src/features/prompt-optimizer/context/hooks/usePromptStatePersistence.ts` — Added persistence effects
- `client/src/features/prompt-optimizer/context/PromptStateContext.tsx` — Thread through to persistence hook, expose via PromptConfigContext
- `client/src/features/prompt-optimizer/context/types.ts` — Add videoTier/setVideoTier to PromptConfigState
- `client/src/features/prompt-optimizer/PromptOptimizerContainer/PromptOptimizerWorkspace.tsx` — Remove local videoTier useState, read from usePromptConfig()

**Resolves**: Issues #1 and #7

---

### Commit 2: Persist `cameraMotion` and `subjectMotion` ✅ DONE

**Pattern**: New storage module for `GenerationControlsContext`, following the exact `promptStateStorage.ts` pattern.

**Files**:
- **NEW**: `client/src/features/prompt-optimizer/context/generationControlsStorage.ts`
  - Keys: `generation-controls:cameraMotion`, `generation-controls:subjectMotion`
  - Zod schemas for `CameraPath` (object: `id`, `label`, `category`, `start`, `end`, `duration`) and subject motion (`z.string()`)
  - Exports: `loadCameraMotion()`, `persistCameraMotion()`, `loadSubjectMotion()`, `persistSubjectMotion()`
- `client/src/features/prompt-optimizer/context/GenerationControlsContext.tsx`
  - Init `cameraMotion` from `loadCameraMotion()` instead of `null`
  - Init `subjectMotion` from `loadSubjectMotion()` instead of `''`
  - Add persistence effects matching the `usePromptStatePersistence` pattern
  - Added a hydration guard so persisted motion isn't cleared before keyframes load

**Resolves**: Issue #3

---

### Commit 3: Fix mode-switch clearing + convergence handoff ✅ DONE

**Files**:
- `client/src/features/prompt-optimizer/PromptOptimizerContainer/PromptOptimizerWorkspace.tsx`

  **Remove the aggressive clearing effect** (lines 156-160):
  - Delete the `useEffect` that unconditionally clears cameraMotion/subjectMotion on `mode !== 'create'`
  - Motion state now persists in localStorage (Commit 2) and should survive mode switches
  - The existing effect in `GenerationControlsContext` (lines 268-313) already clears motion when the *keyframe* changes, which is the correct invalidation trigger

  **Fix convergence handoff** (lines 187-217):
  - After setting the prompt, also apply motion values:
    ```typescript
    if (convergenceHandoff.subjectMotion) {
      setSubjectMotion(convergenceHandoff.subjectMotion);
    }
    ```
  - For `cameraMotion`: the handoff carries a string ID, but `setCameraMotion` expects a `CameraPath`.
    - Implemented a lightweight fallback mapping that builds a `CameraPath` from the ID (label + inferred category) so motion renders immediately and can be reselected/edited later.

**Resolves**: Issues #2 and #4

---

### Commit 4: Add `subjectMotion` to optimization params + enable motion in Studio ✅ DONE

**Files**:
- `client/src/features/prompt-optimizer/PromptOptimizerContainer/PromptOptimizerWorkspace.tsx`
  - Lines 611-617: Add `subjectMotion` to `optimizationGenerationParams`:
    ```typescript
    ...(subjectMotion.trim() ? { subject_motion: subjectMotion.trim() } : {}),
    ```
  - Line 811: Change `showMotionControls: mode === 'create'` → `showMotionControls: true`
    - Motion UI will render in both Create and Studio when a keyframe is present
- `client/src/features/prompt-optimizer/PromptOptimizerContainer/PromptOptimizerContainer.tsx`
  - Also includes `subject_motion` in optimization params to keep legacy container path aligned

**Resolves**: Issues #5 and #6

---

### Commit 5: Validate capability options on tier/model change ✅ DONE

**Files changed**:
- `client/src/components/ToolSidebar/components/panels/GenerationControlsPanel/hooks/useGenerationControlsPanel.ts`
  - Destructured `onAspectRatioChange` and `onDurationChange` from props
  - Added clamping effects after capability resolution that validate current params against resolved options
  - Logs when clamping occurs for observability

**Resolves**: Issue #8

---

### Commit 6: Update tests ✅ DONE

**Files**:
- `client/src/features/prompt-optimizer/context/__tests__/generationControlsStorage.test.ts` — Zod validation + corrupt storage handling
- `client/src/components/ToolSidebar/components/panels/GenerationControlsPanel/hooks/__tests__/useGenerationControlsPanel.test.tsx` — clamping logic
- `client/src/features/prompt-optimizer/context/__tests__/promptStateStorage.test.ts` — selectedMode/videoTier persistence helpers
- `client/src/contexts/__tests__/AppShellContext.test.tsx` — no change required (handoff shape unchanged)

---

## Dependency Order

```
Commit 1 (persist videoTier/selectedMode) ✅ ──┐
Commit 2 (persist cameraMotion/subjectMotion) ✅ ──┤
                                                 ├── Commit 3 (fix clearing + handoff) ✅
                                                 │       │
                                                 │       └── Commit 4 (subjectMotion in opt params + Studio motion) ✅
                                                 │
Commit 5 (capability validation) ✅              └── Commit 6 (tests) ✅
```

Commits 1, 2, and 5 are independent. Commit 3 requires Commit 2. Commit 4 requires Commit 3.

## Root Cause (Architectural)

The panel's state is split across **four scopes** with different lifetimes:
1. **localStorage** (survives everything) — model, aspect ratio, duration
2. **Context state** (survives within session) — camera motion, subject motion, keyframes
3. **Component local state** (dies on unmount) — videoTier, selectedMode
4. **Props from parent** (derived, ephemeral) — showMotionControls, convergenceHandoff

Anything in scope 3 or 4 that the user expects to behave like scope 1 or 2 feels like a bug. The fix promotes each setting to the appropriate persistence tier for its expected lifetime.

## Verification

1. **videoTier persistence**: Switch to draft → reload → should still be draft
2. **selectedMode persistence**: Switch to image tab → reload → should still be image
3. **cameraMotion persistence**: Select a camera motion → reload → should still be selected
4. **Mode switch**: Select camera motion in Create → switch to Studio → motion should persist and be visible
5. **Convergence handoff**: Complete convergence with motion → verify motion appears in Studio
6. **subjectMotion in optimization**: Set subject motion → optimize → check network request includes `subject_motion`
7. **Capability clamping**: Select 21:9 on render → switch to draft → aspect ratio should auto-clamp
8. **Corrupt localStorage**: Manually set garbage in `generation-controls:cameraMotion` → reload → should gracefully fallback to `null`
9. **Run existing tests**: `npm run test:unit` — all should pass

---

## Draft: Unified Generation Controls Store (Reducer + Migration)

To start consolidating state without breaking existing consumers, a draft reducer-based store was added that hydrates from legacy storage keys and persists back to both the new key and the legacy keys.

**Files**:
- `client/src/features/prompt-optimizer/context/generationControlsStoreTypes.ts`
- `client/src/features/prompt-optimizer/context/generationControlsStoreStorage.ts`
- `client/src/features/prompt-optimizer/context/GenerationControlsStore.tsx`

**State shape**:
- `domain`: `selectedModel`, `generationParams`, `videoTier`, `keyframes`, `cameraMotion`, `subjectMotion`
- `ui`: `activeTab`, `imageSubTab`, `constraintMode`

**Migration behavior**:
- If `prompt-optimizer:generationControlsStore` is missing or invalid, hydrate from:
  - `prompt-optimizer:*` (`selectedModel`, `generationParams`, `videoTier`)
  - `generation-controls:*` (`keyframes`, `cameraMotion`, `subjectMotion`, `activeTab`, `imageSubTab`, `constraintMode`)
- Persist writes to the unified key and mirrors legacy keys for backward compatibility

**Next wiring step (optional)**:
- Wrap the app shell (or `PromptStateProvider`) with `GenerationControlsStoreProvider`
- Move `GenerationControlsContext` and `PromptStateContext` to read/write through store actions
