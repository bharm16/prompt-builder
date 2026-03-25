---
name: eslint-quiet
enabled: true
event: bash
pattern: npx eslint(?!.*--quiet)
action: warn
---

Always use `--quiet` flag with ESLint to suppress warnings and show only errors:

```
npx eslint --config config/lint/eslint.config.js . --quiet
```
