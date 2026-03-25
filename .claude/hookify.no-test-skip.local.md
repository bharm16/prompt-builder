---
name: no-test-skip
enabled: true
event: file
pattern: \.(skip|only)\s*\(
action: warn
---

Do not skip or isolate tests. Fix failing tests instead of skipping them.

- `.skip()` hides regressions
- `.only()` silently skips the rest of the suite

If a test needs to be disabled temporarily, add a TODO comment explaining why and create a tracking issue.
