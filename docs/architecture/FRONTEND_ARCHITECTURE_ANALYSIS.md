# Frontend Architecture Analysis: Radical Improvement Opportunities

**Date:** 2026-03-19
**Status:** Fully implemented (see Implementation Log below)
**Scope:** All `client/src/features/`, `client/src/components/`, `client/src/services/`, `client/src/hooks/`, `client/src/api/`

## Implementation Log (2026-03-19)

| Phase | Action | Status | Files Changed |
|-------|--------|--------|---------------|
| 1 | Delete dead code (VideoConceptBuilder, PromptEnhancementEditor, orphaned services) | **Done** | -65 files deleted |
| 2 | Extract GenerationsPanel → `features/generations/` | **Done** | 44 files moved, ~36 import paths updated |
| 3 | Extract GenerationControlsStore → `features/generation-controls/` | **Done** | 4 core files + 3 tests moved, ~24 import paths updated |
| 4 | Remove ToolSidebar domain override pattern | **Done** | 5 legacy providers deleted, props override removed, ToolSidebar simplified |
| 5 | Split PromptStateContext | **Skipped** — already split into 7 focused sub-contexts |
| 6 | Extract CanvasWorkspace → `features/workspace-shell/` | **Done** | 26 files moved; accepts 4 cross-feature component imports from prompt-optimizer (GalleryPanel, GenerationPopover, PromptEditor, LockedSpanIndicator) |
| 7 | Extract SequenceWorkspace → `features/sequence-editor/` | **Done** | 11 files moved (SequenceWorkspace + sequence components); WorkspaceSessionContext stays in prompt-optimizer as shared state |
| 8 | Finish root services/hooks/api migration | **Partial** — moved `useCameraMotion` + `motionApi` to convergence; remaining root files are legitimate shared infrastructure |

---

## Executive Summary

Three systems warrant radical restructuring. Everything else is well-architected or needs only incremental cleanup.

| System | Verdict | Impact |
|--------|---------|--------|
| `prompt-optimizer` | **Decompose** — god feature masquerading as one module | High |
| `ToolSidebar` + domain override pattern | **Simplify** — unnecessary adapter layer | Medium |
| `services/` + `hooks/` + `api/` root directories | **Consolidate** — migration stalled at 95% | Low |
| Everything else | Healthy boundaries, no radical changes needed | — |

---

## 1. prompt-optimizer Is a God Feature (319 files, ~13K lines)

### The Problem

`prompt-optimizer` contains at least **five independent domains** forced into one directory:

| Domain | Files | What It Actually Does |
|--------|-------|-----------------------|
| **PromptCanvas** | 49 | Text editing, span labeling, inline suggestions |
| **GenerationsPanel** | 50 | Generation lifecycle, keyframes, progress, timelines |
| **CanvasWorkspace** | 26 | Hero viewer, gallery layout, visual composition |
| **Generation Controls** | 28 (context/) | Model selection, aspect ratio, camera motion, video refs |
| **Sequence Editing** | ~15 | Multi-shot sessions, shot timeline, continuity coordination |

These domains have **different reasons to change**, different stakeholders, and different rates of evolution. A camera motion refactor shouldn't touch the text editor. A generation timeline redesign shouldn't risk breaking prompt suggestions.

### Evidence of God Feature

- **8 React Context providers** in one feature (PromptStateContext alone bundles 7 sub-domains exposing 50+ values)
- **GenerationControlsStore** manages ~20 actions for model/keyframe/motion state that isn't prompt-specific
- **GenerationsPanel** has its own hooks, runtime, and state — consumed via `useGenerationsRuntime()` which is already a clean module boundary
- **CanvasWorkspace** has zero imports from PromptCanvas internals — it's a layout shell, not a prompt concern
- **WorkspaceSessionContext** only activates in multi-shot mode — it's a sequence-editing concern, not a prompt concern

### Recommended Decomposition

```
features/
├── prompt-editor/              # RENAMED: text editing + optimization only
│   ├── PromptCanvas/           # (moved from prompt-optimizer)
│   ├── SpanBentoGrid/
│   ├── context/
│   │   ├── PromptTextContext   # prompt text, undo/redo, highlights
│   │   └── PromptUIContext     # panel visibility, navigation
│   └── api/
├── generations/                # NEW: extracted from GenerationsPanel
│   ├── components/
│   ├── hooks/                  # useGenerationsRuntime, useGenerationsTimeline
│   ├── context/                # generation state, results actions
│   └── api/
├── generation-controls/        # NEW: extracted from context/
│   ├── GenerationControlsStore # model, aspect ratio, keyframes, motion
│   ├── hooks/
│   └── types/
├── workspace-shell/            # NEW: extracted from CanvasWorkspace
│   ├── HeroViewer/
│   ├── GalleryPanel/
│   └── layouts/
└── sequence-editor/            # NEW: extracted from session/sequence components
    ├── ShotTimeline/
    ├── SequenceWorkspace/
    └── context/WorkspaceSessionContext
```

### Why This Is Radical (Not Incremental)

The current structure trains developers to think "prompt-optimizer owns everything in the workspace." This leads to:

- Every workspace feature getting dumped into prompt-optimizer
- Context providers accumulating without bounds (currently 8, trending toward more)
- 319-file feature directories where `git blame` and code review become meaningless

The decomposition isn't just file moves — it requires **rethinking state ownership**. GenerationControlsStore should not live inside a "prompt" feature because it manages video generation parameters. PromptStateContext should not bundle navigation state alongside highlight snapshots.

### Migration Path

**Phase 1 (low risk):** Extract `GenerationsPanel` → `features/generations/`. It already has a clean hook boundary (`useGenerationsRuntime`). Wire it via props at the workspace level instead of context nesting.

**Phase 2 (low risk):** Extract `GenerationControlsStore` → `features/generation-controls/`. Move the reducer, actions, and storage adapter. Update imports across ~24 files.

**Phase 3 (medium risk):** Extract `CanvasWorkspace` → `features/workspace-shell/`. This requires deciding where the hero viewer gets its generation data (answer: from `features/generations/` via props or a thin shared context).

**Phase 4 (medium risk):** Split `PromptStateContext` into 3 focused contexts. The current 7-subdomain bundling means every consumer re-renders on unrelated state changes — this is a performance problem hiding in plain sight.

---

## 2. ToolSidebar's Domain Override Pattern Is Unnecessary Complexity

### The Problem

ToolSidebar (58 files, ~7K lines) has a three-tier resolution system for domain data:

```
Props override → Individual context override → Aggregated SidebarDataContext
```

Five "domain interfaces" (SessionsDomain, PromptInteractionDomain, GenerationDomain, AssetsDomain, WorkspaceDomain) act as adapters between prompt-optimizer's contexts and ToolSidebar's panels.

**But ToolSidebar doesn't own any state.** It's a pure view layer that reads from prompt-optimizer's stores and calls prompt-optimizer's actions. The domain interfaces add indirection without adding value.

### The Specific Pain

`useGenerationControlsPanel` is a ~700-line hook that reads from 7+ sources (3 sidebar domain contexts + 4 prompt-optimizer contexts + local hooks for model recommendation, face swap, capabilities clamping, and camera motion). It returns ~150 properties.

This hook is the real cost of the adapter pattern: you need a translator hook to reassemble what was already assembled, just in a different shape.

### Recommended Simplification

**Option A (preferred): Remove the adapter layer entirely.**

```tsx
// Before: GenerationControlsPanel reads through domain adapters
const generationDomain = useSidebarGenerationDomain();
const assetsDomain = useSidebarAssetsDomain();
// ... then reassembles into useGenerationControlsPanel

// After: GenerationControlsPanel reads source contexts directly
const storeState = useGenerationControlsStoreState();
const storeActions = useGenerationControlsStoreActions();
const assets = useAssets();
```

Delete `SidebarDomainContexts.tsx`, the 5 domain interfaces in `types.ts`, and the `SidebarDataProvider` bridge. ToolSidebar becomes a panel router that renders feature-owned components directly.

**Trade-off:** ToolSidebar can no longer be tested in isolation from prompt-optimizer's contexts. In practice, you weren't doing this anyway — the test fixtures were mapping the same data.

**Option B: If you keep the adapter, at least consolidate it.**

Remove the three-tier fallback (props → individual context → aggregated context). Keep only props. This makes the data flow explicit and eliminates the "where does this domain come from?" debugging.

---

## 3. Root-Level services/, hooks/, and api/ Are Stalled Migration Artifacts

### The Problem

The migration from monolithic `services/` to feature-scoped `features/*/api/` is ~95% complete but stalled. What remains:

| Root File | Status | Action |
|-----------|--------|--------|
| `services/PromptOptimizationApi.ts` | **Active** — used in GenerationsPanel | Move to `features/generations/api/` |
| `services/EnhancementApi.ts` | **Orphaned** — superseded by feature APIs | Delete |
| `services/VideoConceptApi.ts` | **Orphaned** — only in legacy VideoConceptBuilder | Delete with VideoConceptBuilder |
| `services/ApiClient.ts` | **Active** — HTTP infrastructure | Keep (correct location) |
| `services/PredictiveCacheService.ts` | **Active** — caching layer | Keep (correct location) |
| `hooks/usePromptOptimizer*.ts` (3 files) | **Unclear** — may duplicate feature hooks | Audit and remove if duplicated |
| `hooks/useCameraMotion.ts` | **Active** — used across features | Move to `features/convergence/hooks/` |
| `api/enhancementSuggestionsApi.ts` | **Active** — transport layer | Move to `features/prompt-editor/api/` |

### Recommended Action

Finish the migration. This is a 1-2 day cleanup, not a design change. The risk is low because you're moving code, not rewriting it.

Also delete the clearly dead code: `VideoConceptBuilder` (51 files, only in tests), `PromptEnhancementEditor` (explicitly marked deprecated), and the orphaned service files.

---

## 4. Systems That Are Fine

### Well-Architected Features (No Changes Needed)

| Feature | Files | Assessment |
|---------|-------|------------|
| `span-highlighting` | 49 | Fully isolated. Clean cache + utility architecture. IndexedDB storage adapter is solid. |
| `preview` | 14 | Minimal, focused. Zod schemas at boundary. No cross-feature coupling. |
| `continuity` | 23 | Clean domain boundary. Only exports `ContinueSceneButton` for composition. |
| `convergence` | 30 | Self-contained motion controls. Only exports types to consumers. |
| `assets` | 26 | Proper feature module. Consumed by prompt-optimizer only (correct dependency direction). |
| `reference-images` | 7 | Minimal standalone feature. Nothing to improve. |
| `model-intelligence` | 27 | Clean advisory layer. Consumed, not coupled. |
| `billing` | 9 | Isolated account concern. Correctly minimal. |
| `history` | 11 | View-only feature. Clean separation. |
| `AppShell` | — | Correct app-shell pattern for route-level navigation. |

### SuggestionsPanel: Finish the Migration

SuggestionsPanel is the only legacy component still actively imported by modern code. Two imports remain:

1. `MAX_REQUEST_LENGTH` config constant → Move to `shared/` or `features/prompt-editor/config/`
2. `useCustomRequest` hook → Move to `features/prompt-editor/hooks/`

Once those two imports are relocated, SuggestionsPanel can be deleted or archived alongside VideoConceptBuilder.

---

## 5. Cross-Cutting Concern: State Management

### Current State

No Zustand, no Redux. Pure React Context + useReducer + localStorage persistence.

This is fine for now, but the 8-context stack in prompt-optimizer creates two problems:

1. **Render cascades:** Any change to PromptStateContext re-renders all consumers, even if they only use 1 of 7 sub-domains. The `usePromptConfig()` / `usePromptUIState()` selector hooks mitigate this somewhat, but the provider still triggers reconciliation.

2. **Provider depth:** The workspace mounts 8+ nested providers. Each provider boundary is a potential render barrier and debugging obstacle in React DevTools.

### Recommendation

After the prompt-optimizer decomposition, each extracted feature should own 1-2 contexts max. The prompt-editor itself should have at most 3: text state, UI state, and services. The current 8-provider stack should become 3-4 providers distributed across 4 features.

If you later need cross-feature coordination (e.g., "generation started" should update prompt UI), use an event bus pattern (you already have `PromptInsertionBusContext` — generalize it) rather than adding more shared context.

---

## Priority Order

| Priority | Action | Risk | Effort | Payoff |
|----------|--------|------|--------|--------|
| 1 | Extract GenerationsPanel → `features/generations/` | Low | 2-3 days | Unblocks independent generation UI iteration |
| 2 | Extract GenerationControlsStore → `features/generation-controls/` | Low | 1-2 days | Clarifies state ownership |
| 3 | Delete dead code (VideoConceptBuilder, PromptEnhancementEditor, orphaned services) | None | 0.5 day | Reduces 60+ files of noise |
| 4 | Remove ToolSidebar domain override pattern | Low | 1-2 days | Eliminates adapter complexity |
| 5 | Split PromptStateContext into focused contexts | Medium | 2-3 days | Fixes render performance, reduces cognitive load |
| 6 | Extract CanvasWorkspace → `features/workspace-shell/` | Medium | 1-2 days | Completes workspace decomposition |
| 7 | Extract sequence editing → `features/sequence-editor/` | Medium | 2-3 days | Isolates multi-shot concerns |
| 8 | Finish root services/hooks/api migration | Low | 1 day | Removes stalled migration artifacts |

---

## Appendix: Dependency Graph (Current)

```
                    ┌──────────────────────────────────────────┐
                    │         prompt-optimizer (GOD FEATURE)    │
                    │                                          │
                    │  ┌─────────────┐  ┌──────────────────┐  │
                    │  │PromptCanvas │  │GenerationsPanel  │  │
                    │  │  49 files   │  │    50 files       │  │
                    │  └─────────────┘  └──────────────────┘  │
                    │  ┌─────────────┐  ┌──────────────────┐  │
                    │  │CanvasWork-  │  │  8 Contexts      │  │
                    │  │ space 26f   │  │  28 files         │  │
                    │  └─────────────┘  └──────────────────┘  │
                    │  ┌─────────────────────────────────────┐ │
                    │  │  components/ (71 files, 14 groups)  │ │
                    │  └─────────────────────────────────────┘ │
                    └──────────┬───────────────────────────────┘
                               │ imports from
          ┌────────────────────┼────────────────────┐
          ▼                    ▼                    ▼
   ┌──────────┐    ┌────────────────┐    ┌──────────────┐
   │ span-    │    │  convergence   │    │   assets     │
   │highlight │    │   30 files     │    │  26 files    │
   │ 49 files │    └────────────────┘    └──────────────┘
   └──────────┘
   ┌──────────┐    ┌────────────────┐    ┌──────────────┐
   │ preview  │    │ continuity     │    │model-intel   │
   │ 14 files │    │  23 files      │    │  27 files    │
   └──────────┘    └────────────────┘    └──────────────┘
   ┌──────────┐    ┌────────────────┐
   │ billing  │    │   history      │
   │  9 files │    │   11 files     │
   └──────────┘    └────────────────┘

       ┌───────────────────────────────────────┐
       │  ToolSidebar (58 files)               │
       │  Reads from prompt-optimizer contexts  │
       │  via 5 domain adapter interfaces       │
       └───────────────────────────────────────┘
```

## Appendix: Dependency Graph (Proposed)

```
                    ┌─────────────────────────────────────┐
                    │      workspace-shell (layout)       │
                    │  Composes features via props/events  │
                    └──────────┬──────────────────────────┘
                               │
          ┌────────────────────┼────────────────────┐
          ▼                    ▼                    ▼
   ┌──────────────┐  ┌─────────────────┐  ┌──────────────────┐
   │prompt-editor  │  │  generations    │  │generation-controls│
   │ ~100 files    │  │  ~55 files      │  │  ~30 files        │
   │ 2-3 contexts  │  │  1-2 contexts   │  │  1 context        │
   └──────────────┘  └─────────────────┘  └──────────────────┘
          │
   ┌──────┴──────┐
   ▼             ▼
┌────────┐ ┌──────────┐   ┌──────────────┐  ┌──────────────┐
│span-   │ │sequence- │   │ convergence  │  │   assets     │
│highlight│ │editor    │   │  30 files    │  │  26 files    │
│49 files│ │ ~20 files │   └──────────────┘  └──────────────┘
└────────┘ └──────────┘

       ┌───────────────────────────────────────┐
       │  ToolSidebar (~30 files, simplified)  │
       │  Panel router, no adapter layer        │
       │  Features own their panel components   │
       └───────────────────────────────────────┘
```
