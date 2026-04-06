# PR 4: Startup and Readiness Refactor

## Baseline (before)
- Infrastructure checks: 3 serial awaits with 20s timeouts (worst-case 60s)
- LLM provider validations: 4 serial awaits
- `/health/ready`: inline `listCollections()` call per request (3s timeout)
- Cold startup: serial infrastructure + serial LLM validation

## After
- Infrastructure checks: `Promise.all()` — 3 concurrent checks (worst-case 20s)
- LLM provider validations: `Promise.all()` — 4 concurrent validations
- `/health/ready`: reads cached Firestore probe (15s interval, 45s stale threshold) — zero inline I/O
- Readiness probe uses lightweight `collection.limit(1).get()` instead of `listCollections()`

## Delta
- Worst-case infrastructure startup: -66% (60s → 20s)
- Worst-case LLM validation: -75% (4x serial → 1x parallel)
- `/health/ready` response time: ~0ms Firestore I/O (was up to 3s per request)

## Method
- Code review of `services.initialize.ts` serial await chain
- Timing comparison requires live Firebase/GCS — measure in staging

## Rollback Gate
- Revert if integration tests fail (`bootstrap.integration.test.ts`, `di-container.integration.test.ts`)
- Revert if `/health/ready` reports false positives (marks healthy when Firestore is actually down)
- Revert if cold startup fails with any provider configuration
