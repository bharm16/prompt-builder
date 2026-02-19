# Bugfix Protocol

When fixing a bug, follow this sequence exactly:

## Steps

1. **Write a failing test first** that reproduces the bug. If the bug is in a service, write a unit test. If the bug crosses service boundaries, write an integration test. The test must fail _before_ the fix and pass _after_.
2. **Fix the root cause** in the service/hook layer, not the symptom in the UI/API layer.
3. **Run the new test** — it must pass.
4. **Run the full existing test suite** (`npm run test:unit`) — all existing tests must still pass without modification.

## Test Update Rules During Bugfixes

- **Never weaken an existing test to accommodate a fix.** If an existing test fails after your fix, your fix changed a contract. Treat that as a separate, deliberate decision — not collateral damage.
- **Never update a test and the source file it covers in the same logical change** unless the contract itself is intentionally changing. If the contract is changing, say so explicitly in the commit message.
- **A failing existing test after a bugfix is information, not a problem to silence.** Investigate why it fails. If your fix changed observable behavior that other consumers depend on, assess the blast radius — don't just make the test green.
- **Add tests, don't modify them.** The default action for a bugfix is to _add_ a new test case, not _edit_ existing ones.
