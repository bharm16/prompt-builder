# Prompt Builder Refactoring Standard

## Core Principle: SRP/SoC Over Line Counts

**Line counts are heuristics, NOT splitting triggers.** Before splitting any file:

1. **Identify distinct responsibilities** - Does the file have multiple reasons to change?
2. **Check for mixed concerns** - Is orchestration mixed with implementation?
3. **Evaluate cohesion** - Would splitting improve or harm cohesion?

**If a file has ONE cohesive responsibility → Don't split, even if over threshold.**

---

## Component Structure Pattern
Based on successful VideoConceptBuilder and PromptOptimizer refactorings.

When a component has **multiple distinct responsibilities** (not just exceeds a line count), refactor to:
```
ComponentName/
├── ComponentName.jsx         (~300-500 lines max)
├── hooks/                    (state + business logic)
├── api/                      (all fetch calls)
├── utils/                    (pure functions)
├── config/                   (configuration data)
└── components/               (presentational UI)
```

## Service Structure Pattern
When a service exceeds 500 lines, refactor to:
- Thin orchestrator (main service file)
- Specialized services for each concern
- Repository pattern for data access
- Strategy pattern for mode-specific behavior
- Externalized templates (markdown files)

## Code Review Checklist
Before merging:
- [ ] Files with multiple responsibilities are properly split
- [ ] No mechanical splitting (line count alone is not a reason)
- [ ] API calls centralized in api/ layer
- [ ] Business logic in hooks/ or services/
- [ ] Config in config/ files
- [ ] Follows existing refactoring patterns

### ❌ Reject If:
- File split solely because it exceeded a line threshold
- Components created that are only used in one place
- Code extracted that always changes together
- Indirection added without improving cohesion

### ✅ Approve If:
- Split separates distinct responsibilities
- Extracted pieces are reusable
- Different parts have different reasons to change
- Cohesion is improved
