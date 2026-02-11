# Project: Vidra (PromptCanvas)

## Purpose
- Interactive editing canvas for AI video prompts with semantic span labeling, click-to-enhance suggestions, and fast previews.

## Tech stack
- Monorepo, Node.js >= 20, ESM (package.json has "type": "module").
- Client: React 18 + Vite, Tailwind CSS + DaisyUI, TypeScript migration in progress.
- Server: Express + tsx (TypeScript), LLM providers (OpenAI, Gemini, Groq), Firebase, Stripe.
- Shared code is in shared/ and can be imported via #shared/*.

## Repo layout
- client/        Frontend app (Vite + React)
- server/        API + services (Express)
- shared/        Shared types/utils
- packages/      Workspace packages (ex: @promptstudio/system)
- config/        Build/lint/test config
- scripts/       Dev tools, migrations, evals
- docs/          Architecture + TS migration docs
- tests/         E2E, load, and evaluation suites

## Architecture rules
- Frontend: follow VideoConceptBuilder pattern in client/src/components/VideoConceptBuilder/.
  - Orchestrator component + hooks/useReducer + api/ + components/.
- Backend: follow PromptOptimizationService pattern in server/src/services/prompt-optimization/PromptOptimizationService.js.
  - Thin orchestrator + specialized services + templates/ (.md).
- API calls live in client/src/api (not inline in components).
- Backend business logic lives in server/src/services.
- SRP/SoC: do not split files solely by line count; thresholds are warnings only.
- File size heuristics: orchestrators ~500 lines, UI components ~200, hooks ~150,
  specialized services ~300, utils ~100.
- Prefer TypeScript, avoid any, and use Zod at boundaries (see docs/architecture/typescript/).

## Environment
- Copy .env.example to .env.
- Required for local dev: VITE_FIREBASE_* and at least one LLM key (ex: OPENAI_API_KEY).

## Common commands
- npm start          Dev orchestrator (see scripts/dev/start.ts)
- npm run dev        Vite client only
- npm run server     API server only
- npm run lint       ESLint
- npm run lint:css   Stylelint
- npm run test       Vitest
- npm run test:e2e   Playwright
- npm run build      Vite build

## Integration tests

Read `docs/architecture/typescript/TEST_GUIDE.md` Part 3 before writing any integration test.

Cardinal rule: **write tests from contracts, not implementations.**

Contract files to read:
- `server/src/config/services.config.ts` (service registrations)
- `server/src/config/services.initialize.ts` (init order, health checks)
- `server/src/app.ts` (middleware, route mounting)
- `server/src/routes/*.routes.ts` (route paths, schemas)
- `server/src/schemas/*.ts` (Zod contracts)

Do NOT read service class internals, handler bodies, or prompt templates when writing assertions.

Workflow:
1. Read contract files.
2. Write assertions against what contracts promise.
3. Run tests — expect failures.
4. Report failures with root cause analysis.
5. STOP. Ask the user whether to fix source code or adjust the test spec.

When fixing failures: default to fixing source code, not the test. Never weaken assertions.

When modifying `services.config.ts`, `services.initialize.ts`, `app.ts`, `server.ts`, or `server/index.ts`, run:
```bash
PORT=0 npx vitest run tests/integration/bootstrap.integration.test.ts tests/integration/di-container.integration.test.ts --config config/test/vitest.integration.config.js
```

## Working notes
- Keep changes small and consistent with existing patterns.
- Update or add tests for behavior changes.
- See client/GEMINI.md and server/GEMINI.md for subsystem-specific guidance.
- Integration test guide: docs/architecture/typescript/TEST_GUIDE.md (Part 3).
