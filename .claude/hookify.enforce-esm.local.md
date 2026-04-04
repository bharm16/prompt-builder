---
name: enforce-esm
enabled: true
event: file
pattern: (require\s*\(|__dirname|__filename)
action: block
---

This is an ESM-only codebase. Do not use CommonJS patterns.

- `require()` → use `import`
- `__dirname` → use `dirname(fileURLToPath(import.meta.url))`
- `__filename` → use `fileURLToPath(import.meta.url)`
