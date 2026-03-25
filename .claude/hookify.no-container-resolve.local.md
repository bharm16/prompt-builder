---
name: no-container-resolve
enabled: true
event: file
pattern: container\.resolve\(
action: warn
---

`container.resolve()` is only allowed in:

- `server/src/config/routes.config.ts`
- `server/src/config/routes/*.registration.ts`
- `server/src/config/services.config.ts`
- `server/src/config/services.initialize.ts`

Services must use **constructor injection** — receive dependencies as constructor args, never resolve them directly.
