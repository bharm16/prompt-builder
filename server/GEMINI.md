# Server workspace (server/)

## Stack
- Node.js 20, Express
- TypeScript executed via tsx
- ESM (package.json has "type": "module")
- Integrations: LLM providers, Firebase Admin, Stripe, Redis (optional)

## Structure
- server/index.ts              Entry point
- server/src/app.ts            Express app setup
- server/src/server.ts         HTTP server wiring
- server/src/services/         Business logic (PromptOptimizationService pattern)
- server/src/routes/           HTTP routes
- server/src/clients/          External API clients
- server/src/llm/              LLM orchestration
- server/src/middleware/       Express middleware
- server/src/schemas/          Validation schemas (use Zod)
- server/src/contracts/        Request/response contracts
- server/src/utils/            Shared helpers

## Architecture pattern
- Follow PromptOptimizationService pattern in server/src/services/prompt-optimization/.
  - Thin orchestrator + specialized services + templates/ (.md)
- Keep controllers/routes thin; put business logic in services.

## Conventions
- Use Zod at boundaries for validation.
- Prefer structured logging utilities (see docs/architecture/typescript/LOGGING_PATTERNS.md).
- Keep orchestration separate from implementation details.

## Integration tests

Read `docs/architecture/typescript/TEST_GUIDE.md` Part 3 before writing any integration test.

**Write tests from contracts, not implementations.** Read the files below for what the code promises. Do NOT read service implementations when writing assertions.

Contract sources:
- `server/src/config/services.config.ts` — all service registrations and factory functions
- `server/src/config/services.initialize.ts` — initialization order and health checks
- `server/src/app.ts` — middleware stack and route mounting
- `server/src/routes/*.routes.ts` — route paths and Zod schemas
- `server/src/schemas/*.ts` — validation contracts
- `shared/taxonomy.ts` — category definitions

Off-limits for assertion writing:
- Service class bodies (e.g., `EnhancementService.ts` internals)
- Route handler function bodies
- LLM prompt templates

When generating integration tests:
1. Read contract files.
2. Write assertions from contracts.
3. Run — expect failures.
4. Report failures with root cause.
5. STOP. Ask user whether to fix source code or test spec.

When fixing failures: fix the source code by default, not the test. Never weaken assertions, add swallowing try/catch, or change expected values to match broken output.

Integration test gate: when modifying `services.config.ts`, `services.initialize.ts`, `app.ts`, `server.ts`, or `index.ts`, run:
```bash
PORT=0 npx vitest run tests/integration/bootstrap.integration.test.ts tests/integration/di-container.integration.test.ts --config config/test/vitest.integration.config.js
```
