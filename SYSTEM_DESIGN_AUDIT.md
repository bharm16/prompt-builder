# Vidra System Design Audit

**Date:** 2026-03-18
**Scope:** Full architecture audit — DI, routing, contracts, resilience, scaling posture

---

## Executive Summary

Vidra's architecture is well-structured for a product at this stage. The DI container, layered service boundaries, shared contract layer, and feature-flag system are all coherent and consistently applied. That said, the audit surfaces several structural debts that will compound as the system scales: fragmented resilience primitives, a growing nullable-service graph without compile-time safety, a monolithic initialization path, and a process-role split that's incomplete for true horizontal scaling.

Below are findings grouped by subsystem, each with severity, impact, and a recommended action.

---

## 1. Dependency Injection Container

### What's Working

The custom DI container is simple, readable, and sufficient. Factory-based registration with explicit dependency arrays, circular dependency detection via a `resolving` set, and `createChild()` for test isolation cover the core use cases.

Domain-scoped registration files (`core.services.ts`, `llm.services.ts`, etc.) keep the wiring organized and the dependency graph easy to trace. Registration order in `configureServices()` mirrors the dependency layers cleanly: infrastructure → providers → business logic → application.

### Finding 1.1: No Compile-Time Contract on Service Names (Severity: Medium)

All service resolution uses string keys (`container.resolve<T>('serviceName')`). The container has no type-level enforcement that the registered key maps to the asserted type `T`. A typo in the string or a wrong generic parameter silently produces a runtime failure.

**Impact:** Every `resolve<T>()` call is an unchecked cast. The pre-resolution step in `initializeServices` catches some of these at startup, but only for 6 named services — the other 50+ are validated lazily on first request.

**Recommendation:** Introduce a typed service registry interface:

```typescript
interface ServiceRegistry {
  aiService: AIModelService;
  claudeClient: LLMClient | null;
  videoGenerationService: VideoGenerationService | null;
  // ...
}
container.resolve<'aiService'>() → AIModelService  // compile-time safe
```

This is a low-risk, incremental change — add the interface first, migrate call sites over time.

### Finding 1.2: Nullable Service Proliferation (Severity: Medium)

At least 15 services can resolve to `null` at runtime (videoGenerationService, storyboardPreviewService, keyframeService, assetService, etc.). Consumers must null-check, but there's no enforcement — a missed check is a runtime NPE discovered in production.

The pattern is intentional and enables graceful degradation when credentials are missing. But the null surface area has grown beyond what manual discipline can reliably cover.

**Recommendation:** Two options (not mutually exclusive):
1. **Narrow the null graph.** Several services return null only because a transitive dependency is null. Consider a `NullVideoGenerationService` that returns structured "unavailable" responses instead of `null` — this pushes error handling to the service contract rather than every consumer.
2. **Runtime exhaustive null audit.** Add a post-initialization step that logs every service that resolved to null, so operators know the degraded surface at a glance.

### Finding 1.3: Static Module Mutations During DI Registration (Severity: Low)

`credit.services.ts` calls `setRefundFailureStore()` as a side effect of registration. `storage.services.ts` calls `setConvergenceStorageSignedUrlTtl()`. These couple DI wiring to global module state, making it impossible to run two containers in the same process (relevant for integration tests).

**Recommendation:** Refactor global setters to accept the value through constructor injection or a module-level init function called explicitly after DI completes.

---

## 2. Route Configuration and API Boundaries

### What's Working

The route registration in `routes.config.ts` is well-organized with clear sections (health, API, motion, LLM, preview, payment). The `promptOutputOnly` flag cleanly gates generation routes. Auth middleware is consistently applied via `apiAuthMiddleware`. The Firestore write gate provides fail-closed protection for mutating endpoints.

### Finding 2.1: Route Factory Is Becoming a God Function (Severity: Medium)

`registerRoutes()` is 335 lines and resolves ~30 services from the container. It's the single point where all wiring decisions converge. As more features ship, this function grows linearly.

**Impact:** Every new route requires modifying this file, increasing merge conflict risk and making it harder to reason about what's mounted.

**Recommendation:** Split into domain-scoped route registration functions that each receive a scoped subset of services:

```typescript
// In registerRoutes():
registerHealthRoutes(app, container);
registerApiRoutes(app, container);
registerMotionRoutes(app, container);
registerPreviewRoutes(app, container);
registerPaymentRoutes(app, container);
```

Each function resolves only its own services. This matches the domain-scoped pattern already used for service registration.

### Finding 2.2: Webhook Route Ordering Dependency (Severity: Low)

In `app.ts`, Stripe webhook routes are mounted **before** the body parser middleware because they need raw bodies. This ordering dependency is documented only by a comment. If someone reorders the middleware/routes setup, webhook signature verification breaks silently.

**Recommendation:** Make this constraint explicit — either with an integration test that verifies webhook signature validation works end-to-end, or by isolating the webhook route into its own Express sub-app with its own body parser config.

### Finding 2.3: Inconsistent Timeout Configuration (Severity: Low)

The main API routes have a 30-second timeout with exclusions for `/preview` and `/optimize`. Health routes have a 5-second timeout. Other route groups (motion, payment, LLM) have no explicit timeout — they rely on the default Express/container behavior.

**Recommendation:** Document intended timeout SLOs per route group and apply them consistently.

---

## 3. Shared Contract Layer

### What's Working

This is one of the strongest parts of the architecture. The shared layer is genuinely pure (no I/O, no framework dependencies). Zod schemas with `.passthrough()` provide forward-compatible validation. The canonical `ApiSuccessResponse<T>` / error envelope is used consistently across all endpoints. Feature-level anti-corruption layers (e.g., `span-highlighting/api/`, `continuity/api/`) properly isolate server DTOs from UI concerns.

No cross-boundary imports were found — client never imports from server, and vice versa.

### Finding 3.1: Schema Duplication Between Shared and Feature Layers (Severity: Low)

Some feature API directories re-export shared schemas verbatim (`client/src/features/assets/api/schemas.ts` re-exports `AssetSchema` from `@shared`). Others define their own schemas that mirror but don't reference the shared ones. This creates a drift risk if the shared schema changes but a feature's local copy doesn't.

**Recommendation:** Standardize the pattern: feature schemas should either (a) re-export from shared with extensions, or (b) compose shared schemas using Zod's `.extend()` / `.merge()`. Never copy-paste.

### Finding 3.2: No Shared Schema for Streaming Responses (Severity: Low)

The optimization endpoint uses SSE streaming, and the span labeling batch endpoint uses NDJSON. These streaming formats have no shared schema definition — the client parsers (`spanLabelingStream.ts`, `PromptOptimizationApi.ts`) define their own ad-hoc parsing. If the server changes the stream format, only the client parser catches the drift, and only at runtime.

**Recommendation:** Add streaming chunk schemas to `shared/schemas/` for the two streaming formats in use.

---

## 4. Error Handling and Resilience

### What's Working

The `DomainError` hierarchy with `getHttpStatus()` and `getUserMessage()` is clean. `VideoProviderError` auto-categorization (auth, rate_limit, validation, timeout, provider) with retryability flags is sophisticated and reusable. The error handler middleware has PII redaction, which is good operational hygiene. Circuit breaker integration with Firestore (via opossum) provides real protection against cascading failures.

### Finding 4.1: Fragmented Resilience Primitives (Severity: High)

This is the most significant finding. Three distinct retry/circuit-breaker implementations coexist:

1. **`FirestoreCircuitExecutor`** — opossum circuit breaker + custom exponential backoff with jitter. Hardcoded transient-error detection for Firestore error codes.
2. **`CircuitBreakerAdapter` / `CircuitBreakerFactory`** — separate opossum wrapper for other services. Different configuration shape, separate lifecycle.
3. **`RetryPolicy`** — generic retry utility with exponential backoff. Exists but is barely used in production code.

Additionally, `AIModelService` has its own fallback-retry logic (primary → fallback client, logprobs retry), and `VideoJobWorker` has poll-interval reset logic tied to circuit recovery.

**Impact:** When someone needs to add retry logic to a new service, there's no clear "right way" — they'll pick whichever pattern they find first, or write a fourth one. Transient error detection is hardcoded in multiple places rather than shared.

**Recommendation:**
1. Consolidate to a single `ResiliencePolicy` abstraction that composes retry + circuit breaker + timeout. `RetryPolicy` is the closest starting point.
2. Extract transient error detection into a shared utility (`isTransientError(error): boolean`) that all retry/circuit-breaker consumers use.
3. Wire the consolidated policy through DI so it's configurable per service domain.

### Finding 4.2: Error Hierarchy Inconsistency (Severity: Low)

`WebhookUnresolvedError` extends `Error` instead of `DomainError`. LLM client errors (`APIError`, `TimeoutError`, `ServiceUnavailableError`, `ClientAbortError`) live outside the `DomainError` hierarchy. This means the error handler middleware's `isDomainError()` type guard doesn't catch these — they fall through to the generic 500 path.

**Recommendation:** Migrate `WebhookUnresolvedError` to extend `DomainError`. For LLM client errors, consider a `ProviderError` subclass of `DomainError` that wraps the client-level errors with appropriate HTTP status and user messages.

---

## 5. Process Role Split and Scaling Posture

### What's Working

The `processRole` flag (`api` vs `worker`) cleanly separates request-handling from background processing. Workers get video job processing, credit sweeping, DLQ reprocessing, and reconciliation. API processes get route handling and warmups. The runtime flag system is simple and env-var driven.

### Finding 5.1: Shared Initialization Path (Severity: Medium)

Both `api` and `worker` roles execute the same `configureServices()` → `initializeServices()` → `createApp()` pipeline. This means:

- Workers register and warm up all route-handling infrastructure they never use.
- API processes register all worker services (videoJobWorker, creditRefundSweeper, etc.) they never start.
- The `initializeServices` function is 430 lines of sequential/conditional logic that grows with every new service.

**Impact:** Startup time for both roles is longer than necessary. More importantly, a configuration error in a worker-only service (e.g., missing Firestore permission for credit reconciliation) will crash the API process at boot, even though the API process never uses that service.

**Recommendation:** Split the initialization into role-specific modules:

```typescript
// services.initialize.ts
export async function initializeServices(container, role) {
  await initializeCommon(container);
  if (role === 'api') await initializeApiServices(container);
  if (role === 'worker') await initializeWorkerServices(container);
}
```

This also makes the worker independently deployable without carrying route-handling code.

### Finding 5.2: No Request Scoping (Severity: Low, but escalates)

All services are application-level singletons. There's no per-request scope. This is fine today because services are stateless (they receive request-specific data as parameters). But if any service starts accumulating request-specific state (e.g., a request-scoped logger with trace IDs, or a request-scoped cache), the singleton pattern breaks.

The container already has `createChild()` — it could support request scoping with a middleware that creates a child container per request. Not needed now, but worth knowing the escape hatch exists.

### Finding 5.3: Dev Default Is Worker Role (Severity: Low)

`resolveProcessRole()` defaults to `worker` in non-production environments. This means `npm run server` in development runs video job workers, credit sweepers, etc. — processes that hit external APIs and consume resources. Most developers probably want `api` mode for local development.

**Recommendation:** Default to `api` in development and require explicit `PROCESS_ROLE=worker` to run background processors locally.

---

## 6. Observability

### What's Working

Pino structured logging is used consistently. Metrics are tracked per LLM operation, circuit breaker state changes, and video job lifecycle. Health endpoints expose circuit breaker snapshots and worker status. Request IDs are injected via middleware for tracing.

### Finding 6.1: No Distributed Tracing (Severity: Medium)

Request IDs exist but aren't propagated across service boundaries (e.g., from API to LLM provider calls, or from API to video job worker). When debugging a failed video generation, correlating the original API request to the worker that processed it requires log searching by timestamp.

**Recommendation:** Propagate request IDs (or OpenTelemetry trace IDs) through the DI container or as a request-scoped context. This becomes critical once the API/worker split is deployed as separate processes.

---

## Trade-off Summary

| Finding | Severity | Effort to Fix | Risk of Deferral |
|---------|----------|---------------|------------------|
| 4.1 Fragmented resilience primitives | High | Medium (2-3 days) | New services add a 4th pattern; inconsistent retry behavior in prod |
| 1.1 No typed service registry | Medium | Low (1 day for interface, incremental migration) | Grows linearly with service count |
| 1.2 Nullable service proliferation | Medium | Medium (null object pattern requires per-service work) | Runtime NPEs in degraded deployments |
| 2.1 Route factory god function | Medium | Low (mechanical split) | Merge conflicts, harder onboarding |
| 5.1 Shared initialization path | Medium | Medium (requires testing both role paths) | Startup failures leak across roles |
| 6.1 No distributed tracing | Medium | Medium (OpenTelemetry integration) | Debugging cross-process flows is manual |
| 1.3 Static module mutations | Low | Low | Test isolation issues |
| 2.2 Webhook ordering dependency | Low | Low (add integration test) | Silent breakage on refactor |
| 2.3 Inconsistent timeouts | Low | Low (configuration + documentation) | Unbounded request durations on some routes |
| 3.1 Schema duplication | Low | Low | Drift between shared and feature schemas |
| 3.2 No streaming schemas | Low | Low | Client parser drift on stream format changes |
| 4.2 Error hierarchy inconsistency | Low | Low | Some errors bypass structured error handling |
| 5.2 No request scoping | Low | N/A (escape hatch exists) | Only matters if services become stateful |
| 5.3 Dev defaults to worker | Low | Trivial | Accidental resource consumption in dev |

---

## Recommended Priority Order

1. **Consolidate resilience primitives** (Finding 4.1) — highest impact, prevents further fragmentation.
2. **Add typed service registry** (Finding 1.1) — low effort, compounds over time.
3. **Split route registration** (Finding 2.1) — mechanical, reduces friction for everyone.
4. **Role-specific initialization** (Finding 5.1) — unlocks cleaner scaling and faster startups.
5. **Everything else** — address opportunistically alongside feature work.
