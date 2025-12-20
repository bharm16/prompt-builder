# Rules for Claude Code

When implementing features in this codebase:

## BEFORE Writing Code

### SRP/SoC Check (CRITICAL - Do This First)
1. **How many distinct responsibilities** does this file/feature have?
2. **How many reasons to change?** (different stakeholders, different triggers)
3. **If only 1 responsibility → Don't split**, even if over any line threshold

**Line counts are heuristics, NOT splitting triggers.**

### Code Organization
1. Check if adding API calls
   - Must go in api/ layer, not inline
2. Check if adding business logic
   - Must go in hooks/ (frontend) or services/ (backend)

## Architecture Patterns
- **Frontend**: Follow VideoConceptBuilder/ pattern
  - Main component: orchestration only
  - State: useReducer in hooks/
  - API: centralized in api/
  - Config: data in config/
  - UI: small components in components/

- **Backend**: Follow PromptOptimizationService pattern
  - Main service: thin orchestrator
  - Logic: specialized services
  - Data: repository pattern
  - Templates: external .md files

## File Size Guidelines (Warning Thresholds, NOT Hard Limits)

| Type | Warning Threshold | When to Split |
|------|-------------------|---------------|
| Components | ~200 lines | Mixed presentation + business logic |
| Hooks | ~150 lines | Managing unrelated state domains |
| Services | ~300-500 lines | Multiple reasons to change |
| Utils | ~100 lines | Functions with different concerns |

**A 250-line component with ONE cohesive responsibility is better than 3 artificially split files.**

## When in Doubt

1. **SRP Test**: "Does this file have more than one reason to change?"
   - If NO → Don't split, regardless of line count
   - If YES → Consider splitting by responsibility

2. **Cohesion Test**: "Would splitting improve or harm cohesion?"
   - If splitting creates files that always change together → Don't split
   - If splitting creates reusable, independent pieces → Do split

3. **Pattern Reference**: "Would this fit the pattern in VideoConceptBuilder/ or PromptOptimizationService?"

## ❌ Never Do This
- Split files solely because they exceed a line threshold
- Create components only used in one place
- Extract code that always changes together
- Add indirection without improving cohesion

## ✅ Always Do This
- Split when file has multiple distinct responsibilities
- Extract when different parts have different reasons to change
- Create components when they're reusable elsewhere
- Separate orchestration from implementation details
