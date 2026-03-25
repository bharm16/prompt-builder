# Client Tech Debt Audit — March 2026

## Executive Summary

The Vidra frontend is well-architected. Feature isolation is clean, API calls live in dedicated layers, Tailwind is used consistently with no inline styles, code splitting is proper, and there are zero `.js` files or `@ts-ignore` directives. The debt that exists is concentrated in two areas: **state management escalation** in the prompt canvas area (excessive `useState` calls that should be `useReducer`) and **missing Zod validation** at several API boundaries where responses are type-asserted instead of validated.

---

## Prioritized Items

Items scored using: **Priority = (Impact + Risk) × (6 − Effort)**

### 1. `ShotEditor.tsx` with 17 `useState` calls

| Dimension | Score |
| --------- | ----- |
| Impact    | 4     |
| Risk      | 4     |
| Effort    | 2     |

**Priority: 32**

`client/src/features/continuity/components/ShotEditor/ShotEditor.tsx` has 17 `useState` calls — the most in the codebase. This is a complex state machine being managed with individual booleans and values. Bugs from stale state combinations are near-inevitable.

**Remediation:** Extract into a `useReducer` with discriminated union actions. The state transitions are already implicit in the component logic — making them explicit in a reducer is a mechanical refactoring.

---

### 2. Unvalidated API responses (type assertions instead of Zod)

| Dimension | Score |
| --------- | ----- |
| Impact    | 3     |
| Risk      | 4     |
| Effort    | 2     |

**Priority: 28**

Several API files use `as CoherenceCheckResult` or raw `.json()` without Zod validation, violating the codebase convention. This means a server-side response shape change silently breaks the client at runtime instead of failing at the boundary.

**Key files:**

- `features/prompt-optimizer/api/coherenceCheckApi.ts` — type assertion only, no Zod
- `features/continuity/api/continuityApi.ts` — uses `z.any()` for `primaryStyleReference` and `sceneProxy`
- `features/assets/api/assetApi.ts` — 10+ unvalidated `.json()` calls
- `features/reference-images/api/referenceImageApi.ts` — unvalidated JSON parsing
- `features/prompt-optimizer/api/i2vApi.ts` — multiple `.json()` calls without schemas

**Remediation:** Add Zod schemas for each response type. The pattern already exists in `features/preview/api/` and `features/span-highlighting/api/` — copy that.

---

### 3. `any` types in PromptCanvas hooks (13 instances)

| Dimension | Score |
| --------- | ----- |
| Impact    | 3     |
| Risk      | 3     |
| Effort    | 2     |

**Priority: 24**

Three PromptCanvas hooks use `any` for props that should have proper types:

- `useCanvasCoherence.ts` — 7 props typed as `any` (coherenceIssues, callbacks, booleans)
- `useCanvasI2V.ts` — 3 props typed as `any` (i2vContext, alternatives, click handler)
- `useCanvasGenerations.ts` — 1 instance (`[key: string]: any`)
- `SuggestionRequestManager.ts` — 1 instance (`Map<string, CacheEntry<any>>`)

**Remediation:** These hooks are adapter layers between PromptCanvas and feature-specific contexts. The types already exist in the source contexts — thread them through instead of using `any`.

---

### 4. `CameraMotionOption.tsx` with 9 `useState` calls

| Dimension | Score |
| --------- | ----- |
| Impact    | 3     |
| Risk      | 3     |
| Effort    | 2     |

**Priority: 24**

`client/src/features/convergence/components/CameraMotionPicker/CameraMotionOption.tsx` (612 lines) manages selection state, hover state, preview state, and animation state through 9 independent `useState` calls.

**Remediation:** Extract into a `useReducer` that models the component's state machine explicitly (idle → hovering → previewing → selected).

---

### 5. Features missing `api/` directories

| Dimension | Score |
| --------- | ----- |
| Impact    | 2     |
| Risk      | 3     |
| Effort    | 1     |

**Priority: 25**

Five feature directories lack the required `api/` subdirectory:

- `features/billing/` — API calls likely inline or in parent
- `features/convergence/` — uses motion API from `client/src/api/` (shared, not feature-scoped)
- `features/generation/` — appears to be an empty/stub feature directory
- `features/history/` — no dedicated API layer
- `features/video-template/` — no dedicated API layer

**Remediation:** Create `api/` directories for features that make server calls. For thin features that don't make their own calls, document that they're presentation-only.

---

### 6. Untested shared hooks (9 hooks)

| Dimension | Score |
| --------- | ----- |
| Impact    | 3     |
| Risk      | 3     |
| Effort    | 3     |

**Priority: 18**

Nine top-level hooks under `client/src/hooks/` have no test coverage:

- `usePromptOptimizer.ts` — core optimizer orchestration
- `usePromptOptimizerState.ts` — state management for optimizer
- `usePromptOptimizerApi.ts` — API interaction layer
- `useCreditGate.ts` — credit balance checks before actions
- `useUserCreditBalance.ts` — real-time credit balance
- `usePromptDebugger.ts` / `usePromptDebuggerApi.ts` / `usePromptDebuggerUtils.ts` — debugger tools
- `useDebugLogger.tsx` — debug logging

**Remediation:** Prioritize `useCreditGate.ts` and `usePromptOptimizer.ts` — these gate user-facing actions and are high-value regression targets. The debugger hooks are lower priority.

---

### 7. Untested shared components (13 components)

| Dimension | Score |
| --------- | ----- |
| Impact    | 2     |
| Risk      | 2     |
| Effort    | 3     |

**Priority: 12**

Thirteen root-level components in `client/src/components/` lack tests:

Settings, LoadingDots, ContextPreviewBadge, DebugButton, ModelSelectorDropdown, VideoConceptBuilder, QualityScore, QuickActions, KeyboardShortcuts, Toast, EmptyState, SharedPrompt, PromptEnhancementEditor.

**Remediation:** Prioritize `VideoConceptBuilder` (572 lines, core flow), `SharedPrompt` (uses `dangerouslySetInnerHTML`), and `ModelSelectorDropdown` (user-facing selection). The rest are simple presentational components.

---

### 8. `console.log` in auth pages

| Dimension | Score |
| --------- | ----- |
| Impact    | 1     |
| Risk      | 2     |
| Effort    | 1     |

**Priority: 15**

`SignInPage.tsx` and `SignUpPage.tsx` have `console.*` calls that should go through `LoggingService.ts` (which already exists and is used elsewhere).

**Remediation:** Replace with LoggingService calls. One-line changes.

---

## What's Working Well

- **Zero inline styles.** All styling is Tailwind — no `style={{}}` anywhere in the codebase.
- **Clean code splitting.** 20 lazy-loaded routes via `React.lazy`, plus manual Vite chunks for vendor-react, vendor-ui, vendor-firebase, vendor-icons.
- **Zero `.js` files** in client/src. Full TypeScript coverage.
- **Zero `@ts-ignore`/`@ts-nocheck`.** Type suppression discipline is strong.
- **API layer separation is solid.** No `fetch()` calls in components — all in `api/` directories.
- **No server imports.** The client/server boundary is clean.
- **CSS is minimal and disciplined.** One 261-line `index.css` with only legitimate custom animations and CSS variables. Two `!important` uses, both in reduced-motion media queries.
- **Config centralization.** API endpoints, timeouts, feature flags, and model definitions all live in `client/src/config/`.

---

## Phased Remediation Plan

### Phase 1 — Quick wins (1-2 days)

- [ ] Replace `console.*` in `SignInPage.tsx` and `SignUpPage.tsx` with `LoggingService`
- [ ] Replace `z.any()` in `continuityApi.ts` with proper Zod schemas
- [ ] Fix 13 `any` types in `useCanvasCoherence.ts`, `useCanvasI2V.ts`, `useCanvasGenerations.ts`

### Phase 2 — Boundary hardening (1 sprint)

- [ ] Add Zod schemas to `coherenceCheckApi.ts`, `assetApi.ts`, `referenceImageApi.ts`, `i2vApi.ts`
- [ ] Create `api/` directories for `billing/`, `history/`, `video-template/` features (or document as presentation-only)
- [ ] Add tests for `useCreditGate.ts` and `usePromptOptimizer.ts`

### Phase 3 — State management cleanup (when touching these files)

- [ ] Refactor `ShotEditor.tsx` (17 useState → useReducer)
- [ ] Refactor `CameraMotionOption.tsx` (9 useState → useReducer)
- [ ] Add tests for `VideoConceptBuilder`, `SharedPrompt`, `ModelSelectorDropdown`
