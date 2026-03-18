# Server Tech Debt Audit — March 2026

## Executive Summary

The Vidra server codebase is in strong shape architecturally. DI patterns are consistent, the service layer follows established conventions, and error handling is structured. The debt that exists falls into three buckets: **dead dependencies**, **ESM violations**, and **test coverage gaps**. None are critical, but the test gaps on `video-concept/` (15 untested files) represent real regression risk.

---

## Prioritized Items

Items scored using: **Priority = (Impact + Risk) × (6 − Effort)**

### 1. Zero test coverage on `video-concept/` (15 files)

| Dimension | Score |
|-----------|-------|
| Impact | 5 |
| Risk | 5 |
| Effort | 4 (high — many files) |

**Priority: 20**

The entire `video-concept/` service directory has no tests. This includes the orchestrator (`VideoConceptService.ts`), scene completion, scene variation, conflict detection, prompt validation, compatibility checking, and more. This is your largest untested surface area and the guided wizard is a core user-facing flow.

**Files:**
- `server/src/services/video-concept/VideoConceptService.ts`
- `server/src/services/video-concept/services/SceneCompletionService.ts`
- `server/src/services/video-concept/services/SceneVariationService.ts`
- `server/src/services/video-concept/services/ConceptParsingService.ts`
- `server/src/services/video-concept/services/RefinementService.ts`
- `server/src/services/video-concept/services/ConflictDetectionService.ts`
- `server/src/services/video-concept/services/SceneChangeDetectionService.ts`
- `server/src/services/video-concept/services/SuggestionGeneratorService.ts`
- `server/src/services/video-concept/services/TechnicalParameterService.ts`
- `server/src/services/video-concept/services/PromptValidationService.ts`
- `server/src/services/video-concept/services/CompatibilityService.ts`
- `server/src/services/video-concept/services/PreferenceRepository.ts`
- `server/src/services/video-concept/services/VideoTemplateRepository.ts`
- Plus 2 config/index files

**Remediation:** Start with `ConflictDetectionService` and `PromptValidationService` — these are pure logic with clear inputs/outputs, easy to unit test, and high-value for catching regressions.

---

### 2. ESM violation: `require()` in production code

| Dimension | Score |
|-----------|-------|
| Impact | 3 |
| Risk | 4 |
| Effort | 2 |

**Priority: 28**

`server/src/routes/suggestions/rubrics.ts` uses `declare const require: NodeRequire` and calls `require()` to import a CommonJS module. This directly violates the monorepo's ESM-only constraint and will break under stricter Node ESM enforcement.

**Root cause:** `server/src/services/quality-feedback/config/judgeRubrics.js` is CommonJS.

**Related:** 5 `.js` files exist in the TypeScript server codebase that should be converted:
- `server/src/llm/span-labeling/nlp/glinerWorker.js` (worker_threads — may need to stay .js)
- `server/src/services/prompt-optimization/strategies/videoPromptOptimizationTemplate.js`
- `server/src/services/quality-feedback/config/judgeRubrics.js`
- `server/src/services/video-concept/config/descriptorCategories.js`
- `server/src/services/video-concept/index.js`

**Remediation:** Convert the 4 non-worker `.js` files to `.ts` with ESM exports. The gliner worker may need to stay as `.js` due to `worker_threads` constraints — add a comment explaining why.

---

### 3. Dead validation dependencies (`joi`, `express-validator`)

| Dimension | Score |
|-----------|-------|
| Impact | 2 |
| Risk | 3 |
| Effort | 1 |

**Priority: 25**

`joi` and `express-validator` are listed as dependencies but have zero imports anywhere in the codebase. Zod is the adopted standard and used throughout. These add install weight and version maintenance burden for nothing.

**Remediation:** `npm uninstall joi express-validator` — one commit, zero risk.

---

### 4. `Math.random()` for session/request IDs

| Dimension | Score |
|-----------|-------|
| Impact | 2 |
| Risk | 4 |
| Effort | 1 |

**Priority: 24**

27 instances of `Math.random()` across routes and services, including session ID generation in `ContinuitySessionService.ts`. `Math.random()` is not cryptographically secure and produces predictable values that could lead to session collisions or enumeration.

**Key files:**
- `server/src/services/continuity/ContinuitySessionService.ts`
- `server/src/routes/continuity/continuityRouteShared.ts`
- `server/src/routes/preview/handlers/imageGenerate.ts`
- `server/src/routes/preview/handlers/video-generate/refundManager.ts`

**Remediation:** Replace with `crypto.randomUUID()` (available natively in Node 20) for IDs, or `crypto.getRandomValues()` for numeric values. Quick mechanical change.

---

### 5. Large files exceeding SRP guidelines

| Dimension | Score |
|-----------|-------|
| Impact | 3 |
| Risk | 2 |
| Effort | 3 |

**Priority: 15**

Several files exceed the 500-line guideline for non-orchestrators:

| File | Lines | Assessment |
|------|-------|------------|
| `enhancement/services/SuggestionValidationService.ts` | 1,152 | Should split — validation has distinct concerns |
| `enhancement/EnhancementService.ts` | 924 | Orchestrator with 9 sub-services — acceptable but at limit |
| `clients/adapters/GroqLlamaAdapter.ts` | 922 | Adapter complexity — review for extraction |
| `enhancement/services/CleanPromptBuilder.ts` | 834 | Builder pattern — review if separable |
| `video-prompt-analysis/strategies/KlingStrategy.ts` | 826 | Strategy-specific — likely fine |
| `continuity/ContinuityShotGenerator.ts` | 784 | No refactoring summary — needs audit |

**Remediation:** Prioritize `SuggestionValidationService.ts` (1,152 lines) and `ContinuityShotGenerator.ts` (784 lines, no refactoring docs). The others are borderline and can wait.

---

### 6. Zero test coverage on 5 other service domains

| Dimension | Score |
|-----------|-------|
| Impact | 3 |
| Risk | 3 |
| Effort | 3 |

**Priority: 18**

| Service | Files | Risk Level |
|---------|-------|------------|
| `firestore/FirestoreCircuitExecutor.ts` | 1 | High — circuit breaker is critical for resilience |
| `idempotency/` | 1 | High — protects against duplicate video generation |
| `quality-feedback/` | 2 | Medium — LLM judge rubrics |
| `reference-images/` | 1 | Low |
| `taxonomy-validation/` | 5 | Medium — validation logic |

**Remediation:** `FirestoreCircuitExecutor` and `idempotency/` should be tested first — both protect against costly failure modes (cascading Firestore failures, duplicate generation charges).

---

### 7. 125 `any` types and 15 `@ts-ignore` directives

| Dimension | Score |
|-----------|-------|
| Impact | 2 |
| Risk | 2 |
| Effort | 3 |

**Priority: 12**

Most `any` usage is at DI boundaries and adapter layers where it's somewhat justified. The `@ts-ignore` directives are more concerning — they hide potential type errors silently.

**Remediation:** Audit `@ts-ignore` directives first (15 is manageable). Replace with `@ts-expect-error` where suppression is genuinely needed, or fix the underlying type issue. Tackle `any` types opportunistically during feature work.

---

### 8. Dependency overrides masking version conflicts

| Dimension | Score |
|-----------|-------|
| Impact | 1 |
| Risk | 3 |
| Effort | 2 |

**Priority: 16**

`onnxruntime-node` is pinned to 1.19.2, and `@xenova/transformers` / `@huggingface/transformers` have aggressive overrides. These usually indicate unresolved peer dependency conflicts that could surface as runtime errors after upgrades.

**Remediation:** Document why each override exists. Periodically test if the override is still needed. Low urgency but worth tracking.

---

## What's Working Well

These are worth calling out because they represent real investment that's paying off:

- **DI is clean.** Constructor injection everywhere, no `container.resolve()` leaking into services, circular dependency detection built into the container.
- **LLM access is gated.** All calls route through `AIModelService` — no direct provider client usage in business logic.
- **Error handling is structured.** `DomainError` base class with proper HTTP status mapping, PII redaction in the global error handler.
- **Environment validation is solid.** Zod-based env validation with production-specific refinements in `config/env.ts`.
- **Logging is consistent.** Pino used throughout, no `console.log` in production code.
- **Legacy cleanup is done.** The root-level `EnhancementService.ts` and `VideoConceptService.ts` have been properly refactored into domain directories with documented summaries.

---

## Phased Remediation Plan

### Phase 1 — Quick wins (1-2 days, do alongside feature work) ✅ COMPLETE

- [x] Remove `joi` and `express-validator` dependencies
- [x] Replace `Math.random()` with `crypto.randomUUID()` in session/request ID generation
- [x] Convert `judgeRubrics.js`, `descriptorCategories.js`, `videoPromptOptimizationTemplate.js`, and `video-concept/index.js` to TypeScript ESM
- [x] Remove the `require()` hack in `rubrics.ts`

### Phase 2 — Test coverage (spread across 2-3 sprints) ✅ COMPLETE

- [x] Add tests for `FirestoreCircuitExecutor` and `idempotency/`
- [x] Add tests for `video-concept/` starting with pure-logic services (ConflictDetection, PromptValidation, Compatibility)
- [x] Add tests for `taxonomy-validation/`
- [x] Audit and replace `@ts-ignore` directives (0 remain — already cleaned up during TS migration)

### Phase 3 — Structural improvements (when touching these files) ✅ COMPLETE

- [x] Convert remaining `.js` files to TypeScript (`glinerWorker.js` stays as `.js` with documented rationale — worker_threads constraint)
- [x] Document dependency override rationale (inline comments in `package.json` overrides block)
