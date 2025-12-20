# Claude Code Emergency Reference (Print This)

## The 3 Rules

1. **SRP/SoC Check**: "How many responsibilities? How many reasons to change?"
2. **Always specify pattern**: "Follow [VideoConceptBuilder | PromptOptimizationService] pattern"
3. **Always request structure first**: "SHOW STRUCTURE FIRST"

## 🔴 Critical: Line Counts Are Heuristics

**Before splitting ANY file:**
- If 1 responsibility → Don't split, even if over threshold
- If multiple responsibilities → Split by responsibility, not line count

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

## Size Guidelines (Warning Thresholds)

| Type | Warning | When to Split |
|------|---------|---------------|
| Orchestrator | ~500 | Multiple unrelated flows |
| UI Component | ~200 | Mixed concerns |
| Hook | ~150 | Unrelated state domains |
| Service | ~300 | Multiple reasons to change |
| Utility | ~100 | Different concerns |

**250 lines with 1 responsibility > 3 artificially split files**

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

## ❌ Never Do This

- Split solely because line threshold exceeded
- Create components only used in one place
- Extract code that always changes together

## ✅ Do This Instead

- Split by RESPONSIBILITY, not line count
- Extract when reusable elsewhere
- Separate orchestration from implementation

## Code Quality Issues

- API calls inline (should be in api/)
- Multiple useState (should be useReducer)
- Mixed UI + business logic
- Hardcoded config (should be in config/)

---

**Full docs:** `docs/architecture/CLAUDE_CODE_TEMPLATES.md`
**Quick ref:** `docs/architecture/CLAUDE_CODE_CHEATSHEET.md`
**Setup:** `docs/architecture/SETUP_GUIDE.md`
