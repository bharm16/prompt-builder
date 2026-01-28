# Prompt Builder Refactoring Pattern

## Core Principle

> **"How many reasons does this have to change?"**

If 1 → don't refactor.
If 2+ → split by responsibility.

---

## Before Refactoring Anything

Answer these:

1. **Can I describe this file in one sentence without "and"?**
   - Yes → Don't split
   - No → Identify the distinct responsibilities

2. **Can I test this with ≤2 mocks?**
   - Yes → Coupling is fine
   - No → Extract what you're mocking

3. **If I change X, does only X's file change?**
   - Yes → Boundaries are good
   - No → Consolidate or clarify boundaries

---

## Our Standard Architecture

```
ComponentName/
├── ComponentName.jsx     → Orchestration: wires pieces, no logic
├── hooks/                → State + handlers: testable without rendering
├── api/                  → Fetch + parsing: one place for endpoint changes
├── utils/                → Pure transforms: no dependencies
├── config/               → Constants: change without touching logic
└── components/           → Display: props in, JSX out (only if reused)
```

**Only create subdirectories for DISTINCT responsibilities.**

---

## Refactoring Checklist

When a component has MULTIPLE RESPONSIBILITIES:

1. [ ] Identify distinct responsibilities (list them)
2. [ ] Create one location per responsibility
3. [ ] Extract API calls → api/
4. [ ] Extract state logic → hooks/ (useReducer)
5. [ ] Extract pure transforms → utils/
6. [ ] Extract constants → config/
7. [ ] Extract reusable display → components/
8. [ ] Main file becomes orchestration only
9. [ ] Each piece testable with ≤2 mocks
10. [ ] Document in REFACTORING_SUMMARY.md

---

## Claude Code Refactoring Template

```
Refactor [Component]

PROBLEM: [describe actual issue—multiple responsibilities, hard to test, etc.]
NOT: "it's too long"

RESPONSIBILITY ANALYSIS:
1. [Responsibility A] → will become hooks/useX.js
2. [Responsibility B] → will become api/xApi.js
3. [Responsibility C] → will become utils/xUtils.js

VALIDATION:
- Each file describable in ≤10 words
- Each file testable with ≤2 mocks
- Main file has no business logic

REFERENCE: VideoConceptBuilder/REFACTORING_SUMMARY.md
SHOW PLAN FIRST
```

---

## ❌ When NOT to Refactor

- Splitting would create files that always change together
- Splitting would create components used in exactly one place
- The file has one responsibility (even if it's long)
- You're adding indirection without improving testability

## ✅ When to Refactor

- File has multiple distinct responsibilities
- Different parts have different reasons to change
- You want to test parts independently
- Parts could be reused elsewhere
- Orchestration is mixed with implementation
