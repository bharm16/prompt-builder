# Backend Architecture Simplification Audit

**Date:** 2026-03-19
**Scope:** 526 TypeScript files across 120+ directories in `server/src/services/`, plus DI config and route wiring.

---

## Headline: Where the Real Waste Lives

After reading the actual code across all service families, here's the honest assessment: the domain boundaries are mostly correct, but there are 5 areas where accumulated complexity is costing you readability and velocity without delivering proportional value.

The system has ~85-90 registered services. That's not inherently wrong for a monolith of this scope, but about 15-20 of those are unnecessary indirection, aliases, or duplicated abstractions.

---

## 1. The `generation/` Directory Should Not Exist

**Impact: High | Effort: Low**

`server/src/services/generation/` contains three files:

- `ConsistentVideoService.ts` — a thin orchestrator that resolves a prompt, optionally generates a keyframe, then calls `VideoGenerationService.generateVideo()`. This is ~50 lines of actual logic.
- `KeyframeGenerationService.ts` — a FAL provider wrapper for character-consistent keyframes.
- `FaceSwapService.ts` — a FAL provider wrapper for face-swapping.

On top of this, `generation.services.ts` registers a `keyframeService` that is literally an alias:

```typescript
keyframeService: keyframeGenerationService
```

**What to do:**
- Delete the `keyframeService` alias. Use `keyframeGenerationService` directly.
- Move `KeyframeGenerationService` and `FaceSwapService` into `video-generation/providers/`. They're provider wrappers — that's where they belong.
- Inline `ConsistentVideoService` into the route handler or make it a utility function. It doesn't have enough logic to justify being a DI-registered service.

---

## 2. Merge Assets and Reference Images into One Domain

**Impact: Medium | Effort: Medium**

You have two `ReferenceImageService` implementations:

| File | Purpose | LOC |
|------|---------|-----|
| `services/asset/ReferenceImageService.ts` | Image processing (sharp, resize, format) | 221 |
| `services/reference-images/ReferenceImageService.ts` | Storage + metadata (Firestore + GCS CRUD) | 283 |

Same class name, different folders, different responsibilities. This is confusing and splits what should be a single domain into two disconnected service families.

**What to do:**
- Merge `reference-images/` into `asset/reference-images/` as a sub-module.
- Rename to distinguish: `ReferenceImageProcessingService` (sharp operations) and `ReferenceImageRepository` (Firestore + GCS storage).
- Single DI registration family, single route file.

---

## 3. The 352-Line God Config Object

**Impact: High | Effort: Medium**

`core.services.ts` registers a single `config` value that's 296 lines of env var parsing covering 25+ concerns: OpenAI, Groq, Qwen, Gemini, Replicate, FAL, Redis, Stripe, Credits, Video Jobs, Webhooks, Continuity, Feature Flags, Firestore, Idempotency, and more.

Every service that needs *any* config gets the *entire* config object. This means:
- Touching video job timeout config requires editing the same file as Stripe webhook config.
- Unit tests mock a 25-field object when they only need 2 fields.
- No type narrowing — services receive `Config` and pick fields at will.

**What to do:**
- Split into domain-scoped config factories: `llm.config.ts`, `stripe.config.ts`, `videoJobs.config.ts`, `features.config.ts`, etc.
- Register each as a separate DI value. Services declare which config slice they need.
- This is a mechanical refactor — it touches many files but each change is trivial.

---

## 4. Continuity Sub-Services Are Invisible to DI

**Impact: Medium | Effort: Medium**

`ContinuitySessionService` takes 14 constructor parameters and internally creates 4 sub-services (`ContinuityProviderService`, `ContinuityMediaService`, `ContinuityPostProcessingService`, `ContinuityShotGenerator`) that are never registered with the DI container. They're instantiated inline inside the factory function.

This means:
- You can't test sub-services in isolation.
- You can't swap or mock individual sub-services.
- The 14-parameter factory is unreadable.
- Initialization order is implicit and fragile.

**What to do:**
- Register the 4 sub-services individually in `continuity.services.ts`.
- `ContinuitySessionService` receives them as constructor deps (4 services instead of 14 primitives).
- Each sub-service becomes independently testable and swappable.

---

## 5. LLM Client Registration Is Copy-Paste × 4

**Impact: Low | Effort: Low**

`llm.services.ts` registers 4 concurrency limiters and 4 LLM clients with identical structure, differing only in env var names, default values, and error thresholds. That's ~120 lines of boilerplate that should be ~30.

**What to do:**
```typescript
function registerProvider(name: string, adapter: LLMAdapter, config: ProviderConfig) {
  container.registerSingleton(`${name}Limiter`, () => new ConcurrencyLimiter(config));
  container.registerSingleton(`${name}Client`, (limiter) => new LLMClient(adapter, limiter, config));
}
```

---

## Areas That Are NOT Over-Engineered (Leave Alone)

These areas look complex from the outside but are justified by the domain:

**Continuity vs. Convergence:** Genuinely different features. Continuity is linear multi-shot sequencing (shot 1 → 2 → 3). Convergence is branching iterative refinement. They correctly share depth estimation infrastructure while maintaining separate orchestration. Don't merge.

**Video Job Infrastructure (2,634 LOC):** The core queue + polling + retry is justified for a payment-gated async pipeline. The circuit breaker, DLQ reprocessor, and reconciler are production-grade. Minor simplification possible (collapse heartbeat into job lease TTL, fold DLQ reprocessor into sweeper), but this isn't causing velocity problems.

**Enhancement vs. Video Concept vs. Prompt Optimization:** All generate "suggestions" but at fundamentally different scopes (phrase-level, element-level, full-prompt). No actual code duplication. The detection logic correctly funnels through `VideoPromptService` as a shared dependency. Leave the domain boundaries.

**ModelIntelligence (5 sub-services):** Properly decomposed single-responsibility services (capability registry, scoring, requirements extraction, explanation generation, availability gating). The orchestrator pattern is clean.

**FirestoreCircuitExecutor, IdempotencyService, StorageService:** Production-grade infrastructure services. Appropriate complexity for their reliability concerns.

---

## Lower-Priority Improvements

These are worth doing when you're already in the area, but not worth dedicated refactoring time:

**Null-gating boilerplate in generation.services.ts:** Extract a helper like `ifAvailable(service, name)` to replace the repeated "if null, warn and return null" pattern (~8 occurrences).

**CacheService semantic caching (321 lines):** The semantic caching integration adds ~150 lines of complexity with no evidence of route-level usage. Could strip to a 120-line thin wrapper. Low priority because it's not in the critical path.

**Enhancement single-use intermediaries:** `validationService` and `categoryAligner` are only consumed by `EnhancementService`. Could inline them, but they're small enough that the indirection isn't hurting.

**Inconsistent Store naming:** `BillingProfileStore`, `SessionStore`, `VideoJobStore`, `StripeWebhookEventStore` — some are thin data access, some have business logic. Not worth a rename campaign, but establish a convention going forward (Repository = data access, Store = data access + light logic, Service = business logic).

---

## Summary: Priority Order

| # | Change | Impact | Effort | LOC Saved |
|---|--------|--------|--------|-----------|
| 1 | Delete `generation/` directory, inline/relocate services | High | Low | ~200 + removes indirection |
| 2 | Split god config into domain-scoped files | High | Medium | 0 (restructure) |
| 3 | Merge `reference-images/` into `asset/` | Medium | Medium | ~100 + naming clarity |
| 4 | Register continuity sub-services in DI | Medium | Medium | 0 (testability gain) |
| 5 | Extract LLM client factory | Low | Low | ~90 |
| 6 | Delete `keyframeService` alias | Low | Trivial | ~5 |

None of these require architectural redesign. They're all surgical changes that reduce indirection without changing the system's behavior or domain boundaries.
