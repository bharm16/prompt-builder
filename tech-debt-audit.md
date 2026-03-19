# Vidra Tech Debt Audit — March 18, 2026

## Executive Summary

Overall codebase health is **good** — ESM compliance is solid, DI is clean, shared layer is pure, and no abandoned dependencies exist. The major debt lives in three areas: **type system gaps** (376 `as unknown` casts), **oversized files** in the prompt-optimizer and enhancement subsystems, and **cross-feature coupling** where `prompt-optimizer` imports from 5+ sibling features without an anti-corruption layer.

Test coverage sits at **40.42%** overall, with two services (`quality-feedback`, `reference-images`) at **0%**.

---

## Prioritized Debt Items

### Priority scoring: (Impact + Risk) × (6 − Effort)

| # | Item | Category | Impact | Risk | Effort | Score | Phase |
|---|------|----------|--------|------|--------|-------|-------|
| 1 | Zero test coverage: `quality-feedback` (408 lines) and `reference-images` (260 lines) | Test | 4 | 5 | 2 | **36** | 1 |
| 2 | Cross-feature coupling: `prompt-optimizer` imports types from 5+ sibling features | Architecture | 5 | 4 | 4 | **18** | 2 |
| 3 | Type system debt: 376 `as unknown` + 127 `as any` casts across server services | Code | 4 | 3 | 4 | **14** | 2–3 |
| 4 | `ModelRecommendationDropdown.tsx` (706 lines) — monolithic component | Code | 3 | 3 | 2 | **24** | 1 |
| 5 | `SuggestionValidationService.ts` (1152 lines) — single validation monolith | Code | 3 | 3 | 3 | **18** | 2 |
| 6 | `sessions.routes.ts` (594 lines) — multiple concerns in one route handler | Code | 3 | 3 | 3 | **18** | 2 |
| 7 | `SessionsPanel.tsx` (600 lines) — list + create + edit in one component | Code | 3 | 2 | 2 | **20** | 1 |
| 8 | `PromptCanvas.tsx` (1125 lines) — presentation + state management mixed | Code | 4 | 3 | 4 | **14** | 3 |
| 9 | Duplicate API modules (`billingApi`, `enhancementSuggestionsApi`) | Code | 2 | 2 | 1 | **20** | 1 |
| 10 | Low `asset` service coverage (28.49%) | Test | 3 | 4 | 3 | **21** | 1 |
| 11 | Vitest config sprawl (5 configs, some likely redundant) | Infra | 1 | 1 | 1 | **10** | 3 |
| 12 | `gliner@0.0.19` pre-1.0 dependency | Dependency | 2 | 3 | 5 | **5** | 3 |

---

## Phase 1: Quick Wins (1–2 sprints)

These are high-score, low-effort items you can slot alongside feature work.

### 1.1 Add tests for zero-coverage services (Score: 36)

**quality-feedback** and **reference-images** are production services with zero tests. One bad deploy and you won't know until users report it.

- `server/src/services/quality-feedback/` — 408 lines, 2 subdirectories
- `server/src/services/reference-images/` — 260 lines

**Action**: Write happy-path + error-path unit tests. Target 70% statement coverage for both. ~2 days.

### 1.2 Decompose `ModelRecommendationDropdown.tsx` (Score: 24)

706 lines mixing model selection logic, comparison UI, dropdown state, and cost calculation. This is the single worst SRP violation on the client side.

**Action**: Extract `ModelComparisonView.tsx`, `CostDisplay.tsx`, and a `useModelSelection.ts` hook. ~1 day.

### 1.3 Improve `asset` service coverage (Score: 21)

28.49% coverage on a service that handles user uploads and storage — a high-risk surface area.

**Action**: Add tests for upload, transform, and deletion paths. Target 65%. ~2 days.

### 1.4 Consolidate duplicate API modules (Score: 20)

`client/src/api/billingApi.ts` is a 12-line re-export of `client/src/features/billing/api/billingApi.ts`. `enhancementSuggestionsApi.ts` exists in both `/api/` and `/features/prompt-optimizer/api/` with different abstractions.

**Action**: Delete root-level re-exports. Update imports to point at feature-scoped files. Update CLAUDE.md to document convention: feature-scoped APIs are canonical, root `/api/` is for cross-feature shared clients only. ~0.5 days.

### 1.5 Split `SessionsPanel.tsx` (Score: 20)

600 lines combining session list, creation form, and editing logic.

**Action**: Extract `SessionList.tsx`, `CreateSessionDialog.tsx`, and `useSessionEditor.ts`. ~1 day.

---

## Phase 2: Structural Improvements (2–4 sprints)

These require more coordination but address the biggest architectural risks.

### 2.1 Break cross-feature coupling in `prompt-optimizer` (Score: 18)

`prompt-optimizer` directly imports types from `span-highlighting`, `convergence`, `continuity`, and others. 329 cross-feature imports found total. This makes it impossible to evolve features independently.

**Action**: Move shared types (`HighlightSpan`, `CameraPath`, `ContinuitySession`) to `shared/types/`. Features should only depend on the shared contract layer, never on each other's internals. Biggest bang-for-buck refactor in the codebase. ~1 week.

### 2.2 Decompose `SuggestionValidationService.ts` (Score: 18)

1152 lines of validation logic in a single service. This is the server equivalent of the ModelRecommendationDropdown problem.

**Action**: Extract validation strategies into domain-specific validators (e.g., `PromptCoherenceValidator`, `DuplicateValidator`, `QualityValidator`). The orchestrator should just coordinate. ~3 days.

### 2.3 Decompose `sessions.routes.ts` (Score: 18)

594 lines handling session CRUD, state management, and business logic in route handlers. Routes should be thin.

**Action**: Extract business logic into a `SessionRouteHandlers` module or push it into `SessionService`. Routes should validate input, call service, return response. ~2 days.

### 2.4 Address type system debt — server services (Score: 14)

290 `as unknown` casts in server code, concentrated in `enhancement/` (40+), `video-prompt-analysis/` (30+), `continuity/` (25+), and `span-labeling/` (20+). Plus 121 `as any` casts.

**Action**: Start with the enhancement service — define proper response types for LLM provider outputs and validate with Zod at the boundary. This will cascade improvements. Tackle one service domain per sprint. ~4 sprints total.

---

## Phase 3: Long-Tail Cleanup (Ongoing)

### 3.1 `PromptCanvas.tsx` (1125 lines)

The biggest client file. Mixes presentation, state management, and event handling. Worth addressing but the blast radius is large — this is a core interactive component.

**Action**: Extract canvas interaction hooks, state management, and rendering into separate modules. Plan carefully; test first. ~1 week.

### 3.2 Vitest config consolidation

5 vitest configs where 2–3 would suffice. `vitest.config.js` (142 lines) may be legacy.

**Action**: Audit which configs are actually used by npm scripts. Merge or delete unused ones. ~0.5 days.

### 3.3 Monitor `gliner@0.0.19`

Pre-1.0 dependency used in 14 files for NLP span labeling. API could break on any minor version bump. No action needed now, but track releases and pin tightly.

---

## What's NOT Debt

A few things that look like debt but aren't:

- **`glinerWorker.js` not being TypeScript**: Intentional. Worker threads bypass the tsx loader. Documented justification is correct.
- **`__dirname` usage in 7 files**: All use the proper `import.meta.url` + `fileURLToPath` pattern. ESM compliant.
- **Large test files (700+ lines)**: Comprehensive test suites for complex services. Size is justified.
- **91 DI registrations**: The container is clean and domain-scoped. This isn't over-engineered; it's appropriate for the service count.
- **2,096 try/catch blocks**: Server error handling is mostly consistent via centralized `errorHandler.ts` with DomainError abstraction. Minor inconsistencies exist but not worth a focused cleanup.

---

## Metrics Snapshot

| Metric | Value |
|--------|-------|
| Overall test coverage | 40.42% |
| Files > 300 lines (client) | 76 |
| Files > 300 lines (server) | 146 |
| `as unknown` casts | 376 |
| `as any` casts | 127 |
| Cross-feature imports | 329 |
| Zero-coverage services | 2 |
| Production dependencies | 59 |
| Dev dependencies | 54 |
| TODO/FIXME/HACK markers | 1 |
