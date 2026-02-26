---
name: bugfix
description: Fix a bug using the project's invariant-first regression test protocol. Use when the user reports a bug, asks to fix broken behavior, or describes unexpected output.
---

## Bugfix Protocol

Follow this sequence exactly. Do not skip steps.

### 1. Identify the Violated Invariant

Before writing any code, answer: **what property should have held but didn't?**

Frame it as a general rule, not a specific input→output pair:
- "For any prompt with suggestions, the user never sees placeholder text"
- "For any Runway prompt, at least one lighting-style trigger is injected"
- "Dev requests with expired Firebase tokens fall back to API key auth"

### 2. Pre-Test Checklist (MANDATORY — print before writing)

Before writing the regression test, output these three lines:

```
1. Failure boundary: [HTTP route | UI component | service output | pure function]
2. Mock boundary: [list external systems mocked — and nothing else]
3. Invariant: [one sentence — "For any X, Y must hold"]
```

**If the mock boundary includes the service being fixed, STOP and move the test up one layer.**

### 3. Select Test Type by Failure Boundary

Route the test based on **where the user experienced the failure**, not where the code fix lives.

| User experienced… | Test type | Mock boundary | Example |
|---|---|---|---|
| HTTP error (4xx/5xx) | Integration test via `supertest(app)` | None — real middleware, real auth, real services | Auth fallback returning 403 |
| Wrong UI state / broken interaction | Component test with `@testing-library/react` | Network layer only (MSW or fetch mock) | Stale data after session switch |
| Wrong data / corrupt output | Service integration test with real dependency chain | External APIs only (LLM, Firebase, Stripe) | Missing triggers in augmented prompt |
| Pure function edge case | Unit test or property test (fast-check) | None | Parser returning null on empty input |

**Default to the highest layer that reproduces the bug.**

### 4. Write a Failing Regression Test

Name the file `*.regression.test.ts` so it can be audited separately.

**Use property-based tests** (fast-check) when the invariant spans a class of inputs:

```typescript
import * as fc from 'fast-check';

describe('regression: [invariant description]', () => {
  it('[invariant statement]', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 200 }),
        async (input) => {
          const result = await realPipeline.process(input);
          expect(result).toSatisfy(invariantCheck);
        }
      ),
      { numRuns: 100 }
    );
  });
});
```

**Minimize mocking.** Mock external boundaries (LLM APIs, databases, network). Never mock peer services within the same domain to passthrough.

**If your regression test mocks the service being fixed, it's wrong.**

**Name tests as invariants, not fixes:**
- ✗ `it('fixes dev API key missing when Firebase token present')`
- ✓ `it('dev requests with expired Firebase token fall back to API key auth')`

**The test MUST fail** before the fix. Run it to confirm.

### 5. Fix the Root Cause

Fix the bug in the service/hook layer, not the symptom in the UI/API layer.

### 6. Verify

Run in order:

```bash
npm run test:unit
npx tsc --noEmit
npx eslint --config config/lint/eslint.config.js . --quiet
```

All must pass.

### Test Update Rules

- **Never weaken an existing test** to accommodate a fix.
- **Never update a test and the source file it covers in the same logical change** unless the contract itself is intentionally changing.
- **Add tests, don't modify them.** Default action: add a new test case, not edit existing ones.
- A failing existing test after a bugfix is **information**, not a problem to silence.

### Anti-Patterns to Avoid

1. **Mock every dependency to passthrough** — tests call order, not behavior
2. **Assert one specific input→output** without property generalization
3. **Test implementation details** (method calls, internal state) instead of observable output
4. **Live in generic test files** without `.regression.test.ts` naming
5. **Test at the wrong layer** — unit-testing a helper when the bug was an HTTP 403

See also: `docs/architecture/BUGFIX_PROTOCOL.md`
