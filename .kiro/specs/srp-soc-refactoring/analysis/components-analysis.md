# SRP/SOC Analysis: client/src/components/

## Analysis Summary

Analyzed 12 non-directory component files over 150 lines in `client/src/components/`.

### Files Analyzed

| File | Lines | Status |
|------|-------|--------|
| VideoConceptBuilder.tsx | 574 | ✅ Already refactored - SKIP |
| QualityScore.tsx | 393 | ✅ Single responsibility - NO VIOLATION |
| Settings.tsx | 374 | ⚠️ VIOLATION - Mixed concerns |
| Button.tsx | 352 | ✅ Single responsibility - NO VIOLATION |
| PromptEnhancementEditor.tsx | 315 | ⚠️ VIOLATION - Mixed concerns |
| EmptyState.tsx | 280 | ✅ Single responsibility - NO VIOLATION |
| KeyboardShortcuts.tsx | 272 | ⚠️ VIOLATION - Mixed concerns |
| SharedPrompt.tsx | 248 | ⚠️ VIOLATION - Mixed concerns |
| Toast.tsx | 194 | ✅ Single responsibility - NO VIOLATION |
| ContextPreviewBadge.tsx | 179 | ✅ Single responsibility - NO VIOLATION |
| DebugButton.tsx | 173 | ✅ Single responsibility - NO VIOLATION |
| QuickActions.tsx | 160 | ✅ Single responsibility - NO VIOLATION |

---

## Files Skipped (Already Refactored or Single Responsibility)

### VideoConceptBuilder.tsx (574 lines) - SKIP
**Reason**: Already refactored. The file header explicitly states it's "~300 lines (down from 1925 lines)" and follows proper separation of concerns. It imports from a well-organized `VideoConceptBuilder/` directory structure with hooks, api, utils, config, and components subdirectories. This is the orchestration component pattern - it coordinates but delegates.

### QualityScore.tsx (393 lines) - NO VIOLATION
**Responsibilities**: UI Rendering only
**Analysis**: This component does ONE thing well - it renders a quality score visualization. The helper functions (`getScoreColor`, `getScoreLabel`, `getScoreFactors`) are pure functions that support the single rendering responsibility. The animation effect is intrinsic to the UI rendering concern. No API calls, no complex state management beyond display state.

### Button.tsx (352 lines) - NO VIOLATION
**Responsibilities**: UI Rendering only
**Analysis**: This is a design system component that renders buttons with various variants. The file contains two related components (`Button` and `ButtonLink`) that share the same styling logic. All code serves the single purpose of rendering styled buttons. The length comes from comprehensive variant handling, not mixed responsibilities.

### EmptyState.tsx (280 lines) - NO VIOLATION
**Responsibilities**: UI Rendering only
**Analysis**: This is a presentational component with configuration data. The `emptyStateConfig` object is static configuration that supports the rendering. The specialized variants (`HistoryEmptyState`, `SearchEmptyState`, etc.) are thin wrappers that provide preset configurations. All code serves the single purpose of rendering empty states.

### Toast.tsx (194 lines) - NO VIOLATION
**Responsibilities**: State Management + UI Rendering (cohesive)
**Analysis**: This implements the Toast notification system with Context API. While it has state management and UI rendering, these are tightly coupled and represent a single cohesive concern - the toast notification system. Splitting would harm cohesion as the state and UI always change together.

### ContextPreviewBadge.tsx (179 lines) - NO VIOLATION
**Responsibilities**: UI Rendering only
**Analysis**: Contains three related presentational components (`ContextPreviewBadge`, `ContextIndicatorBanner`, `ContextFieldTag`) that all serve the same purpose - displaying context information. These are cohesive and should stay together.

### DebugButton.tsx (173 lines) - NO VIOLATION
**Responsibilities**: UI Rendering only
**Analysis**: This is a debug utility component. It renders debug buttons and delegates actual debug logic to the `usePromptDebugger` hook. The inline styles are part of the rendering concern. Single responsibility.

### QuickActions.tsx (160 lines) - NO VIOLATION
**Responsibilities**: UI Rendering only
**Analysis**: Presentational component that renders quick action cards. The `categories` configuration is static data supporting the rendering. Single responsibility.

---

## Violations Found

### 1. Settings.tsx (374 lines) - VIOLATION

**Responsibilities Found:**
1. **State Management** (lines 24-73): `useSettings` hook with localStorage persistence
2. **UI Rendering** (lines 76-374): Settings panel component with modal UI

**Reasons to Change:**
- State management logic would change if: storage mechanism changes (localStorage → IndexedDB), settings schema changes, persistence strategy changes
- UI rendering would change if: design system updates, new settings sections added, modal behavior changes

**Stakeholders:**
- State management: Backend/data team, settings schema owners
- UI rendering: Design team, UX team

**Reuse Verification:** ✅ `useSettings` IS used elsewhere:
- `client/src/features/prompt-optimizer/components/PromptModals.tsx` imports and uses `useSettings`

**Recommended Split:**
```
Settings/
├── Settings.tsx           // UI rendering only
├── index.ts               // Barrel export
├── types.ts               // AppSettings interface
└── hooks/
    └── useSettings.ts     // State management + localStorage
```

**Justification:**
The `useSettings` hook is already reused by `PromptModals.tsx`, confirming it's a shared piece of state management. It handles localStorage persistence which is a distinct concern from the modal UI. The settings UI could change independently (new sections, different layout) without affecting how settings are stored.

---

### 2. PromptEnhancementEditor.tsx (315 lines) - VIOLATION

**Responsibilities Found:**
1. **API/Data Fetching** (lines 134-207): `fetchEnhancementSuggestions` with fetch call, request building, response handling
2. **Business Logic** (lines 56-90): `extractMetadataFromSelection` - DOM traversal and metadata extraction
3. **State Management** (lines 47-55): Multiple useState hooks for selection, suggestions, loading states
4. **UI Rendering** (lines 260-280): Minimal JSX rendering
5. **Side Effects** (lines 117-132): useEffect for selection restoration and parent notification

**Reasons to Change:**
- API layer would change if: endpoint changes, request/response format changes, error handling strategy changes
- Business logic would change if: metadata extraction rules change, selection handling changes
- State management would change if: state shape changes, new states needed
- UI would change if: rendering approach changes, styling updates

**Stakeholders:**
- API: Backend team, API contract owners
- Business logic: Product team defining metadata rules
- UI: Design team

**Recommended Split:**
```
PromptEnhancementEditor/
├── PromptEnhancementEditor.tsx  // Orchestration + JSX
├── index.ts                      // Barrel export
├── types.ts                      // Interfaces
├── hooks/
│   └── useEnhancementEditor.ts   // State management
├── api/
│   └── enhancementApi.ts         // API calls
└── utils/
    └── selectionUtils.ts         // extractMetadataFromSelection
```

**Justification:**
The API fetching logic is substantial and could be reused. The metadata extraction is pure business logic that can be tested independently. The state management is complex enough to warrant extraction. This split allows each concern to evolve independently.

---

### 3. KeyboardShortcuts.tsx (272 lines) - VIOLATION

**Responsibilities Found:**
1. **Configuration** (lines 30-68): `SHORTCUTS` constant - static shortcut definitions
2. **UI Rendering** (lines 85-185): KeyboardShortcuts modal component
3. **Side Effects/Business Logic** (lines 188-272): `useKeyboardShortcuts` hook - event handling logic

**Reasons to Change:**
- Configuration would change if: new shortcuts added, shortcut keys changed
- UI would change if: modal design changes, shortcut display format changes
- Hook logic would change if: keyboard handling behavior changes, new shortcut types added

**Stakeholders:**
- Configuration: Product team defining shortcuts
- UI: Design team
- Hook: Feature developers adding new shortcuts

**Recommended Split:**
```
KeyboardShortcuts/
├── KeyboardShortcuts.tsx       // UI rendering only
├── index.ts                    // Barrel export
├── shortcuts.config.ts         // SHORTCUTS constant, formatShortcut
└── hooks/
    └── useKeyboardShortcuts.ts // Event handling hook
```

**Justification:**
The `useKeyboardShortcuts` hook is already exported and used elsewhere - it's a reusable piece of functionality. The shortcuts configuration is static data that could be shared. The UI component should only handle rendering. This split improves reusability and testability.

---

### 4. SharedPrompt.tsx (248 lines) - VIOLATION

**Responsibilities Found:**
1. **API/Data Fetching** (lines 35-82): `fetchPrompt` function with repository call, error handling
2. **Business Logic** (lines 84-92): `formattedOutput` memo with text formatting
3. **Business Logic** (lines 94-106): `handleCopy` clipboard logic
4. **Business Logic** (lines 108-116): `getModeLabel` mode mapping
5. **State Management** (lines 28-33): Multiple useState hooks
6. **UI Rendering** (lines 118-248): JSX for loading, error, and content states

**Reasons to Change:**
- Data fetching would change if: repository API changes, data shape changes
- Business logic would change if: formatting rules change, mode labels change
- UI would change if: design updates, layout changes

**Stakeholders:**
- Data fetching: Backend team, repository owners
- Business logic: Product team
- UI: Design team

**Recommended Split:**
```
SharedPrompt/
├── SharedPrompt.tsx          // Orchestration + JSX
├── index.ts                  // Barrel export
├── types.ts                  // PromptData, PromptMode types
├── hooks/
│   └── useSharedPrompt.ts    // Data fetching + state
└── utils/
    └── promptUtils.ts        // getModeLabel, formatting helpers
```

**Justification:**
The data fetching logic is substantial with error handling and context restoration. The utility functions (`getModeLabel`) are pure and reusable. Extracting these allows the component to focus on rendering while the hook handles data orchestration.

---

## Summary

| Category | Count |
|----------|-------|
| Files Analyzed | 12 |
| Already Refactored (Skip) | 1 |
| Single Responsibility (No Violation) | 7 |
| **Violations Found** | **4** |

### Violations to Refactor (Priority Order)

1. **PromptEnhancementEditor.tsx** - API + Business Logic + State + UI mixed (legitimate violation)
2. **SharedPrompt.tsx** - API + Business Logic + State + UI mixed (legitimate violation)
3. **KeyboardShortcuts.tsx** - Config + UI + Hook mixed (simplify structure - no nested config/)
4. **Settings.tsx** - Hook + UI mixed (verified: `useSettings` IS reused in PromptModals.tsx)
