# Claude Code Request Templates

Copy-paste these templates when working with Claude Code to maintain architectural consistency.

---

## The Principle

**Split by responsibility, not by size.**

Before creating or modifying any file, answer:
1. "Can I describe this in one sentence without 'and'?"
2. "Can I test this with ≤2 mocks?"
3. "Does this have exactly one reason to change?"

If all answers are yes, you're good. If not, refactor by responsibility.

---

## Template 1: New Frontend Component

```
Add [FEATURE NAME] component

ARCHITECTURE (VideoConceptBuilder pattern):
- ComponentName.jsx → Orchestration only. Wires hooks, components, handlers. No business logic.
- hooks/useComponentState.js → State + handlers. Testable without rendering.
- api/componentApi.js → Fetch calls + response parsing. One place for endpoint changes.
- utils/componentUtils.js → Pure transforms. No dependencies.
- config/componentConfig.js → Constants, defaults. Change without touching logic.
- components/ → Display pieces. Props in, JSX out.

RESPONSIBILITY CHECK (answer these):
1. Can each file be described in one sentence without "and"?
2. Can each piece be tested with ≤2 mocks?
3. Do files that change together live together?

REFERENCE: client/src/components/VideoConceptBuilder/

BEFORE IMPLEMENTING:
1. Show proposed file structure
2. State the single responsibility of each file
3. Confirm no business logic in orchestrator
```

---

## Template 2: Modify Existing Frontend Component

```
Modify [COMPONENT NAME] to [FEATURE DESCRIPTION]

CURRENT: [path to component]

BEFORE CHANGING, ANSWER:
1. Does this change add a NEW responsibility to an existing file?
   - If yes → extract to appropriate layer first
2. Will files that should change together still live together?
3. Am I adding business logic to an orchestrator?
   - If yes → put it in a hook instead

CONSTRAINTS:
- API calls → api/ layer
- State logic → hooks/
- Pure transforms → utils/
- Display → components/

REFERENCE: client/src/components/VideoConceptBuilder/

SHOW WHAT CHANGES BEFORE implementing
```

---

## Template 3: New Backend Service

```
Add [SERVICE NAME] service

ARCHITECTURE (PromptOptimizationService pattern):
- MainService.js → Coordination only. Delegates everything.
- services/[name]/
  - [Responsibility]Service.js → One reason to change per file
  - Repository.js → Data access abstraction
- templates/ → External .md files for prompts

RESPONSIBILITY CHECK:
1. Can each service be described in one sentence without "and"?
2. Can each service be tested with ≤2 mocks?
3. Is the orchestrator free of implementation details?

PATTERNS:
- Dependency injection (constructor)
- Repository pattern for data access
- Templates external, not hardcoded

REFERENCE: server/src/services/PromptOptimizationService.js

BEFORE IMPLEMENTING:
1. Show proposed service hierarchy
2. State the single responsibility of each service
3. Show dependency graph
```

---

## Template 4: Modify Existing Backend Service

```
Modify [SERVICE NAME] to [FEATURE DESCRIPTION]

CURRENT: server/src/services/[ServiceName]/

BEFORE CHANGING, ANSWER:
1. Which specialized service owns this responsibility?
   - If none → create one
   - If unclear → the responsibility isn't well-defined
2. Will this keep the orchestrator thin (coordination only)?
3. Does the new code have the same reason to change as existing code?
   - If no → separate file

CONSTRAINTS:
- New business logic → new specialized service
- New data access → extend/create repository
- New prompts → add .md template file
- Orchestrator stays coordination-only

REFERENCE: server/src/services/[similar service]/

SHOW WHERE LOGIC WILL LIVE BEFORE implementing
```

---

## Template 5: Full-Stack Feature

```
Add [FEATURE NAME] (full-stack)

BACKEND FIRST:
- Location: server/src/services/[name]/
- Pattern: PromptOptimizationService
- Each service: one responsibility, testable with ≤2 mocks

THEN FRONTEND:
- Location: client/src/features/[name]/ or client/src/components/[name]/
- Pattern: VideoConceptBuilder
- Orchestrator: wiring only. All logic in hooks/services.

API CONTRACT (define first):
- Endpoint: [method] [path]
- Request: { shape }
- Response: { shape }

IMPLEMENTATION ORDER:
1. Backend service + tests
2. Frontend api/ layer (owns response parsing)
3. Frontend hooks/ (owns state logic)
4. Frontend components (display only)

BEFORE IMPLEMENTING:
1. Show complete structure (both ends)
2. State responsibility of each file
3. Show API contract
```

---

## Template 6: Refactor Existing Code

```
Refactor [FILE/COMPONENT NAME]

CURRENT PROBLEM (be specific):
- [What smells? God object? Mixed concerns? Hard to test?]
- NOT: "it's too long"

TARGET:
- Pattern: [VideoConceptBuilder | PromptOptimizationService]
- Each extracted piece: one sentence description, no "and"

REFACTORING BY RESPONSIBILITY:
1. Identify distinct responsibilities in current file
2. Create one file per responsibility
3. Orchestrator coordinates, doesn't implement
4. Each piece testable with ≤2 mocks

VALIDATION AFTER:
- Can I describe each file in ≤10 words?
- Do files that change together live together?
- Can I test each piece with ≤2 mocks?
- If I delete a file, does exactly one capability disappear?

REFERENCE: client/src/components/VideoConceptBuilder/REFACTORING_SUMMARY.md

SHOW REFACTORING PLAN FIRST
```

---

## Quick Reference: Where Things Go

| Concern | Frontend Location | Backend Location |
|---------|-------------------|------------------|
| Coordination | ComponentName.jsx | MainService.js |
| State/Logic | hooks/ | services/[name]/ |
| Data fetching | api/ | repositories/ |
| Pure transforms | utils/ | utils/ |
| Configuration | config/ | config/ or templates/ |
| Display | components/ | N/A |

**The test:** If you're importing across these boundaries to make a single change, the responsibility is in the wrong place.

---

## Code Smells to Call Out

When reviewing Claude's output, watch for:

| Smell | Symptom | Fix |
|-------|---------|-----|
| **Feature Envy** | Function uses another module's data more than its own | Move the function |
| **Shotgun Surgery** | One change requires editing 5+ files | Consolidate responsibility |
| **God Object** | Everything depends on one file | Split by responsibility |
| **Orchestrator with Logic** | `if`/`switch` business logic in main file | Extract to hook/service |
| **Artificial Split** | Two files that always change together | Merge them |

---

## Validation Questions

After any change:

1. **Can I explain each file in ≤10 words?**
2. **Do files that change together live together?**
3. **Can I test each piece with ≤2 mocks?**
4. **If I delete this file, does exactly one thing disappear?**

If any answer is "no," you have a cohesion problem.

---

## Reference Implementations

**Frontend:** `client/src/components/VideoConceptBuilder/`
- Read `REFACTORING_SUMMARY.md` for the *why*

**Backend:** `server/src/services/PromptOptimizationService.js`
- Thin orchestrator delegating to specialized services
