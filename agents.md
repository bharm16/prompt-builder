# Codex Agent Guide (Vidra / PromptCanvas)

This file is for Codex agents working in this repository.  
Do not replace existing `CLAUDE.md` / `GEMINI.md` files; use this as Codex-specific operating guidance.

## Project Snapshot

- Monorepo: Node.js 20+, ESM (`"type": "module"`).
- Client: React 18 + Vite + Tailwind + DaisyUI.
- Server: Express + TypeScript (`tsx`) with LLM/Firebase/Stripe integrations.
- Shared imports: `#shared/*`.

## Primary Workflows

### 1) Feature Workflow
1. Read relevant scope docs and impacted modules first (`client/`, `server/`, `shared/`).
2. Implement using established patterns:
   - Frontend: `client/src/components/VideoConceptBuilder/` style (orchestrator + hooks + api + components).
   - Backend: `server/src/services/prompt-optimization/` style (thin orchestrator + specialized services).
3. Add/update tests close to changed behavior.
4. Run targeted verification first, then full checks before handoff.

### 2) Bugfix Workflow
1. Reproduce with the smallest deterministic path.
2. Add a failing test when practical.
3. Fix root cause (not symptom) in service/hook layer first, then UI/API layer.
4. Re-run the failing test, then regression checks.

### 3) Performance Workflow
1. Start app and verify baseline behavior.
2. Use highlight/perf scripts to measure before/after.
3. Change one variable at a time and keep a short measurement note.
4. Validate no regression in unit/e2e smoke tests.

### 4) Data Migration / Backfill Workflow
1. Run dry-run modes first where available.
2. Validate expected record count/sample output.
3. Execute real migration only after dry-run is clean.
4. Re-check key API paths and logs.

## Command Reference

### Setup / Dev
```bash
npm install
npm start
npm run dev
npm run server
npm run restart
```

### Build / Lint / Format
```bash
npm run build
npm run lint
npm run lint:fix
npm run lint:css
npm run lint:all
npm run format
npm run format:check
```

### Test
```bash
npm run test
npm run test:unit
npm run test:coverage
npm run test:e2e
npm run test:e2e:debug
npm run test:all
```

### Evaluations / Quality Gates
```bash
npm run eval:span
npm run eval:suggestions
npm run eval:optimization
npm run eval:regression
npm run quality:gate
```

### Performance / Diagnostics
```bash
npm run verify-keys
npm run highlight-stats
npm run highlight-stats:watch
npm run test:e2e:latency
npm run perf:monitor
npm run perf:stats
npm run perf:metrics
```

### Model Capability Sync
```bash
npm run sync:capabilities
```

### Migrations
```bash
npm run migrate:rerender:dry
npm run migrate:rerender
npm run migrate:rerender:regenerate
npm run migrate:backfill:dry
npm run migrate:backfill
```

## Guardrails for Codex

- Keep routes/controllers thin; business logic belongs in `server/src/services`.
- Keep API calls out of React components; use `client/src/api`.
- Prefer TypeScript, explicit types, and Zod at boundaries.
- Avoid splitting files purely by line count; split by responsibility/reason-to-change.
- Preserve existing architecture conventions unless task explicitly requires refactor.

## Writing Integration Tests

Read `docs/architecture/typescript/TEST_GUIDE.md` Part 3 before writing ANY integration test.

### The Cardinal Rule

**Write tests from contracts, not implementations.** Read registration files, type interfaces, route declarations, and schema definitions. Do NOT read service implementations when writing test assertions. The test encodes what the code PROMISES to do. If the implementation doesn't match the promise, the test should fail.

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

## Commit Protocol (MANDATORY)

Before EVERY commit, run all three checks in order:

1. `npx tsc --noEmit` — must exit 0
2. `npx eslint --config config/lint/eslint.config.js . --quiet` — must have 0 errors
3. `npm run test:unit` — must pass all shards

If any check fails, DO NOT commit. Fix the failures first.

A pre-commit hook enforces checks 1-2 automatically. Run `bash scripts/install-hooks.sh` to install it.

### Integration Test Gate (Service Changes)

When modifying files in `server/src/config/services.config.ts`, `server/src/config/services.initialize.ts`, `server/src/app.ts`, `server/src/server.ts`, or `server/index.ts`, also run:

```bash
PORT=0 npx vitest run tests/integration/bootstrap.integration.test.ts tests/integration/di-container.integration.test.ts --config config/test/vitest.integration.config.js
```

If these fail, the change broke application startup or DI wiring. Fix the source code, not the tests.

### Commit Scope Rules

- Maximum ~10 files per commit unless it's a mechanical refactor (rename, import path change).
- If a fix requires touching 20+ files, stop and reconsider — there's probably a root cause fix that touches 2-3 files.
- Never combine dependency upgrades with code changes in the same commit.
- Never combine test infrastructure changes with production code changes.

### Change Scope Limits

- Type changes to shared interfaces: must run `tsc --noEmit` BEFORE continuing to other files.
- Dependency version bumps: isolated commit, nothing else in it.
- If fixing types requires adding `| null` or `| undefined` to more than 3 interfaces, STOP — find the root cause instead of widening types.
- If a test fix requires changing the production type to make it pass, that's a production code change, not a test fix — treat it accordingly.

## Validation Order Before Handoff

1. `npx tsc --noEmit`
2. `npm run lint:all`
3. `npm run test:unit`
4. `npm run test:e2e` (or targeted e2e spec if scope is narrow)
5. `npm run build`

## Useful References

- `/Users/bryceharmon/Desktop/prompt-builder/README.md`
- `/Users/bryceharmon/Desktop/prompt-builder/CLAUDE.md`
- `/Users/bryceharmon/Desktop/prompt-builder/GEMINI.md`
- `/Users/bryceharmon/Desktop/prompt-builder/client/GEMINI.md`
- `/Users/bryceharmon/Desktop/prompt-builder/server/GEMINI.md`
- `/Users/bryceharmon/Desktop/prompt-builder/scripts/README.md`
- `/Users/bryceharmon/Desktop/prompt-builder/docs/architecture/typescript/TEST_GUIDE.md` (Part 3: Integration Tests)
