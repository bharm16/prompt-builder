---
name: deploy-check
description: Run the full pre-deploy validation pipeline (tsc, lint, unit tests, e2e, build) and stop on first failure. Use when preparing to deploy, merge, or hand off work.
disable-model-invocation: true
---

## Pre-Deploy Validation Pipeline

Run each step in order. **Stop immediately on first failure** — do not continue to the next step.

### Step 1: Type Check

```bash
npx tsc --noEmit
```

If this fails, fix all type errors before proceeding. Do NOT add `any` to silence errors.

### Step 2: Lint

```bash
npx eslint --config config/lint/eslint.config.js . --quiet
```

If errors are found, fix them. Warnings can be noted but do not block.

### Step 3: Unit Tests

```bash
npm run test:unit
```

All shards must pass. If a test fails, investigate and fix — do not skip or `.skip()` tests.

### Step 4: E2E Tests (Optional — Run If Available)

```bash
npm run test:e2e
```

If Playwright is not installed or no e2e tests exist for the changed area, skip this step and note it.

### Step 5: Production Build

```bash
npm run build
```

The build must complete without errors. Build warnings should be noted but do not block.

### Output Format

After all steps complete (or on first failure), report:

```
## Deploy Check Results

| Step | Status | Duration |
|------|--------|----------|
| Type Check | PASS/FAIL | Xs |
| Lint | PASS/FAIL | Xs |
| Unit Tests | PASS/FAIL | Xs |
| E2E Tests | PASS/FAIL/SKIPPED | Xs |
| Build | PASS/FAIL | Xs |

### Verdict: READY / NOT READY

[If NOT READY, list the blocking failures with details]
```

### Integration Test Gate

If any of these files were modified in the current branch, also run the integration test gate **before Step 3**:

- `server/src/config/services.config.ts`
- `server/src/config/services.initialize.ts`
- `server/src/app.ts`
- `server/src/server.ts`
- `server/index.ts`

```bash
PORT=0 npx vitest run tests/integration/bootstrap.integration.test.ts tests/integration/di-container.integration.test.ts --config config/test/vitest.integration.config.js
```
