# Claude Code Quick Reference (Keep This Open)

## 🔴 Before Every Request: Say This

```
Follow [Frontend: VideoConceptBuilder | Backend: PromptOptimizationService] pattern.

Show me the proposed file structure BEFORE implementing.
```

---

## 📋 Copy-Paste Templates (Choose One)

### 1️⃣ New Frontend Feature (Copy This)
```
Add [FEATURE]

ARCHITECTURE: VideoConceptBuilder pattern
- ComponentName.jsx (orchestrator, max 500 lines)
- hooks/ (useReducer)
- api/ (fetch calls)
- components/ (UI < 200 lines each)

REFERENCE: client/src/components/VideoConceptBuilder/
SHOW STRUCTURE FIRST
```

### 2️⃣ New Backend Feature (Copy This)
```
Add [FEATURE]

ARCHITECTURE: PromptOptimizationService pattern
- MainService.js (orchestrator, max 500 lines)
- services/feature-name/ (specialized services < 300 lines)
- templates/ (.md files for prompts)

REFERENCE: server/src/services/prompt-optimization/PromptOptimizationService.js
SHOW STRUCTURE FIRST
```

### 3️⃣ Modify Existing Code (Copy This)
```
Modify [FILE] to [DO WHAT]

CURRENT: [file path] ([run: wc -l file])
CONSTRAINTS:
- Maintain existing pattern
- No file over [500 orchestrators | 200 components | 300 services]
- If exceeds, refactor first

SHOW WHAT CHANGES BEFORE implementing
```

### 4️⃣ Full-Stack Feature (Copy This)
```
Add [FEATURE] (full-stack)

BACKEND FIRST:
- Service: server/src/services/[name]/
- Pattern: PromptOptimizationService
- Max 500 lines orchestrator, 300 lines specialized services

THEN FRONTEND:
- Component: client/src/features/[name]/
- Pattern: VideoConceptBuilder
- Max 500 lines orchestrator, 200 lines UI components

API CONTRACT:
- [POST /api/endpoint { request }]
- Returns: { response }

SHOW COMPLETE STRUCTURE FIRST
```

---

## 🎯 Pattern Selection (CRITICAL)

**Always specify the correct pattern for the location:**

| Working On | Pattern | Reference File |
|------------|---------|----------------|
| **Frontend** (client/src/) | VideoConceptBuilder | `client/src/components/VideoConceptBuilder/` |
| **Backend** (server/src/) | PromptOptimizationService | `server/src/services/prompt-optimization/PromptOptimizationService.js` |

### Frontend Structure
```
ComponentName/
├── ComponentName.jsx (orchestrator)
├── hooks/ (useReducer, custom hooks)
├── api/ (fetch wrappers) ← Frontend uses api/
├── config/ (constants)
├── utils/ (pure functions)
└── components/ (UI pieces)
```

### Backend Structure
```
ServiceName/
├── MainService.js (orchestrator)
├── service-name/ (specialized services) ← Backend uses services/
│   ├── SpecializedService.js
│   └── Repository.js
└── templates/ (.md files)
```

**Rule of thumb:**
- `api/` = frontend fetches data
- `services/` = backend processes data

---

## 🚨 SRP/SoC Check (Do This First)

Before splitting ANY file, answer:
1. **How many distinct responsibilities?** (If 1 → don't split)
2. **How many reasons to change?** (If 1 → don't split)
3. **Would splitting improve or harm cohesion?**

**Line counts are heuristics, NOT splitting triggers.**

---

## 📋 File Size Guidelines (Warning Thresholds)

| Type | Warning Threshold | When to Split |
|------|-------------------|---------------|
| Orchestrator Component/Service | ~500 lines | Multiple unrelated flows |
| Regular UI Component | ~200 lines | Mixed presentation + business logic |
| React Hook | ~150 lines | Managing unrelated state domains |
| Specialized Service | ~300 lines | Multiple reasons to change |
| Utility | ~100 lines | Functions with different concerns |
| Config | ~200 lines | Config for different features |
| API Layer | ~150 lines | Calls to unrelated endpoints |

**Note:** These are smell indicators. A 250-line component with ONE cohesive responsibility is better than 3 artificially split files.

---

## ✅ After Every Claude Code Run

```bash
# Run this to check sizes
find client/src server/src -type f \( -name "*.js" -o -name "*.jsx" \) -exec wc -l {} + | sort -rn | head -20

# Or check specific file
wc -l [file-path]
```

---

## 📚 Reference Examples (Point to These)

**Frontend:**
- Pattern: `client/src/components/VideoConceptBuilder/`
- Docs: `client/src/components/VideoConceptBuilder/REFACTORING_SUMMARY.md`

**Backend:**
- Pattern: `server/src/services/prompt-optimization/PromptOptimizationService.js`
- Alt: `server/src/services/VideoConceptService.js`

---

## 🎯 The Formula

**Every claude-code request should have:**

1. ✓ What to build
2. ✓ Which pattern to follow (Frontend: VideoConceptBuilder | Backend: PromptOptimizationService)
3. ✓ Reference to existing example
4. ✓ File size constraints
5. ✓ "Show structure BEFORE implementing"

**Example:**
```bash
claude-code "Add PDF export feature

ARCHITECTURE: VideoConceptBuilder pattern
- Orchestrator: client/src/features/prompt-optimizer/PdfExportManager.jsx (< 500 lines)
- UI Components: components/PdfExportButton.jsx, components/PdfPreview.jsx (< 200 lines each)
- Hook: hooks/usePdfExport.js (< 150 lines)
- API: api/promptOptimizerApi.js (add exportToPdf method)

REFERENCE: client/src/components/VideoConceptBuilder/
SHOW STRUCTURE FIRST"
```

---

## 🔥 Red Flags (Stop and Evaluate)

### ❌ Mechanical Splitting (Never Do This)
- Splitting solely because file exceeds line threshold
- Creating components only used in one place
- Extracting code that always changes together
- Adding indirection without improving cohesion

### ✅ Principled Splitting (Do This)
- File has multiple distinct responsibilities
- Different parts have different reasons to change
- Extracted piece is reusable elsewhere
- Mixing orchestration with implementation details

### Code Quality Issues
- Adding API calls inline (must go in api/ layer)
- Adding useState when useReducer exists
- Copy-pasting code (extract to shared utility)
- Business logic in orchestrators (extract to hooks/services)
- Hardcoding config (extract to config/)

---

## 💡 Pro Tips

1. **Always reference existing code**: "Follow the pattern in [specific file]"
2. **Always request structure first**: "Show me the proposed structure BEFORE implementing"
3. **Always validate after**: Run `wc -l [files]` to check sizes
4. **Use project knowledge**: Your docs are indexed, mention them
5. **Be specific with limits**: "max 500 lines orchestrator, 200 lines UI components" not "keep it small"
6. **Understand orchestrator vs component**: Orchestrators compose (imports, hooks, handlers), components contain UI logic

---

## 🔧 When You Forget

If Claude Code creates a mess (god object, tight coupling, etc):

```bash
claude-code "Refactor [file] following [VideoConceptBuilder | PromptOptimizationService] pattern

CURRENT: [wc -l file] lines with [describe problems]
TARGET: Follow client/src/components/VideoConceptBuilder/REFACTORING_SUMMARY.md
SHOW REFACTORING PLAN FIRST"
```

---

## 📱 Mobile Quick Reference (Memorize This)

```
Pattern: [VideoConceptBuilder | PromptOptimizationService]
Reference: [existing similar code]
Limits: [500 orchestrator | 200 UI | 300 service]
Show structure first ← ALWAYS SAY THIS
```

That's it. Keep this tab open when using Claude Code.
