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
- ComponentName.jsx (max 300 lines)
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

REFERENCE: server/src/services/PromptOptimizationService.js
SHOW STRUCTURE FIRST
```

### 3️⃣ Modify Existing Code (Copy This)
```
Modify [FILE] to [DO WHAT]

CURRENT: [file path] ([run: wc -l file])
CONSTRAINTS:
- Maintain existing pattern
- No file over [200 for components | 300 for services]
- If exceeds, refactor first

SHOW WHAT CHANGES BEFORE implementing
```

### 4️⃣ Full-Stack Feature (Copy This)
```
Add [FEATURE] (full-stack)

BACKEND FIRST:
- Service: server/src/services/[name]/
- Pattern: PromptOptimizationService
- Max 300 lines per service

THEN FRONTEND:
- Component: client/src/features/[name]/
- Pattern: VideoConceptBuilder
- Max 200 lines per component

API CONTRACT:
- [POST /api/endpoint { request }]
- Returns: { response }

SHOW COMPLETE STRUCTURE FIRST
```

---

## 🚨 File Size Limits (Enforce These)

| Type | Max Lines |
|------|-----------|
| React Component | **200** |
| React Hook | **150** |
| Backend Service | **300** (orchestrators: 500) |
| Utility | **100** |
| Config | **200** |

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
- Pattern: `server/src/services/PromptOptimizationService.js`
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
claude-code "Add PDF export button

ARCHITECTURE: VideoConceptBuilder pattern
- Component: client/src/features/prompt-optimizer/components/PdfExportButton.jsx (< 200 lines)
- Hook: hooks/usePdfExport.js (< 150 lines)
- API: api/promptOptimizerApi.js (add exportToPdf method)

REFERENCE: client/src/components/VideoConceptBuilder/components/
SHOW STRUCTURE FIRST"
```

---

## 🔥 Red Flags (Stop and Refactor First)

- File approaching 200 lines (components) or 300 lines (services)
- Adding API calls inline (must go in api/ layer)
- Adding useState when useReducer exists
- Copy-pasting code (extract to shared utility)
- Mixing UI and business logic
- Hardcoding config (extract to config/)

---

## 💡 Pro Tips

1. **Always reference existing code**: "Follow the pattern in [specific file]"
2. **Always request structure first**: "Show me the proposed structure BEFORE implementing"
3. **Always validate after**: Run `wc -l [files]` to check sizes
4. **Use project knowledge**: Your docs are indexed, mention them
5. **Be specific**: "max 200 lines" not "keep it small"

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
Limits: [200 component | 300 service]
Show structure first ← ALWAYS SAY THIS
```

That's it. Keep this tab open when using Claude Code.
