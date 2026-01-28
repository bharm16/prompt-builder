# Features Analysis: SRP/SOC Violations

## Analysis Summary

Analyzed `client/src/features/*/` for files >150 lines not already in a refactored structure.

### Files Analyzed

| File | Lines | Status |
|------|-------|--------|
| `prompt-optimizer/PromptCanvas.tsx` | 524 | ✅ NO VIOLATION |
| `history/HistorySidebar.tsx` | 486 | ⚠️ VIOLATION |
| `prompt-optimizer/PromptOptimizerContainer/PromptOptimizerContainer.tsx` | 424 | ✅ NO VIOLATION |
| `prompt-optimizer/PromptOptimizerContainer/PromptOptimizerWorkspace.tsx` | 341 | ✅ NO VIOLATION |
| `prompt-optimizer/PromptInput.tsx` | 209 | ✅ NO VIOLATION |
| `span-highlighting/hooks/useSpanLabeling.ts` | 458 | ✅ NO VIOLATION (already refactored) |
| `span-highlighting/hooks/useHighlightRendering.ts` | 305 | ✅ NO VIOLATION |
| `span-highlighting/utils/anchorRanges.ts` | 314 | ✅ NO VIOLATION |
| `span-highlighting/utils/highlightConversion.ts` | 264 | ✅ NO VIOLATION |
| `prompt-optimizer/PromptOptimizerContainer/hooks/useUndoRedo.ts` | 325 | ✅ NO VIOLATION |
| `prompt-optimizer/PromptOptimizerContainer/hooks/useSuggestionFetch.ts` | 209 | ✅ NO VIOLATION |
| `prompt-optimizer/PromptOptimizerContainer/hooks/useConceptBrainstorm.ts` | 196 | ✅ NO VIOLATION |
| `prompt-optimizer/PromptOptimizerContainer/hooks/usePromptLoader.ts` | 169 | ✅ NO VIOLATION |
| `prompt-optimizer/PromptCanvas/hooks/useTextSelection.ts` | 187 | ✅ NO VIOLATION |
| `prompt-optimizer/SpanBentoGrid/hooks/useSpanGrouping.ts` | 241 | ✅ NO VIOLATION |
| `span-highlighting/hooks/useDebouncedValidation.ts` | 158 | ✅ NO VIOLATION |

---

## Detailed Analysis

### 1. PromptCanvas.tsx (524 lines) - NO VIOLATION

**Responsibilities Found:**
- UI Rendering (JSX orchestration) - lines 300-524
- Hook coordination - lines 70-250

**Analysis:**
This file is an **orchestrator component** that follows the established pattern. It:
- Delegates state management to extracted hooks (`useSpanDataConversion`, `useSuggestionDetection`, `useParseResult`, `useTextSelection`, `useEditorContent`, `useKeyboardShortcuts`)
- Delegates API calls to `useSpanLabeling`
- Delegates business logic to utility functions
- Only contains JSX rendering and hook wiring

**Why NOT a violation:**
The file does ONE thing well: orchestrate the PromptCanvas feature by wiring together specialized hooks and rendering the UI. All complex logic has already been extracted to the `PromptCanvas/hooks/` directory. The remaining code is pure orchestration and JSX.

---

### 2. HistorySidebar.tsx (486 lines) - VIOLATION

**Responsibilities Found:**
1. **UI Rendering** (lines 220-486): Main sidebar JSX, collapsed/expanded states
2. **State Management** (lines 230-250): Local state for `showAllHistory`, auth menu state
3. **API/Data Fetching** (lines 255-285): `handleSignIn`, `handleSignOut` with Firebase auth
4. **Business Logic** (lines 240-250): History filtering, display limit logic
5. **Sub-components** (lines 25-130): `HistoryItem` and `AuthMenu` components defined inline

**Reasons to Change:**
- **UI Designer**: Would change layout, styling, collapsed/expanded behavior
- **Auth Team**: Would change sign-in/sign-out flow, auth provider integration
- **Product Team**: Would change history display logic, filtering, limits

**Recommended Split:**
```
features/history/
├── HistorySidebar.tsx           // Main orchestrator (~250 lines)
├── index.ts                     // Barrel exports
├── types.ts                     // Props, interfaces (if needed)
└── components/
    ├── HistoryItem.tsx          // Memoized history item (~80 lines)
    └── AuthMenu.tsx             // Auth menu component (~60 lines)
```

**What to extract:**
- `HistoryItem` - Memoized, genuinely reusable, can be tested independently
- `AuthMenu` - Auth is a distinct concern, could be reused elsewhere

**What to keep in main component:**
- Collapsed/expanded states - These are just two rendering states of the same component
- Auth handlers (`handleSignIn`, `handleSignOut`) - Too small for a separate hook (~10 lines)
- Display limit logic - Too small for a utils file (~5 lines)

**Justification:**
- Extract only what has genuine independent reasons to change
- Don't create files for less than ~50 lines unless genuinely reused elsewhere
- 4 files instead of 9 - pragmatic split that improves cohesion without over-engineering

---

### 3. PromptOptimizerContainer.tsx (424 lines) - NO VIOLATION

**Responsibilities Found:**
- Hook coordination - lines 40-200
- UI Rendering (JSX) - lines 220-350

**Analysis:**
This file is already a well-structured **orchestrator component**. It:
- Delegates ALL business logic to extracted hooks (`usePromptLoader`, `useHighlightsPersistence`, `useUndoRedo`, `usePromptOptimization`, `useImprovementFlow`, `useConceptBrainstorm`, `useEnhancementSuggestions`)
- Uses context for state management (`usePromptState`)
- Only contains hook wiring and JSX rendering

**Why NOT a violation:**
The file explicitly states it's an orchestrator and follows the pattern perfectly. All complex logic lives in `PromptOptimizerContainer/hooks/`. The remaining code is pure coordination.

---

### 4. PromptOptimizerWorkspace.tsx (341 lines) - NO VIOLATION

**Analysis:**
Nearly identical structure to `PromptOptimizerContainer.tsx`. This appears to be an alternative layout implementation using the same hook delegation pattern.

**Why NOT a violation:**
Same reasoning as above - it's an orchestrator that delegates to specialized hooks.

---

### 5. PromptInput.tsx (209 lines) - NO VIOLATION

**Responsibilities Found:**
- UI Rendering (JSX) - lines 100-209
- Sub-component (`ModeDropdown`) - lines 15-95

**Analysis:**
This file contains:
- A memoized `ModeDropdown` component (80 lines)
- A `PromptInput` component (110 lines)

**Why NOT a violation:**
Both components serve the same concern: prompt input UI. The `ModeDropdown` is tightly coupled to `PromptInput` and always changes together. Splitting would create unnecessary indirection without improving cohesion.

---

### 6. useSpanLabeling.ts (458 lines) - NO VIOLATION (Already Refactored)

**Analysis:**
This hook is explicitly documented as an **orchestrator hook** that coordinates:
- `SpanLabelingApi` for API calls
- `spanLabelingCache` for caching
- `spanLabelingScheduler` for scheduling/debouncing
- `spanLabelingErrorHandler` for error handling
- `spanLabelingResultEmitter` for result emission

**Why NOT a violation:**
The file header explicitly states "Single Responsibility: Orchestrate the span labeling workflow". All implementation details are delegated to specialized modules in `utils/` and `api/`. This is the correct pattern.

---

### 7. useHighlightRendering.ts (305 lines) - NO VIOLATION

**Responsibilities Found:**
- DOM manipulation for highlight rendering - entire file

**Analysis:**
This hook does ONE thing: manage DOM manipulation for applying highlight spans. It contains:
- Diff-based rendering logic
- Performance optimization
- Span tracking

**Why NOT a violation:**
All code serves the single purpose of rendering highlights efficiently. The complexity comes from the DOM manipulation requirements, not from mixing concerns.

---

### 8. anchorRanges.ts (314 lines) - NO VIOLATION

**Responsibilities Found:**
- Text node indexing and range mapping - entire file

**Analysis:**
This utility file provides pure functions for:
- Building text node indices
- Mapping global ranges to DOM
- Wrapping range segments

**Why NOT a violation:**
All functions serve the single purpose of anchoring text ranges to DOM nodes. This is a cohesive utility module.

---

### 9. highlightConversion.ts (264 lines) - NO VIOLATION

**Responsibilities Found:**
- Converting LLM spans to highlight objects - entire file

**Analysis:**
This utility file provides:
- Role normalization
- Category mapping
- Span merging
- Highlight object creation

**Why NOT a violation:**
All code serves the single purpose of converting LLM output to highlight data structures. The functions are cohesive and change together.

---

### 10. useUndoRedo.ts (325 lines) - NO VIOLATION

**Responsibilities Found:**
- Undo/redo state management - entire file

**Analysis:**
This hook manages:
- Undo/redo stacks
- Edit grouping logic
- Snapshot creation
- History navigation

**Why NOT a violation:**
All code serves the single purpose of managing undo/redo functionality. The complexity comes from smart edit grouping, not from mixing concerns.

---

### 11. useSuggestionFetch.ts (209 lines) - NO VIOLATION

**Analysis:**
This hook does ONE thing: fetch enhancement suggestions. It's already extracted from a larger file and follows the single responsibility pattern.

---

### 12. useConceptBrainstorm.ts (196 lines) - NO VIOLATION

**Analysis:**
This hook manages the video concept brainstorm flow. It's a focused hook that handles concept completion and skip logic.

---

### 13. usePromptLoader.ts (169 lines) - NO VIOLATION

**Analysis:**
This hook loads prompts from URL parameters. It's a focused hook with a single responsibility.

---

### 14. useTextSelection.ts (187 lines) - NO VIOLATION

**Analysis:**
This hook handles text selection and highlight interaction. It's already extracted from PromptCanvas and follows the single responsibility pattern.

---

### 15. useSpanGrouping.ts (241 lines) - NO VIOLATION

**Analysis:**
This hook groups spans by category with hierarchical awareness. All code serves the single purpose of span grouping logic.

---

## Summary

| Category | Count |
|----------|-------|
| Files Analyzed | 16 |
| Violations Found | 1 |
| Already Well-Structured | 15 |

### Violations to Refactor

1. **HistorySidebar.tsx** - Contains inline sub-components, auth logic, and mixed UI concerns

### Files Skipped (Already in Refactored Structure)

The following directories are already well-organized:
- `span-highlighting/` - Full modular structure with hooks/, api/, utils/, services/, config/
- `prompt-optimizer/PromptCanvas/` - Extracted hooks and utils
- `prompt-optimizer/PromptOptimizerContainer/` - Extracted hooks
- `prompt-optimizer/SpanBentoGrid/` - Extracted hooks, components, config, utils
- `preview/` - Full modular structure with api/, components/, hooks/

### Notes

Most feature files in this codebase are already well-structured following the orchestrator pattern. The `span-highlighting` and `prompt-optimizer` features have been extensively refactored with proper separation of concerns.
