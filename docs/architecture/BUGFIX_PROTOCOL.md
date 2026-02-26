# Bugfix Protocol

When fixing a bug, follow this sequence exactly.

## Why This Protocol Exists

A regression test that mocks every dependency and asserts one specific input→output pair does not prevent regressions. It tests that the fix works for the exact case you already found. The bug will recur through a different code path, with a different input, and your test won't fire.

Effective regression tests assert **violated invariants** at the **failure boundary** — the layer where the bug was observable to the user.

## Steps

### 1. Identify the Violated Invariant

Before writing any code, answer: **what property should have held but didn't?**

Bad: "The function returned null when it should have returned an array."
Good: "For any prompt with suggestions, the user should never see placeholder text in the output."

Bad: "The auth header was missing the API key."
Good: "Dev requests with expired Firebase tokens fall back to API key auth."

The invariant is the general rule. The bug is one instance where the rule was violated.

### 2. Pre-Test Checklist (MANDATORY)

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

**Default to the highest layer that reproduces the bug.** A test at the HTTP layer catches bugs in middleware, services, AND the function — a unit test only catches bugs in the function.

### 4. Write a Regression Test That Asserts the Invariant

Name the test file `*.regression.test.ts` so it can be audited separately.

**Use property-based tests** (fast-check) when the invariant spans a class of inputs:

```typescript
// GOOD: Tests the invariant across input classes
it('never produces placeholder text in suggestion output', async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.string({ minLength: 1, maxLength: 200 }),
      async (input) => {
        const result = await pipeline.process(input);
        for (const suggestion of result.suggestions) {
          expect(suggestion.text).not.toMatch(/\[.*\]|placeholder|TODO/i);
        }
      }
    ),
    { numRuns: 100 }
  );
});
```

```typescript
// BAD: Tests the specific fix, not the invariant
it('returns array instead of null for empty input', () => {
  const result = service.process('');
  expect(result).toEqual([]);
});
```

**Test at the failure boundary**, not at the fix location:

```typescript
// GOOD: Bug was an HTTP 403 → test hits the real HTTP route
it('accepts request with expired Firebase token when API key is present', async () => {
  const res = await request(app)
    .post('/api/optimize-stream')
    .set('X-Firebase-Token', 'expired-token')
    .set('X-API-Key', 'dev-key-12345')
    .send({ prompt: 'test', mode: 'video' });
  expect(res.status).not.toBe(403);
});

// BAD: Bug was an HTTP 403 → test mocks everything and checks a helper function
it('includes dev API key fallback', async () => {
  vi.mock('@/config/firebase', () => ({ auth: mockAuth }));
  const headers = await buildFirebaseAuthHeaders();
  expect(headers['X-API-Key']).toBe('dev-key-12345');
});
```

**Name tests as invariants, not fixes:**
- ✗ `it('fixes dev API key missing when Firebase token present')`
- ✓ `it('dev requests with expired Firebase token fall back to API key auth')`

**If your regression test mocks the service being fixed, it's wrong.** Move the mock boundary outward until only external systems (LLM APIs, databases, cloud storage) are mocked.

### 5. Verify the Test Fails Before the Fix

Run the test against the current (broken) code. If it passes, your test doesn't capture the bug — rewrite it.

### 6. Fix the Root Cause

Fix the bug in the service/hook layer, not the symptom in the UI/API layer.

### 7. Verify

Run in order:

```bash
npm run test:unit        # All tests pass (including your new regression test)
npx tsc --noEmit         # Type check
npx eslint --config config/lint/eslint.config.js . --quiet  # Lint
```

### 8. Commit

The commit-msg hook enforces that any commit with a `fix:` or `fix(` message prefix includes at least one new test. If your fix commit doesn't add a test, the commit will be rejected.

## Test Quality Checklist

Before considering your regression test complete, verify:

- [ ] **Tests at the failure boundary.** If the user saw an HTTP error, the test hits an HTTP route. If they saw wrong UI, the test renders a component.
- [ ] **Tests the invariant, not the fix.** Would this test catch a *different* bug in the same category?
- [ ] **Minimal mocking.** External boundaries only (LLM APIs, databases). Never mock peer services to passthrough.
- [ ] **Does not mock the service being fixed.** The mock boundary is strictly outward of the fix.
- [ ] **Named as regression.** File is `*.regression.test.ts` for auditability.
- [ ] **Uses property testing when applicable.** If the invariant is "for all X, Y holds," use fast-check.
- [ ] **Fails without the fix.** You verified this before implementing the fix.

## Test Update Rules During Bugfixes

- **Never weaken an existing test to accommodate a fix.** If an existing test fails after your fix, your fix changed a contract. Treat that as a separate, deliberate decision — not collateral damage.
- **Never update a test and the source file it covers in the same logical change** unless the contract itself is intentionally changing. If the contract is changing, say so explicitly in the commit message.
- **A failing existing test after a bugfix is information, not a problem to silence.** Investigate why it fails. If your fix changed observable behavior that other consumers depend on, assess the blast radius — don't just make the test green.
- **Add tests, don't modify them.** The default action for a bugfix is to _add_ a new test case, not _edit_ existing ones.

## Auditing Regression Tests

```bash
npm run test:regression          # Run only regression tests
npm run test:regression:list     # List all regression test files
npm run test:regression:quality  # Check for internal mock violations
```

Review regression tests periodically. Each one should:
1. Name the invariant it protects in the `describe` block
2. Test at the failure boundary, not the fix location
3. Use property-based testing where the invariant spans input classes
4. Mock only external boundaries, not peer services
