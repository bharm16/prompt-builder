---
name: shared-purity
enabled: true
event: file
pattern: (from\s+['"]node:|from\s+['"]react|from\s+['"]express|\bfetch\s*\()
action: warn
---

Code in `shared/` must be pure — no Node.js APIs, no React, no fetch, no I/O.

Only pure functions that operate on data (validation, parsing, condition matching) belong here. Move framework-dependent code to `client/src/` or `server/src/`.
