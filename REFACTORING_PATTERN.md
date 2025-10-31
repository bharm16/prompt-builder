# Prompt Builder Refactoring Pattern

## Our Standard Architecture

Based on successful VideoConceptBuilder refactoring:
```
ComponentName/
├── ComponentName.jsx         (~300-500 lines, orchestration only)
├── hooks/                    (business logic, state management)
├── api/                      (all fetch calls)
├── utils/                    (pure functions)
├── config/                   (configuration)
└── components/               (presentational components)
```

## Refactoring Checklist

When refactoring a god component:

1. [ ] Create directory structure
2. [ ] Extract API calls to api/
3. [ ] Convert useState to useReducer in hooks/
4. [ ] Extract config to config/
5. [ ] Extract business logic to hooks/
6. [ ] Break JSX into components/
7. [ ] Wire everything together in main component
8. [ ] Verify tests pass
9. [ ] Create REFACTORING_SUMMARY.md

## Claude Code Requests

Use this template:

"Refactor [Component] following the pattern in VideoConceptBuilder/REFACTORING_SUMMARY.md

[Paste specific requirements]

Show me the proposed structure before implementing."
