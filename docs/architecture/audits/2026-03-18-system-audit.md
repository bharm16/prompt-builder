# ADR-AUDIT-001: Full System Architecture Audit

**Status:** Informational
**Date:** 2026-03-18
**Scope:** Full system — DI, services, routes, shared layer, client, feature flags

---

## Executive Summary

The Vidra codebase has **strong architectural foundations**. The documented rules (DI, ESM, client/server boundary, aiService routing, shared layer purity) are almost fully enforced in production code. The issues found are evolutionary drift, not structural decay — they can be addressed incrementally without redesign.

**Severity breakdown:** 1 high, 4 medium, 3 low

---

## Findings

### HIGH SEVERITY

#### H1. `services.initialize.ts` is a 430-line procedural blob

**Location:** `server/src/config/services.initialize.ts`

The initialization file has grown into a single `initializeServices()` function that sequentially validates LLM clients, runs infrastructure checks, starts 8+ background workers, warms up GLiNER, warms up depth estimation, and starts capabilities probes. This is a textbook SRP violation — it has at least 4 reasons to change (LLM provider additions, worker lifecycle changes, warmup config changes, health check changes).

**Recommendation:** Extract into focused initializers:

- `llm.initializer.ts` — LLM client validation and pre-warming
- `infrastructure.initializer.ts` — Firebase/GCS startup checks
- `worker.initializer.ts` — Background worker lifecycle
- `warmup.initializer.ts` — GLiNER, depth estimation warmup

The top-level `initializeServices()` becomes a thin orchestrator calling these.

---

### MEDIUM SEVERITY

#### M1. Naming mismatch: `claudeClient` DI token logs "OpenAI API key"

**Location:** `server/src/config/services.initialize.ts:144-159`

The DI token is `'claudeClient'` but every log message references "OpenAI": `'Validating OpenAI API key...'`, `'OpenAI API key validated successfully'`, `'OpenAI adapter disabled'`. This creates confusion when debugging from logs — you'll grep for "claude" and find nothing, or see "OpenAI disabled" and think it's a different service. This is likely a leftover from a rename.

**Recommendation:** Align log messages to the DI token name, or rename the token to match what it actually wraps. Pick one identity and stick with it.

#### M2. 10 components with 5+ useState calls

**Key offenders:**

- `WorkspaceSessionContext.tsx` — 8 useState (675 lines)
- `AssetEditor.tsx` — 8 useState (228 lines)
- `PasswordResetPage.tsx` — 7 useState
- `SignUpPage.tsx` — 7 useState
- `SessionsPanel.tsx` — 6 useState (600 lines)

The documented convention says to use `useReducer` for complex state. These components have state that likely has interdependencies (e.g., loading + error + data).

**Recommendation:** Prioritize `WorkspaceSessionContext` and `AssetEditor` for refactoring to `useReducer` with discriminated union actions.

#### M3. Inconsistent feature directory structure

**Status by feature:**

| Feature           | api/ | hooks/ | components/ | Conformant?             |
| ----------------- | ---- | ------ | ----------- | ----------------------- |
| assets            | ✅   | ✅     | ✅          | Yes                     |
| span-highlighting | ✅   | ✅     | ✅          | Yes                     |
| prompt-optimizer  | ✅   | ✅     | ✅          | Yes                     |
| continuity        | ✅   | ✅     | ✅          | Yes                     |
| convergence       | ❌   | ✅     | ✅          | **No — uses root api/** |
| generation        | ❌   | ❌     | ❌          | **Empty directory**     |
| history           | ❌   | ✅     | ✅          | No api/ layer           |
| video-template    | ❌   | ✅     | ❌          | Minimal                 |
| reference-images  | ✅   | ✅     | ❌          | Missing components/     |

`convergence` is notable — it bypasses the feature-scoped `api/` pattern and uses root-level `client/src/api/motionApi.ts` instead. `generation/` is an empty directory that should be removed or populated.

#### M4. Root-level `client/src/api/` files lack Zod validation

Feature-scoped API directories (`features/*/api/schemas.ts`) properly validate with Zod. But root-level API files (`enhancementSuggestionsApi.ts`, `motionApi.ts`, `billingApi.ts`) use raw TypeScript interfaces without runtime validation, creating an inconsistent anti-corruption layer.

**Recommendation:** Add `schemas.ts` files alongside root-level API modules, or migrate these APIs into their respective features.

---

### LOW SEVERITY

#### L1. Migration scripts import directly from `server/src/`

**Location:** `scripts/migrations/` (6 files)

Migration scripts import `SpanLabelingService`, `storageBucket` directly from server implementation paths. While scripts are outside the application boundary, this creates implicit coupling to server internals.

**Recommendation:** Extract reusable utilities (bucket access, span labeling invocation) into a `scripts/lib/` shared layer, or accept this as pragmatic tech debt for one-shot migration scripts.

#### L2. `any` at DI registration boundary

**Location:** `server/src/config/services/credit.services.ts` (2 instances)

Both uses are properly ESLint-disabled with documented justification. This is acceptable at the DI container boundary where runtime types are resolved. No action needed unless the DI container gains type-safe registration.

#### L3. Feature flag surface area underdocumented

The root CLAUDE.md documents `PROMPT_OUTPUT_ONLY` and `ENABLE_CONVERGENCE`, but `services.initialize.ts` also checks `runtimeFlags.processRole`, `runtimeFlags.videoWorkerDisabled`, and `runtimeFlags.allowUnhealthyGemini`. These flags affect runtime behavior significantly but aren't in the feature flag table.

**Recommendation:** Add a complete flag reference to `runtime-flags.ts` with JSDoc, and update the root CLAUDE.md table to include all flags that change service behavior.

---

## What's Working Well

These are worth calling out because they're easy to take for granted:

1. **Client/server boundary is airtight.** Zero cross-imports in production code.
2. **aiService abstraction holds.** No business service bypasses it to call LLM providers directly.
3. **DI discipline is strong.** No `container.resolve()` in business services or route handlers.
4. **Shared layer is pure.** No I/O, no framework code, just types/schemas/utils.
5. **ESM compliance is complete.** Zero `require()` calls.
6. **Legacy service files are gone.** Root-level `EnhancementService.ts` and `VideoConceptService.ts` have been properly retired.
7. **Anti-corruption layer is well-adopted** in feature-scoped APIs with Zod schemas.
8. **Domain-scoped DI registration** keeps the container config modular and readable.

---

## Action Items (Prioritized)

1. [ ] **H1** — Split `services.initialize.ts` into domain-scoped initializers
2. [ ] **M1** — Fix `claudeClient` / "OpenAI" naming mismatch in logs
3. [ ] **M2** — Refactor top useState offenders to useReducer
4. [ ] **M3** — Remove empty `generation/` feature dir; move `motionApi` into `convergence/api/`
5. [ ] **M4** — Add Zod schemas to root-level API files
6. [ ] **L3** — Document all runtime flags in a single reference

---

## Methodology

Audit conducted via static analysis of: DI container (`services.config.ts`, `services.initialize.ts`), route configuration (`routes.config.ts`), all service directories, all client feature directories, shared layer, and migration scripts. Cross-referenced against documented rules in root `CLAUDE.md`, `client/CLAUDE.md`, `server/CLAUDE.md`, `CLAUDE_CODE_RULES.md`, and `SERVICE_BOUNDARIES.md`.
