---
name: no-any-type
enabled: true
event: file
pattern: :\s*any\b(?!thing)
action: warn
---

Do not use `any`. Use one of:

- `unknown` + type guards
- Generics with constraints
- `Record<string, unknown>`

See CLAUDE.md TypeScript Rules.
