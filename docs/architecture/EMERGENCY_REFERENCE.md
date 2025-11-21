# Claude Code Emergency Reference (Print This)

## The 3 Rules

1. **Always specify pattern**: "Follow [VideoConceptBuilder | PromptOptimizationService] pattern"
2. **Always request structure first**: "SHOW STRUCTURE FIRST"
3. **Always validate after**: Run `cc-check` or `wc -l [files]`

---

## 30-Second Templates

### Frontend Feature
```
Add [feature name]
ARCHITECTURE: VideoConceptBuilder pattern
- Orchestrator max 500 lines, UI components max 200 lines
REFERENCE: client/src/components/VideoConceptBuilder/
SHOW STRUCTURE FIRST
```

### Backend Service
```
Add [service name]
ARCHITECTURE: PromptOptimizationService pattern
- Orchestrator max 500 lines, specialized services max 300 lines
REFERENCE: server/src/services/prompt-optimization/PromptOptimizationService.js
SHOW STRUCTURE FIRST
```

### Modify Existing
```
Modify [file path] to [do what]
CURRENT: [file path] ([run: wc -l file])
CONSTRAINTS: No file over [500 orchestrators | 200 UI | 300 services]
SHOW WHAT CHANGES BEFORE implementing
```

---

## Size Limits

| Type | Max Lines |
|------|-----------|
| Orchestrator Component/Service | 500 |
| Regular UI Component | 200 |
| Hook | 150 |
| Specialized Service | 300 |
| Utility | 100 |
| Config | 200 |
| API Layer | 150 |

**Note:** Orchestrators compose pieces. UI components contain logic. Extract business logic from orchestrators.

---

## Validation Commands

```bash
# Check sizes (set up alias first - see SETUP_GUIDE.md)
cc-check

# Or manual:
find client/src server/src -name "*.js" -o -name "*.jsx" | xargs wc -l | sort -rn | head -20
```

---

## Reference Examples

**Frontend:** `client/src/components/VideoConceptBuilder/`
**Backend:** `server/src/services/prompt-optimization/PromptOptimizationService.js`

---

## When It Breaks

```
Refactor [file] following [pattern] pattern
CURRENT: [X lines]
TARGET: Follow [reference file]
SHOW REFACTORING PLAN FIRST
```

---

## Red Flags (Stop & Refactor)

- ❌ File approaching limit
- ❌ API calls inline (should be in api/)
- ❌ Multiple useState (should be useReducer)
- ❌ Mixed UI + business logic
- ❌ Hardcoded config (should be in config/)

---

**Full docs:** `docs/architecture/CLAUDE_CODE_TEMPLATES.md`
**Quick ref:** `docs/architecture/CLAUDE_CODE_CHEATSHEET.md`
**Setup:** `docs/architecture/SETUP_GUIDE.md`
