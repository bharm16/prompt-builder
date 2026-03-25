# ADR: Vidra Backend & Infrastructure Assessment

**Status:** Proposed
**Date:** 2026-03-22
**Deciders:** Engineering team

## Context

The team requested an architecture evaluation of the backend and infrastructure stack, citing concerns about implementation quality. This ADR documents findings from a comprehensive code review of the server-side architecture, covering DI, routing, caching, external integrations, LLM routing, error handling, and observability.

## Verdict

**The implementation is strong.** The architecture demonstrates deliberate, production-grade design across nearly every layer. This is not a codebase with fundamental structural problems — it's one with a few areas that could be tightened. The assessment below is organized as strengths (to preserve) and weaknesses (to address), ranked by impact.

---

## Strengths (Preserve These)

### 1. Custom DI Container — Well-Executed

The hand-rolled `DIContainer` in `/server/src/infrastructure/DIContainer.ts` is ~235 lines, supports singleton caching, circular dependency detection with clear error chains, and typed `resolve()` overloads tied to a `ServiceRegistry` interface. Domain-scoped registration files (`server/src/config/services/*.services.ts`) keep concerns separated.

**Why this matters:** Many teams reach for InversifyJS or tsyringe and inherit complexity they don't need. This container does exactly what Vidra requires, nothing more. Keep it.

### 2. LLM Routing Layer — Best-in-Class for the Scale

`AIModelService` routes by operation name, not provider. Per-provider concurrency limiters, circuit breakers with tuned thresholds (OpenAI 50%/30s, Groq 60%/15s, Gemini 55%/20s), and automatic fallback cascades. Services never touch provider clients directly.

**Why this matters:** Swapping or adding an LLM provider is a config change, not a code refactor. This is the single most valuable architectural decision in the backend.

### 3. Defensive External Dependencies

Every external dependency — Firebase, Redis, Stripe, LLM providers — has fallback logic. Redis gracefully degrades to in-memory NodeCache. Firebase has three-tier credential loading. Stripe webhooks have transactional idempotency via Firestore. The server never crashes because a dependency is unavailable.

### 4. Environment Validation

Zod-based env parsing in `/server/src/config/env.ts` with 17 merged schemas, fail-fast semantics (collects ALL errors before throwing), production-only refinements, and advisory warnings for suspicious configurations. This is textbook.

### 5. Error Handling with PII Redaction

Domain errors carry `getHttpStatus()`, `getUserMessage()`, and `code`. The error handler automatically scrubs emails, SSNs, credit cards, API keys, and long strings from logs. Request IDs propagate for tracing. This is production-ready.

### 6. Observability (Three Pillars)

Pino structured logging with AsyncLocalStorage context, Prometheus metrics (counters, histograms, gauges for every service boundary), and optional OpenTelemetry tracing. Cache hit rates, circuit breaker state changes, and LLM costs all flow to metrics.

### 7. Graceful Shutdown

Ordered teardown: stop accepting connections → stop background loops → drain video jobs with timeout budget → close Redis → force exit with safety margin. Unhandled rejection handler distinguishes fatal from operational errors. This prevents data loss during deploys.

---

## Weaknesses (Address These)

### W1: Feature Flag Sprawl — Medium Risk

`promptOutputOnly` and `enableConvergence` are checked in 50+ locations across app.ts, services.initialize.ts, route registrations, and individual services. Adding a new flag will follow the same pattern, and inconsistency in any one check creates subtle bugs.

**Recommendation:** Centralize flag evaluation. Instead of passing boolean flags through layers, create a `FeatureGates` service that encapsulates all flag logic. Services query `featureGates.isEnabled('convergence')` instead of receiving raw booleans. This also gives you a single place to add flag overrides, A/B testing, or per-user flags later.

| Dimension             | Current            | Proposed                  |
| --------------------- | ------------------ | ------------------------- |
| Complexity            | Scattered booleans | Single service            |
| Risk of inconsistency | High (50+ checks)  | Low (one source of truth) |
| Effort                | —                  | ~2-3 hours                |

### W2: EnhancementService Constructor Bloat — Low-Medium Risk

`EnhancementService` takes 10+ constructor dependencies: AIService, VideoService, BrainstormBuilder, CleanPromptBuilder, ValidationService, DiversityEnforcer, CategoryAligner, MetricsService, CacheService, and more. While each dependency is justified individually, this signals the service is coordinating too many concerns.

**Recommendation:** Group related dependencies into nested orchestrators. For example, `EnhancementPipelineBuilder` could wrap BrainstormBuilder + CleanPromptBuilder + ValidationService + DiversityEnforcer + CategoryAligner. EnhancementService then takes ~5 dependencies instead of 10+. This doesn't change behavior — it improves readability and testability.

**Counterpoint:** If these dependencies genuinely change independently (different teams, different release cadences), keeping them flat is defensible. Only refactor if you're finding test setup painful.

### W3: Redis Health Not Exposed — Low Risk, Easy Fix

`getRedisStatus()` is exported but not surfaced in the `/health` endpoint or Prometheus metrics. If Redis silently degrades to in-memory, the team won't know until cache hit rates drop.

**Recommendation:** Add Redis connection state to the health check response and expose a `redis_connection_status` gauge in Prometheus. ~30 minutes of work.

### W4: Hardcoded CORS Origins — Low Risk in Dev, Problem in Staging

CORS whitelist includes hardcoded `localhost:5173` and `localhost:5174` for development. If you add staging environments, you'll need to remember to update this.

**Recommendation:** Already partially solved — `ALLOWED_ORIGINS` is required in production via Zod refinement. Just ensure staging deployments set this env var. Consider removing the hardcoded dev origins and using `ALLOWED_ORIGINS=http://localhost:5173,http://localhost:5174` in `.env.development` for consistency.

### W5: Request Context Underutilized — Opportunity

`AsyncLocalStorage`-based request context is set up and working, but usage is minimal. You have the infrastructure for per-request correlation (user ID, feature flags, cost tracking) but aren't fully leveraging it.

**Recommendation:** Not urgent, but when you need per-request cost attribution or user-scoped feature flags, the foundation is already there. No action needed now.

### W6: Legacy File Warning in CLAUDE.md is Stale

CLAUDE.md warns about legacy `EnhancementService.ts` and `VideoConceptService.ts` at the root of `services/`, but these files no longer exist. The refactor was completed successfully.

**Recommendation:** Remove the warning from CLAUDE.md to avoid confusion. 2-minute fix.

---

## Trade-off Analysis

| Area           | Current Choice                | Alternative                   | Verdict                                                                                                                      |
| -------------- | ----------------------------- | ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| DI Container   | Hand-rolled                   | InversifyJS/tsyringe          | **Keep current.** Simpler, no decorator overhead, fits the scale.                                                            |
| Web Framework  | Express                       | Fastify                       | **Keep current.** Express is fine for this workload. Fastify's perf gains don't justify migration cost.                      |
| Caching        | NodeCache + optional Redis    | Redis-only                    | **Keep current.** Dual-tier with graceful degradation is the right call for a team that doesn't always have Redis running.   |
| LLM Routing    | Custom AIModelService         | LangChain/LiteLLM             | **Keep current.** Custom routing gives you fine-grained circuit breaking and concurrency control that generic routers don't. |
| Env Validation | Zod schemas                   | dotenv + manual checks        | **Keep current.** Zod is strictly superior here.                                                                             |
| Error Handling | Domain errors + PII redaction | Generic Express error handler | **Keep current.** This is above average.                                                                                     |

## Consequences

**If you address W1-W3:**

- Feature flag management becomes sustainable as the product grows
- EnhancementService becomes easier to test and reason about
- Redis failures become visible before they impact users

**What stays hard:**

- The conditional service registration pattern (null services) requires discipline from every developer. No architectural change eliminates this — it's inherent to optional features.
- 10+ LLM provider configurations mean env setup for new developers is complex. The Zod validation helps, but onboarding docs should explicitly list the minimum viable env vars.

## Action Items

1. [ ] **W6** — Remove stale legacy file warning from CLAUDE.md (2 min)
2. [ ] **W3** — Expose Redis status in health check and Prometheus (30 min)
3. [ ] **W4** — Move dev CORS origins to env var (15 min)
4. [ ] **W1** — Extract FeatureGates service (2-3 hours)
5. [ ] **W2** — Evaluate EnhancementService grouping if test setup becomes painful (deferred)
6. [ ] **W5** — Leverage request context for cost attribution when needed (deferred)
