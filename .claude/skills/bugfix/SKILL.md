---
name: bugfix
description: Fix a bug using the project's test-first bugfix protocol. Use when the user reports a bug, asks to fix broken behavior, or describes unexpected output.
allowed-tools:
  - read_file
  - write_file
  - bash
  - grep
  - edit
---

## Bugfix Protocol

Follow this sequence exactly. Do not skip steps.

### 1. Reproduce

Identify the failing behavior. Read the relevant service/component code to understand the root cause.

### 2. Write a Failing Test

Write a test that reproduces the bug BEFORE writing any fix.

- Bug in a service → unit test in `server/src/services/<domain>/__tests__/`
- Bug in a hook → unit test in `client/src/features/<feature>/hooks/__tests__/` or `client/src/hooks/__tests__/`
- Bug crossing service boundaries → integration test in `tests/integration/`

The test must **fail** before the fix and **pass** after.

### 3. Fix the Root Cause

Fix the bug in the service/hook layer, not the symptom in the UI/API layer.

### 4. Verify

Run in order:

```bash
npm run test:unit
npx tsc --noEmit
npx eslint --config config/lint/eslint.config.js . --quiet
```

All must pass.

### Test Update Rules

- **Never weaken an existing test** to accommodate a fix. If an existing test fails, your fix changed a contract — investigate the blast radius.
- **Never update a test and the source file it covers in the same logical change** unless the contract itself is intentionally changing.
- **Add tests, don't modify them.** The default action is to add a new test case, not edit existing ones.
- A failing existing test after a bugfix is **information**, not a problem to silence.

See also: `docs/architecture/BUGFIX_PROTOCOL.md`
