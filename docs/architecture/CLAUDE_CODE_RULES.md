# Rules for Claude Code

When implementing features in this codebase:

## BEFORE Writing Code
1. Check if you're modifying a file over 300 lines
   - If yes: Propose extracting logic first
2. Check if adding API calls
   - Must go in api/ layer, not inline
3. Check if adding business logic
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

## File Size Limits
- Components: 200 lines max
- Hooks: 150 lines max
- Services: 300 lines max (orchestrators can be 500)
- Utils: 100 lines max

## When in Doubt
Ask: "Would this fit the pattern in VideoConceptBuilder/ or PromptOptimizationService?"
