# Generation Controls State Consolidation Plan

> **Status:** Draft  
> **Priority:** High  
> **Estimated Effort:** 3-5 days  
> **Risk Level:** Medium (touches core state management)

---

## Executive Summary

The generation controls state is fragmented across multiple contexts, storage mechanisms, and component-local state. This creates synchronization bugs, makes the codebase hard to reason about, and causes unnecessary re-renders. This plan consolidates state into a single reducer-based store with a clear migration path.

---

## Problem Statement

### Current State Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         STATE FRAGMENTATION                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  PromptStateContext.tsx          GenerationControlsContext.tsx              │
│  ┌─────────────────────┐         ┌─────────────────────────┐               │
│  │ selectedModel       │         │ keyframes               │               │
│  │ generationParams    │         │ cameraMotion            │               │
│  │ videoTier           │         │ subjectMotion           │               │
│  │ selectedMode        │         │ controls (handlers)     │               │
│  └─────────────────────┘         └─────────────────────────┘               │
│           │                                 │                               │
│           ▼                                 ▼                               │
│  promptStateStorage.ts           generationControlsStorage.ts               │
│  (localStorage)                  (localStorage)                             │
│                                                                             │
│  useGenerationControlsPanel.ts                                              │
│  ┌─────────────────────────────────────────────────────────┐               │
│  │ activeTab, imageSubTab (localStorage)                   │               │
│  │ isEditing, originalInputPrompt (sessionStorage)         │               │
│  │ capability validation (useEffect)                       │               │
│  │ model recommendations (API)                             │               │
│  │ file upload handling                                    │               │
│  │ autocomplete state                                      │               │
│  └─────────────────────────────────────────────────────────┘               │
│                                                                             │
│  GenerationControlsPanelProps: 30+ props threaded through                   │
│  PromptOptimizerWorkspace → ToolSidebar → Panel                            │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Identified Issues

| Issue | Impact | Location |
|-------|--------|----------|
| **Split-brain state** | videoTier in PromptStateContext, keyframes in GenerationControlsContext - no single source of truth | Multiple contexts |
| **God hook** | 450+ lines mixing UI, persistence, validation, API calls, file upload | `useGenerationControlsPanel.ts` |
| **Effect-based business logic** | "Reset camera motion when keyframe changes" runs after render, causing flashes | `GenerationControlsContext.tsx` |
| **Prop drilling** | 30+ props threaded through 3 component layers | `GenerationControlsPanelProps` |
| **Re-render churn** | Context value rebuilds on any change, all consumers re-render | Both contexts |
| **Mixed storage lifetimes** | localStorage + sessionStorage + context state with no clear ownership | Scattered |
| **Capability clamping in effects** | Invalid values observable for one render cycle | `useGenerationControlsPanel.ts` |

### Root Causes

1. **Incremental evolution** - Each feature added its own state/persistence without unified design
2. **No boundary between domain and UI state** - Generation config mixed with tab selection mixed with edit mode
3. **Contexts split by feature, not by render boundary** - Causes re-render fan-out
4. **No single owner for persistence** - Each module writes to storage independently

---

## Proposed Architecture

### Target State

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    CONSOLIDATED STATE ARCHITECTURE                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  GenerationControlsStoreProvider                                            │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                                                                     │   │
│  │  GenerationControlsStateContext    GenerationControlsActionsContext │   │
│  │  ┌───────────────────────────┐    ┌───────────────────────────┐    │   │
│  │  │ domain:                   │    │ setSelectedModel()        │    │   │
│  │  │   selectedModel           │    │ setGenerationParams()     │    │   │
│  │  │   generationParams        │    │ mergeGenerationParams()   │    │   │
│  │  │   videoTier               │    │ setVideoTier()            │    │   │
│  │  │   keyframes               │    │ setKeyframes()            │    │   │
│  │  │   cameraMotion            │    │ addKeyframe()             │    │   │
│  │  │   subjectMotion           │    │ removeKeyframe()          │    │   │
│  │  │                           │    │ clearKeyframes()          │    │   │
│  │  │ ui:                       │    │ setCameraMotion()         │    │   │
│  │  │   activeTab               │    │ setSubjectMotion()        │    │   │
│  │  │   imageSubTab             │    │ setActiveTab()            │    │   │
│  │  │   constraintMode          │    │ setImageSubTab()          │    │   │
│  │  └───────────────────────────┘    └───────────────────────────┘    │   │
│  │                                                                     │   │
│  │  useReducer with colocated business logic:                         │   │
│  │  - Keyframe normalization (max 3)                                  │   │
│  │  - Motion invalidation on keyframe change                          │   │
│  │  - No-op detection for unchanged values                            │   │
│  │                                                                     │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                              │                                              │
│                              ▼                                              │
│  generationControlsStoreStorage.ts                                          │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ - Single localStorage key: prompt-optimizer:generationControlsStore │   │
│  │ - Migration: reads legacy keys on hydration                         │   │
│  │ - Backward compat: writes to legacy keys during transition          │   │
│  │ - Zod validation on load                                            │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  Separate concerns (NOT in store):                                          │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ useKeyframeUrlRefresh() - 60s polling for GCS signed URLs           │   │
│  │ useCapabilityValidation() - Clamps aspect_ratio/duration to allowed │   │
│  │ Edit mode state - sessionStorage, intentionally ephemeral           │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Design Decisions

#### 1. State/Actions Context Split

**Decision:** Two separate contexts - one for state, one for actions.

**Rationale:** Components that only dispatch actions (e.g., "Clear All" button) won't re-render when state changes. Actions object is stable (created once via `useMemo`).

```typescript
// ✓ Only re-renders when state changes
const state = useGenerationControlsStoreState();

// ✓ Never re-renders (stable reference)
const actions = useGenerationControlsStoreActions();

// ✓ Convenience hook when you need both
const { state, actions } = useGenerationControlsStore();
```

#### 2. Domain vs UI State Separation

**Decision:** Single store with `domain` and `ui` namespaces.

**Rationale:** Keeps related state together while making the semantic boundary clear. Domain state is what we send to APIs. UI state is how users interact with the tool.

```typescript
interface GenerationControlsState {
  domain: {
    selectedModel: string;
    generationParams: CapabilityValues;
    videoTier: VideoTier;
    keyframes: KeyframeTile[];
    cameraMotion: CameraPath | null;
    subjectMotion: string;
  };
  ui: {
    activeTab: GenerationControlsTab;
    imageSubTab: ImageSubTab;
    constraintMode: ConstraintMode;
  };
}
```

#### 3. Business Logic in Reducer

**Decision:** Colocate business rules in reducer, not effects.

**Rationale:** Effects run after render, allowing invalid intermediate states. Reducer transitions are synchronous - invalid states are never observable.

```typescript
// BEFORE: Effect-based (current)
useEffect(() => {
  if (firstKeyframeUrl !== lastFirstKeyframeUrlRef.current) {
    setCameraMotion(null); // Runs AFTER render with stale motion
  }
}, [firstKeyframeUrl]);

// AFTER: Reducer-based (proposed)
case 'setKeyframes': {
  const nextKeyframes = normalizeKeyframes(action.value);
  const motion = reconcileMotionAfterKeyframes(state, nextKeyframes);
  return { ...state, domain: { ...state.domain, keyframes: nextKeyframes, ...motion } };
}
```

#### 4. Edit Mode Stays Ephemeral

**Decision:** `isEditing` and `originalInputPrompt` remain in sessionStorage, NOT in the store.

**Rationale:** Edit mode should survive page refresh (user was mid-edit) but NOT survive closing the tab (fresh start). sessionStorage provides exactly this lifecycle. Adding it to localStorage would leak edit state across tabs.

#### 5. Capability Clamping Stays in Effects (For Now)

**Decision:** Defer moving capability validation into the reducer.

**Rationale:** Clamping requires knowing `allowedValues` from the capabilities schema, which depends on `selectedModel`. Passing this to every action is awkward. The current effect-based approach works; it's just not optimal. Flag for future improvement.

#### 6. URL Refresh as Dedicated Hook

**Decision:** Extract keyframe URL refresh into `useKeyframeUrlRefresh()`.

**Rationale:** Reducers must be pure. The 60-second polling for GCS signed URL refresh is a side effect that reads state and writes state. It belongs in a hook that subscribes to keyframes from the store.

---

## Migration Strategy

### Phase 0: Foundation (Already Done)

Files created:
- `client/src/features/prompt-optimizer/context/generationControlsStoreTypes.ts`
- `client/src/features/prompt-optimizer/context/generationControlsStoreStorage.ts`
- `client/src/features/prompt-optimizer/context/GenerationControlsStore.tsx`

### Phase 1: Wire Provider Without Breaking Consumers

**Goal:** Add the new store provider at app root. Existing contexts continue working.

**Files to modify:**

```
client/src/App.tsx (or equivalent app shell)
└── Add GenerationControlsStoreProvider as outermost provider
```

**Verification:** App boots, all existing functionality works unchanged.

### Phase 2: Create Adapter Layer for GenerationControlsContext

**Goal:** Make `GenerationControlsContext` a thin adapter that reads/writes from the store.

**Files to modify:**

```
client/src/features/prompt-optimizer/context/GenerationControlsContext.tsx
├── Remove local useState for keyframes, cameraMotion, subjectMotion
├── Read from useGenerationControlsStoreState().domain
├── Write via useGenerationControlsStoreActions()
├── Keep URL refresh logic (extract in Phase 4)
└── Keep controls/setControls (not migrating these)
```

**Code sketch:**

```typescript
export function GenerationControlsProvider({ children }: { children: ReactNode }) {
  // ADAPTER: Read from store
  const { domain } = useGenerationControlsStoreState();
  const storeActions = useGenerationControlsStoreActions();
  
  // Keep non-store state
  const [controls, setControls] = useState<GenerationControlsHandlers | null>(null);
  
  // ADAPTER: Forward to store actions
  const setKeyframes = useCallback((tiles: KeyframeTile[] | null | undefined) => {
    storeActions.setKeyframes(tiles);
  }, [storeActions]);
  
  // ... URL refresh logic stays here for now ...
  
  const contextValue = useMemo(() => ({
    controls,
    setControls,
    keyframes: domain.keyframes,
    setKeyframes,
    addKeyframe: storeActions.addKeyframe,
    removeKeyframe: storeActions.removeKeyframe,
    clearKeyframes: storeActions.clearKeyframes,
    cameraMotion: domain.cameraMotion,
    subjectMotion: domain.subjectMotion,
    setCameraMotion: storeActions.setCameraMotion,
    setSubjectMotion: storeActions.setSubjectMotion,
    onStoryboard: controls?.onStoryboard ?? null,
  }), [domain, storeActions, controls]);
  
  return (
    <GenerationControlsContext.Provider value={contextValue}>
      {children}
    </GenerationControlsContext.Provider>
  );
}
```

**Verification:** All existing `useGenerationControlsContext()` consumers work unchanged. State persists to new storage key.

### Phase 3: Migrate PromptStateContext Config State

**Goal:** Move `selectedModel`, `generationParams`, `videoTier` from PromptStateContext to the store.

**Files to modify:**

```
client/src/features/prompt-optimizer/context/PromptStateContext.tsx
├── Remove usePromptConfigState() internal state for model/params/tier
├── Read from useGenerationControlsStoreState().domain
├── Write via useGenerationControlsStoreActions()
└── Keep all other state (modes, UI flags, session state, etc.)

client/src/features/prompt-optimizer/context/hooks/usePromptConfigState.ts
├── Convert to adapter that reads/writes from store
└── Keep for backward compatibility during migration
```

**Verification:** Model selection, aspect ratio, duration, tier all persist correctly. Switching between draft/render works.

### Phase 4: Extract URL Refresh Hook

**Goal:** Move keyframe URL refresh logic out of GenerationControlsContext.

**Files to create:**

```
client/src/features/prompt-optimizer/hooks/useKeyframeUrlRefresh.ts
├── Subscribe to keyframes from store
├── 60-second polling interval
├── Refresh stale GCS signed URLs via storageApi
└── Update keyframes via store action
```

**Files to modify:**

```
client/src/features/prompt-optimizer/context/GenerationControlsContext.tsx
├── Remove refreshStaleKeyframes logic
├── Remove KEYFRAME_REFRESH_INTERVAL_MS
└── Import and call useKeyframeUrlRefresh()
```

**Verification:** Keyframe images don't break after 1+ hours. Console shows refresh logs.

### Phase 5: Slim useGenerationControlsPanel

**Goal:** Remove state that now lives in the store.

**Files to modify:**

```
client/src/components/ToolSidebar/components/panels/GenerationControlsPanel/hooks/useGenerationControlsPanel.ts
├── Remove activeTab/imageSubTab local state + persistence
├── Read from useGenerationControlsStoreState().ui
├── Write via useGenerationControlsStoreActions()
├── Keep isEditing in sessionStorage (intentional)
└── Keep capability clamping effects (defer to future)
```

**Verification:** Tab selection persists across page refresh. Edit mode survives refresh but not new tab.

### Phase 6: Reduce Prop Drilling

**Goal:** GenerationControlsPanel reads from context instead of props.

**Files to modify:**

```
client/src/components/ToolSidebar/components/panels/GenerationControlsPanel/types.ts
├── Remove: aspectRatio, duration, selectedModel, onModelChange, onAspectRatioChange, onDurationChange
├── Remove: keyframes, onAddKeyframe, onRemoveKeyframe, onClearKeyframes
├── Remove: tier, onTierChange, cameraMotion, onCameraMotionChange
├── Keep: prompt, onPromptChange, onOptimize (core panel purpose)
├── Keep: onDraft, onRender, onStoryboard (generation triggers)
├── Keep: showResults, isProcessing, isRefining (optimization state)
└── Keep: assets, promptInputRef (editor integration)

client/src/components/ToolSidebar/components/panels/GenerationControlsPanel/GenerationControlsPanel.tsx
├── Add useGenerationControlsStore() at top
├── Read domain/ui state from store
└── Use store actions for state changes

client/src/features/prompt-optimizer/PromptOptimizerContainer/PromptOptimizerWorkspace.tsx
├── Remove state management for generation controls
├── Remove prop threading to ToolSidebar
└── Keep generation trigger callbacks (onDraft, onRender)
```

**Props before:** ~30  
**Props after:** ~12

**Verification:** All panel functionality works. No regressions in generation flow.

### Phase 7: Delete Adapter Layers

**Goal:** Remove the adapter code from Phase 2-3, consumers use store directly.

**Files to modify:**

```
client/src/features/prompt-optimizer/context/GenerationControlsContext.tsx
├── Delete adapter logic
├── Keep only: controls, setControls, onStoryboard
└── Consider: merge into parent or delete entirely

client/src/features/prompt-optimizer/context/hooks/usePromptConfigState.ts
├── Delete if no longer needed
└── Or keep as convenience re-export of store hooks
```

**Verification:** No runtime errors. All tests pass.

### Phase 8: Delete Legacy Storage Keys

**Goal:** Stop writing to legacy localStorage keys.

**Files to modify:**

```
client/src/features/prompt-optimizer/context/generationControlsStoreStorage.ts
├── Remove calls to legacy persist* functions
├── Keep legacy load* for one release (migration safety)
└── Remove legacy load* after one release cycle
```

**Verification:** New storage key is the only one written. Legacy keys still read for migration.

---

## Files Changed Summary

| Phase | Files Modified | Files Created | Files Deleted |
|-------|---------------|---------------|---------------|
| 0 | 0 | 3 | 0 |
| 1 | 1 | 0 | 0 |
| 2 | 1 | 0 | 0 |
| 3 | 2 | 0 | 0 |
| 4 | 1 | 1 | 0 |
| 5 | 1 | 0 | 0 |
| 6 | 3 | 0 | 0 |
| 7 | 2 | 0 | 0 |
| 8 | 1 | 0 | 0 |
| **Total** | **12** | **4** | **0** |

---

## Testing Strategy

### Unit Tests

```
client/src/features/prompt-optimizer/context/__tests__/
├── GenerationControlsStore.test.tsx
│   ├── Reducer: all action types
│   ├── Reducer: motion invalidation on keyframe change
│   ├── Reducer: keyframe normalization (max 3)
│   ├── Reducer: no-op detection
│   ├── Provider: hydration from storage
│   └── Provider: persistence on state change
│
├── generationControlsStoreStorage.test.ts
│   ├── loadGenerationControlsStoreState: new key present
│   ├── loadGenerationControlsStoreState: legacy migration
│   ├── loadGenerationControlsStoreState: invalid JSON
│   ├── persistGenerationControlsStoreState: writes new key
│   └── persistGenerationControlsStoreState: mirrors legacy keys
│
└── useKeyframeUrlRefresh.test.ts (Phase 4)
    ├── Calls storageApi.getViewUrl for stale URLs
    ├── Updates keyframes via store action
    ├── Respects refresh interval
    └── Handles API errors gracefully
```

### Integration Tests

```
client/src/features/prompt-optimizer/__tests__/
├── generation-controls-migration.test.tsx
│   ├── Legacy localStorage migrates to new store
│   ├── State persists across page reload
│   └── Tab selection persists correctly
│
└── generation-controls-panel.test.tsx
    ├── Model selection updates store
    ├── Aspect ratio clamping works
    ├── Keyframe add/remove updates store
    └── Camera motion clears on keyframe change
```

### Manual Testing Checklist

- [ ] Fresh install: no localStorage, app boots with defaults
- [ ] Migration: existing localStorage, state hydrates correctly
- [ ] Model selection: persists across refresh
- [ ] Aspect ratio: clamps to valid values on model change
- [ ] Duration: clamps to valid values on model change
- [ ] Tier toggle: draft/render switches correctly
- [ ] Keyframe upload: adds to list, persists
- [ ] Keyframe remove: removes from list, persists
- [ ] Keyframe limit: cannot add more than 3
- [ ] Camera motion: clears when primary keyframe changes
- [ ] Tab selection: persists across refresh
- [ ] Edit mode: survives refresh, clears on new tab
- [ ] URL refresh: keyframes don't break after 1 hour

---

## Rollback Plan

Each phase is independently deployable. If issues arise:

1. **Phase 1-2:** Remove provider, revert GenerationControlsContext. State falls back to legacy keys.
2. **Phase 3:** Revert PromptStateContext. Config state reads from legacy keys.
3. **Phase 4-5:** Revert hooks. URL refresh and panel state fall back to previous implementation.
4. **Phase 6-7:** Revert prop changes. More work but isolated to specific components.
5. **Phase 8:** Easiest - just keep writing legacy keys.

**Key insight:** The migration-aware storage layer means we can roll back any phase without data loss. Legacy keys are always populated during the transition period.

---

## Future Improvements (Out of Scope)

1. **Selector hooks** - Add `useKeyframes()`, `useSelectedModel()` that only re-render when their slice changes. Consider `use-context-selector` or Zustand if this becomes a performance issue.

2. **Capability clamping in reducer** - Pass `allowedValues` with param-changing actions, clamp in reducer instead of effects.

3. **Optimistic updates** - For keyframe upload, update store immediately, revert on failure.

4. **Undo/redo for generation params** - Store maintains history stack, expose undo/redo actions.

5. **Server-side persistence** - Sync generation preferences to user account, not just localStorage.

---

## Open Questions

| Question | Options | Recommendation |
|----------|---------|----------------|
| Should we use Zustand instead of rolling our own? | (A) Zustand, (B) React context | **B** - Store is already built, Zustand adds a dependency for marginal benefit here |
| Should edit mode move to the store? | (A) Store + localStorage, (B) Keep sessionStorage | **B** - sessionStorage lifecycle is correct (survives refresh, not new tab) |
| When do we delete legacy storage keys? | (A) Same release, (B) Next release, (C) Never | **B** - One release cycle ensures all users migrate |
| Should GenerationControlsContext be deleted? | (A) Delete, (B) Keep as thin wrapper | **A** - After Phase 7, it only holds `controls` which can move to the store or a simpler context |

---

## Appendix: Existing Files Reference

```
client/src/features/prompt-optimizer/context/
├── GenerationControlsContext.tsx      # Keyframes, motion - ADAPTS IN PHASE 2
├── GenerationControlsStore.tsx        # NEW STORE - CREATED IN PHASE 0
├── PromptStateContext.tsx             # Model, params, tier - ADAPTS IN PHASE 3
├── generationControlsStorage.ts       # Legacy storage - KEEP FOR MIGRATION
├── generationControlsStoreStorage.ts  # New storage - CREATED IN PHASE 0
├── generationControlsStoreTypes.ts    # Types - CREATED IN PHASE 0
├── promptStateStorage.ts              # Legacy storage - KEEP FOR MIGRATION
└── types.ts                           # Context types

client/src/components/ToolSidebar/components/panels/GenerationControlsPanel/
├── GenerationControlsPanel.tsx        # Main component - MODIFIED IN PHASE 6
├── types.ts                           # Props - MODIFIED IN PHASE 6
└── hooks/
    └── useGenerationControlsPanel.ts  # God hook - MODIFIED IN PHASE 5
```
