# PR 7: Client State Boundary Split

## Baseline (before)

- Single monolithic PromptStateContext provider
- Any sub-change triggers all consumers

## After

- 7 independent context providers
- Consumers subscribe only to the slices they need

## Delta

- Targeted: unrelated state changes no longer trigger workspace-wide rerenders

## Method

- React Profiler traces during editing flows

## Rollback Gate

- Revert if any workspace feature breaks (editing, generation, history, sidebar)
