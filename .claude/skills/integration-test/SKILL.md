---
name: integration-test
description: Write or fix integration tests for the Vidra server. Use when the user asks to write integration tests, test DI wiring, test route contracts, or validate service interactions.
allowed-tools:
  - read_file
  - write_file
  - bash
  - grep
  - edit
---

## The Cardinal Rule

**Write tests from contracts, not implementations.** Read registration files, type interfaces, route declarations, and schema definitions. Do NOT read service implementations when writing test assertions.

## Contract Files to Read

These define what the code PROMISES to do:

- `server/src/config/services.config.ts` — every service name and its factory
- `server/src/config/services.initialize.ts` — initialization order and health checks
- `server/src/app.ts` — middleware stack and route registration
- `server/src/routes/*.routes.ts` — route paths and their schemas
- `server/src/schemas/*.ts` — Zod validation contracts
- `shared/taxonomy.ts` — category definitions

## Files to NOT Read When Writing Assertions

- Service class implementations (e.g., `EnhancementService.ts` internals)
- Route handler function bodies
- LLM prompt templates
- Utility function implementations

## Workflow: Generating Integration Tests

1. Read the contract files listed above
2. Write assertions based on what the contracts promise
3. Run the test — expect failures
4. Report failures with root cause analysis
5. **STOP. Do not auto-fix.** Ask the user whether to fix the source code or adjust the test spec.

## Workflow: Fixing Failing Integration Tests

If the user asks to fix failing integration tests:

- Default to fixing the **SOURCE CODE**, not the test
- Only modify the test if it references a service name, route path, or schema field that genuinely does not exist in any contract file
- Never weaken an assertion to make it pass (e.g., changing `.toBe(200)` to `.toBeDefined()`)
- Never add try/catch in the test to swallow errors
- Never change `expect(x).toBe(y)` to `expect(x).toBe(z)` where `z` is what the broken code returns

## Integration Test Types

| Type | When to Write | What to Assert |
|------|--------------|----------------|
| Bootstrap (Type 1) | Changed startup sequence, DI config, env validation | Server starts, health check returns 200 |
| DI Container (Type 2) | Added/removed/renamed a service registration | Every registered name resolves without throwing |
| Full-Stack Route (Type 3) | Changed middleware, auth, or route wiring | Request through real app gets expected status |
| Database (Type 4) | Changed Firestore schema, transaction logic | Data round-trips correctly through emulator |
| Workflow (Type 5) | Changed service that feeds into another service | Output of service A is valid input for service B |
| Contract (Type 6) | Integrated new external API or updated client | Client handles real response fixtures correctly |

## Running Integration Tests

```bash
PORT=0 npx vitest run tests/integration/bootstrap.integration.test.ts tests/integration/di-container.integration.test.ts --config config/test/vitest.integration.config.js
```

See also: `docs/architecture/typescript/TEST_GUIDE.md` Part 3
