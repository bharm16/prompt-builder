# Claude Code Emergency Reference (Print This)

## The Only Rule

> **"How many reasons does this have to change?"**

If 1 → don't touch it.
If 2+ → split by responsibility.

---

## Quick Tests

| Test | How | Fail = Problem |
|------|-----|----------------|
| **Responsibility** | Describe in one sentence without "and" | Mixed concerns |
| **Testability** | Mock ≤2 things to test it | Too much coupling |
| **Change isolation** | Change X, only X's file changes | Shotgun surgery |

---

## 30-Second Templates

### Frontend Feature
```
Add [feature name]
PATTERN: VideoConceptBuilder
- Orchestrator: wiring only, no business logic
- hooks/: state + handlers (testable alone)
- api/: fetch + parsing
- components/: display only

REFERENCE: client/src/components/VideoConceptBuilder/
SHOW STRUCTURE FIRST
```

### Backend Service
```
Add [service name]
PATTERN: PromptOptimizationService
- MainService: coordination only, delegates everything
- services/: one responsibility each
- templates/: external .md files

REFERENCE: server/src/services/PromptOptimizationService.js
SHOW STRUCTURE FIRST
```

### Modify Existing
```
Modify [file] to [do what]

BEFORE CHANGING:
- Does this add a new responsibility? → Extract first
- Will this keep the file's description to one sentence? → If not, split

SHOW WHAT CHANGES FIRST
```

---

## Where Things Go

| Thing | Location |
|-------|----------|
| HTTP calls | api/ |
| State logic | hooks/ |
| Business rules | hooks/ (FE) or services/ (BE) |
| Pure transforms | utils/ |
| Display | components/ |
| Constants | config/ |

---

## Red Flags

❌ **Stop if you see:**
- Splitting "because it's too long"
- Component used in exactly one place
- Extracting code that always changes with its caller
- `if` statements in orchestrator

⚠️ **Investigate if you see:**
- Mocking 3+ things to test one function
- One change touching 5+ files
- Can't describe file in ≤10 words

---

## When Things Break

```
Refactor [file]

PROBLEM: [actual issue—not "too long"]
PATTERN: [VideoConceptBuilder | PromptOptimizationService]
SPLIT BY: responsibility

SHOW PLAN FIRST
```

---

## References

**Frontend:** `client/src/components/VideoConceptBuilder/`
**Backend:** `server/src/services/PromptOptimizationService.js`

---

**Full docs:** `docs/architecture/CLAUDE_CODE_RULES.md`
