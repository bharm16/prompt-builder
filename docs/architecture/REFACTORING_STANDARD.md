# Prompt Builder Refactoring Standard

## Component Structure Pattern
Based on successful VideoConceptBuilder and PromptOptimizer refactorings.

When a component exceeds 500 lines, refactor to:
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
- [ ] No file over 500 lines
- [ ] API calls centralized in api/ layer
- [ ] Business logic in hooks/ or services/
- [ ] Config in config/ files
- [ ] Components under 200 lines
- [ ] Follows existing refactoring patterns
