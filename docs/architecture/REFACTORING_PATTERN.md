# Prompt Builder Refactoring Pattern

## Core Principle: SRP/SoC Over Line Counts

**Before refactoring ANY file, answer these questions:**

1. **How many distinct responsibilities** does this file have?
2. **How many reasons to change?** (different stakeholders, different triggers)
3. **Would splitting improve or harm cohesion?**

**If a file has ONE cohesive responsibility → Don't split, even if over 500 lines.**

---

## Our Standard Architecture

Based on successful VideoConceptBuilder refactoring:
```
ComponentName/
├── ComponentName.jsx         (~300-500 lines, orchestration only)
├── hooks/                    (business logic, state management)
├── api/                      (all fetch calls)
├── utils/                    (pure functions)
├── config/                   (configuration)
└── components/               (presentational components - only if reusable)
```

**Only create subdirectories for files with DISTINCT responsibilities.**

---

## Refactoring Checklist

When refactoring a component with MULTIPLE RESPONSIBILITIES:

1. [ ] Create directory structure
2. [ ] Extract API calls to api/
3. [ ] Convert useState to useReducer in hooks/
4. [ ] Extract config to config/
5. [ ] Extract business logic to hooks/
6. [ ] Break JSX into components/
7. [ ] Wire everything together in main component
8. [ ] Verify tests pass
9. [ ] Create REFACTORING_SUMMARY.md

## Claude Code Requests

Use this template:

"Refactor [Component] following the pattern in VideoConceptBuilder/REFACTORING_SUMMARY.md

SRP CHECK (answer before implementing):
1. How many distinct responsibilities does this have?
2. How many reasons to change?
3. If only 1 responsibility → explain why split is needed anyway

[Paste specific requirements]

Show me the proposed structure before implementing."

---

## ❌ When NOT to Refactor

- File exceeds line threshold but has ONE cohesive responsibility
- Splitting would create components only used in one place
- Extracted code would always change together with parent
- Splitting adds indirection without improving cohesion

## ✅ When to Refactor

- File has multiple distinct responsibilities
- Different parts have different reasons to change
- Extracted pieces would be reusable elsewhere
- Orchestration is mixed with implementation details
