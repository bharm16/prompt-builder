---
name: no-fetch-in-components
enabled: true
event: file
pattern: \bfetch\s*\(
action: warn
---

`fetch()` should not be called directly in components or hooks.

Use the feature's `api/` layer or `client/src/api/` for HTTP calls. See the anti-corruption layer pattern in CLAUDE.md.
