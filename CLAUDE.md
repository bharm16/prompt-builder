# Vidra (PromptCanvas)

Interactive editing canvas for AI video prompts with semantic span labeling, click-to-enhance suggestions, and fast previews.

## Tech Stack

- **Monorepo**: Node.js >= 20, ESM (`"type": "module"` in package.json)
- **Client**: React 18 + Vite, Tailwind CSS + DaisyUI, TypeScript (migration in progress)
- **Server**: Express + tsx (TypeScript), LLM providers (OpenAI, Gemini, Groq), Firebase Admin, Stripe
- **Shared**: Import via `#shared/*` path alias
- **Testing**: Vitest (unit), Playwright (e2e), fast-check (property)

## Repository Structure

```
client/          # React frontend (Vite)
server/          # Express API + services
shared/          # Shared types and utilities
packages/        # Workspace packages (@promptstudio/system)
config/          # Build, lint, and test configuration
scripts/         # Dev tools, migrations, evaluations
docs/            # Architecture and TypeScript migration docs
tests/           # E2E, load, and evaluation suites
```

## Commands

```bash
npm start           # Dev orchestrator (client + server)
npm run dev         # Vite client only
npm run server      # API server only
npm run restart     # Kill ports 3001/5173 and restart dev
npm run build       # Production build
npm run lint        # ESLint
npm run lint:fix    # ESLint with auto-fix
npm run lint:all    # ESLint + Stylelint
npm run format      # Prettier format all files
npm run test:unit   # Run unit tests
npm run test:e2e    # Playwright e2e tests
npm run test:coverage # Unit tests with coverage report
```

## Commit Protocol (MANDATORY)

Before EVERY commit, run all three checks in order:

1. `npx tsc --noEmit` — must exit 0
2. `npx eslint --config config/lint/eslint.config.js . --quiet` — must have 0 errors
3. `npm run test:unit` — must pass all shards

If any check fails, DO NOT commit. Fix the failures first.

A pre-commit hook enforces checks 1-2 automatically. Run `bash scripts/install-hooks.sh` after cloning.

### Integration Test Gate (Service Changes)

When modifying files in `server/src/config/services.config.ts`, `server/src/config/services.initialize.ts`, `server/src/app.ts`, `server/src/server.ts`, or `server/index.ts`, also run:

```bash
PORT=0 npx vitest run tests/integration/bootstrap.integration.test.ts tests/integration/di-container.integration.test.ts --config config/test/vitest.integration.config.js
```

If these fail, the change broke application startup or DI wiring. Fix the source code, not the tests.

### Commit Scope Rules

- Maximum ~10 files per commit unless it's a mechanical refactor (rename, import path change)
- If a fix requires touching 20+ files, stop and reconsider — there's probably a root cause fix that touches 2-3 files
- Never combine dependency upgrades with code changes in the same commit
- Never combine test infrastructure changes with production code changes

## Change Scope Limits

- Type changes to shared interfaces: must run `tsc --noEmit` BEFORE continuing to other files
- Dependency version bumps: isolated commit, nothing else in it
- If fixing types requires adding `| null` or `| undefined` to more than 3 interfaces, STOP — find the root cause instead of widening types
- If a test fix requires changing the production type to make it pass, that's a production code change, not a test fix — treat it accordingly

## Architecture Patterns

### Frontend Pattern: VideoConceptBuilder

Reference: `client/src/components/VideoConceptBuilder/`

- Orchestrator component (max ~500 lines, heuristic only)
- State via `useReducer` in `hooks/`
- API calls in `api/` (never inline in components)
- Config/constants in `config/`
- Small, focused UI components in `components/`

### Backend Pattern: PromptOptimizationService

Reference: `server/src/services/prompt-optimization/`

- Thin orchestrator service
- Specialized services for distinct responsibilities
- Templates in external `.md` files
- Validation schemas with Zod

## Code Rules

### SRP/SoC (Critical)

**Line counts are heuristics, NOT splitting triggers.**

Before modifying code, ask:
1. How many distinct responsibilities does this file have?
2. How many reasons to change? (different stakeholders, different triggers)
3. If only 1 responsibility → Don't split, even if over line threshold

### File Size Guidelines (Warnings Only)

| Type | Threshold | When to Actually Split |
|------|-----------|------------------------|
| Components | ~200 lines | Mixed presentation + business logic |
| Hooks | ~150 lines | Managing unrelated state domains |
| Services | ~300-500 lines | Multiple reasons to change |
| Utils | ~100 lines | Functions with different concerns |

### TypeScript Rules

- **No `any`**: Use `unknown` + type guards, generics, or `Record<string, unknown>`
- **No JSDoc types**: Use TypeScript annotations (JSDoc OK for descriptions/examples)
- **No magic strings**: Lift to union types or `as const` arrays
- **Zod at boundaries**: Validate API responses, user input, URL params, localStorage
- **Explicit return types**: Required for exported functions and async functions
- **Prefer `undefined`**: Over `null` (except when API explicitly returns null)

### What NOT to Do

- Split files solely because they exceed a line threshold
- Create components only used in one place
- Extract code that always changes together
- Add indirection without improving cohesion
- Use `?.` more than 2 levels deep (fix your types instead)

### What TO Do

- Split when file has multiple distinct responsibilities
- Extract when different parts have different reasons to change
- Create components when they're reusable elsewhere
- Separate orchestration from implementation details

## Environment Setup

1. Copy `.env.example` to `.env`
2. Required for local dev:
   - `VITE_FIREBASE_*` (all Firebase config vars)
   - At least one LLM key (e.g., `OPENAI_API_KEY`, `GROQ_API_KEY`)
   - `GOOGLE_APPLICATION_CREDENTIALS` (path to service account JSON for GCS/Firebase Admin)
3. Optional:
   - `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` (billing)
   - `REDIS_URL` (caching, defaults to in-memory)
   - `API_KEY` (production API auth)

## Writing Integration Tests

Read `docs/architecture/typescript/TEST_GUIDE.md` Part 3 before writing ANY integration test.

### The Cardinal Rule

**Write tests from contracts, not implementations.** Read registration files, type interfaces, route declarations, and schema definitions. Do NOT read service implementations when writing the test assertions. The test encodes what the code PROMISES to do. If the implementation doesn't match the promise, the test should fail.

Files to read for contracts:
- `server/src/config/services.config.ts` — every service name and its factory
- `server/src/config/services.initialize.ts` — initialization order and health checks
- `server/src/app.ts` — middleware stack and route registration
- `server/src/routes/*.routes.ts` — route paths and their schemas
- `server/src/schemas/*.ts` — Zod validation contracts
- `shared/taxonomy.ts` — category definitions

Files to NOT read when writing assertions:
- Service class implementations (e.g., `EnhancementService.ts` internals)
- Route handler function bodies
- LLM prompt templates
- Utility function implementations

### When Generating Integration Tests

1. Read the contract files listed above
2. Write assertions based on what the contracts promise
3. Run the test — expect failures
4. Report failures to the user with root cause analysis
5. **STOP. Do not auto-fix.** Ask the user whether to fix the source code or adjust the test spec.

### When Fixing Integration Test Failures

If the user asks you to fix failing integration tests:
- Default to fixing the SOURCE CODE, not the test
- Only modify the test if it references a service name, route path, or schema field that genuinely does not exist in any contract file
- Never weaken an assertion to make it pass (e.g., changing `.toBe(200)` to `.toBeDefined()`)
- Never add try/catch in the test to swallow errors
- Never change `expect(x).toBe(y)` to `expect(x).toBe(z)` where `z` is what the broken code returns

### Integration Test Types (Quick Reference)

| Type | When to Write | What to Assert |
|------|--------------|----------------|
| Bootstrap (Type 1) | Changed startup sequence, DI config, env validation | Server starts, health check returns 200 |
| DI Container (Type 2) | Added/removed/renamed a service registration | Every registered name resolves without throwing |
| Full-Stack Route (Type 3) | Changed middleware, auth, or route wiring | Request through real app gets expected status |
| Database (Type 4) | Changed Firestore schema, transaction logic | Data round-trips correctly through emulator |
| Workflow (Type 5) | Changed service that feeds into another service | Output of service A is valid input for service B |
| Contract (Type 6) | Integrated new external API or updated client | Client handles real response fixtures correctly |

## Documentation References

- Architecture rules: `docs/architecture/CLAUDE_CODE_RULES.md`
- TypeScript style: `docs/architecture/typescript/STYLE_RULES.md`
- Test guide (includes integration tests): `docs/architecture/typescript/TEST_GUIDE.md`
- Zod patterns: `docs/architecture/typescript/ZOD_PATTERNS.md`
- Logging: `docs/architecture/typescript/LOGGING_PATTERNS.md`

## Subsystem Guides

- See `client/CLAUDE.md` for frontend-specific guidance
- See `server/CLAUDE.md` for backend-specific guidance
