---
name: enforce-esm
enabled: true
event: file
action: block
conditions:
  - field: new_text, operator: regex_match, pattern: (require\s*\(|__dirname|__filename)
  - field: file_path, operator: not_contains, pattern: .md
---

This is an ESM-only codebase. Do not use CommonJS patterns.

- `require()` → use `import`
- `__dirname` → use `dirname(fileURLToPath(import.meta.url))`
- `__filename` → use `fileURLToPath(import.meta.url)`

Markdown files (`.md`) are excluded because these tokens legitimately appear inside docs describing the rule itself.
