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
