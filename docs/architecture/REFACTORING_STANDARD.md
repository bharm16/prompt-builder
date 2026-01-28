# Prompt Builder Refactoring Standard

## Core Principle

> **"How many reasons does this have to change?"**

If 1 → don't split.
If 2+ → split by responsibility.

---

## When to Refactor

**Split when:**
- File has multiple distinct responsibilities
- Different parts have different reasons to change
- You want to test parts independently
- Parts could be reused elsewhere

**Don't split when:**
- File has one responsibility (even if it's long)
- Pieces always change together
- Pieces only make sense together
- You're just hitting some arbitrary threshold

---

## Component Structure Pattern

When a component has **multiple distinct responsibilities**, refactor to:

```
ComponentName/
├── ComponentName.jsx     → Orchestration: wires pieces, no business logic
├── hooks/                → State + handlers: testable without rendering
├── api/                  → Fetch + parsing: one place for endpoint changes
├── utils/                → Pure transforms: no dependencies
├── config/               → Constants: change without touching logic
└── components/           → Display: props in, JSX out (only if reused)
```

**Test:** Can you describe each file in one sentence without "and"?

---

## Service Structure Pattern

When a service has **multiple distinct responsibilities**, refactor to:

```
ServiceName/
├── ServiceName.js        → Coordination: delegates, doesn't implement
├── services/             → One responsibility per file
├── repositories/         → Data access abstraction
└── templates/            → External prompts (.md files)
```

**Test:** Can you test each service with ≤2 mocks?

---

## Code Review Checklist

Before merging:

- [ ] Each file describable in ≤10 words
- [ ] Each file testable with ≤2 mocks
- [ ] Files that change together live together
- [ ] No business logic in orchestrators
- [ ] API calls in api/ layer
- [ ] No artificial splits (pieces that always change together)

### ❌ Reject If:

- Split because "it was too long" (not a valid reason)
- Component created that's used in exactly one place
- Code extracted that always changes with its caller
- Indirection added without improving testability

### ✅ Approve If:

- Split separates distinct responsibilities
- Each piece has one reason to change
- Each piece is independently testable
- Cohesion is improved (not just size reduced)
