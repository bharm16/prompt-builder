# Claude Code Quick Reference (Keep This Open)

## 🔴 Before Every Request: Say This

```
Follow [Frontend: VideoConceptBuilder | Backend: PromptOptimizationService] pattern.

Each file should have ONE reason to change.
Show me the proposed file structure BEFORE implementing.
```

---

## 📋 Copy-Paste Templates (Choose One)

### 1️⃣ New Frontend Feature

```
Add [FEATURE]

ARCHITECTURE: VideoConceptBuilder pattern
- ComponentName.jsx (orchestration only—no business logic)
- hooks/ (state + handlers, testable with ≤2 mocks)
- api/ (fetch calls + response parsing)
- components/ (display only—receives props, renders UI)

RESPONSIBILITY CHECK: Each file = one sentence description, no "and"
REFERENCE: client/src/components/VideoConceptBuilder/
SHOW STRUCTURE FIRST
```

### 2️⃣ New Backend Feature

```
Add [FEATURE]

ARCHITECTURE: PromptOptimizationService pattern
- MainService.js (coordination only—delegates to specialized services)
- services/feature-name/ (one responsibility per service)
- templates/ (.md files for prompts)

RESPONSIBILITY CHECK: Each service = one reason to change
REFERENCE: server/src/services/PromptOptimizationService.js
SHOW STRUCTURE FIRST
```

### 3️⃣ Modify Existing Code

```
Modify [FILE] to [DO WHAT]

BEFORE CHANGING:
- What responsibilities does this file currently have?
- Does this change add a new responsibility?
- If yes: extract to appropriate layer first

SHOW WHAT CHANGES BEFORE implementing
```

### 4️⃣ Full-Stack Feature

```
Add [FEATURE] (full-stack)

BACKEND FIRST:
- Service: server/src/services/[name]/
- Pattern: PromptOptimizationService
- Each service: one responsibility, testable with ≤2 mocks

THEN FRONTEND:
- Component: client/src/features/[name]/
- Pattern: VideoConceptBuilder
- Orchestrator: wiring only. Logic in hooks/services.

API CONTRACT:
- [POST /api/endpoint { request }]
- Returns: { response }

SHOW COMPLETE STRUCTURE FIRST
```

---

## 🎯 Pattern Selection

| Working On   | Pattern                   | Reference                                          |
| ------------ | ------------------------- | -------------------------------------------------- |
| **Frontend** | VideoConceptBuilder       | `client/src/components/VideoConceptBuilder/`       |
| **Backend**  | PromptOptimizationService | `server/src/services/PromptOptimizationService.js` |

### Frontend Structure

```
ComponentName/
├── ComponentName.jsx   → Wires pieces together. No if/else business logic.
├── hooks/              → State, handlers, derived values. Testable alone.
├── api/                → HTTP calls + response parsing. One place for endpoint changes.
├── config/             → Constants, defaults. Change without touching logic.
├── utils/              → Pure transforms. No dependencies.
└── components/         → Display. Props in, JSX out.
```

### Backend Structure

```
ServiceName/
├── MainService.js      → Coordinates. Doesn't implement.
├── services/           → One responsibility each.
│   ├── ValidationService.js
│   └── TransformService.js
├── repositories/       → Data access. Abstracts storage.
└── templates/          → External prompts.
```

---

## 🚨 The Only Questions That Matter

Before creating or splitting ANY file:

1. **"Can I describe this in one sentence without 'and'?"**
   - ✅ "Manages wizard navigation"
   - ❌ "Manages wizard navigation and validates input and saves to API"

2. **"Can I test this with ≤2 mocks?"**
   - If you need 5 mocks, it knows too much

3. **"If I change X, what else breaks?"**
   - If changing an API response touches 6 files, consolidate the parser

---

## ✅ After Every Change

Ask yourself:

| Question                                                 | If "No"                                   |
| -------------------------------------------------------- | ----------------------------------------- |
| Can I explain each file in ≤10 words?                    | Responsibility unclear—simplify or rename |
| Do files that change together live together?             | Shotgun surgery—consolidate               |
| Can I test each piece with ≤2 mocks?                     | Too much coupling—extract dependencies    |
| If I delete this file, does exactly one thing disappear? | Mixed responsibilities—split by concern   |

---

## 🔥 Red Flags

### ❌ Stop Immediately If You See

- Splitting a file "because it's too long" (not a valid reason)
- Creating a component used in exactly one place
- Extracting code that always changes with its caller
- Adding a wrapper that just calls another function

### ⚠️ Investigate If You See

- `if` statements with business logic in an orchestrator
- A function using more data from another module than its own
- Mocking 3+ things to test one function
- "utils" file with unrelated functions

---

## 📚 Reference

**Frontend:** `client/src/components/VideoConceptBuilder/`
**Backend:** `server/src/services/PromptOptimizationService.js`

---

## 🔧 When Things Go Wrong

```
Refactor [file] following [pattern]

PROBLEM: [describe actual issue—multiple responsibilities, hard to test, etc.]
NOT: "it's too long"

SPLIT BY: responsibility, not arbitrary boundaries
SHOW REFACTORING PLAN FIRST
```

---

## 📱 Quick Memory Aid

```
Pattern: [VideoConceptBuilder | PromptOptimizationService]
Test: One sentence description, no "and"
Test: ≤2 mocks to test it
Show structure first
```
