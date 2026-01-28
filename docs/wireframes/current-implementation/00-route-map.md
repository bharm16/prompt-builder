# Current implementation wireframes — route map

This set documents what’s currently rendered by the app’s React router (`client/src/App.tsx`).

## Routes

- **`/`**
  - **Primary view**: Prompt Optimizer
  - **Component**: `PromptOptimizerWorkspace`
  - **State**:
    - Input view when `showResults=false`
    - Results/canvas view when `showResults=true`

- **`/prompt/:uuid`**
  - **Primary view**: Prompt Optimizer (loads a specific saved prompt)
  - **Component**: `PromptOptimizerWorkspace`
  - **Behavior**: loads prompt by `uuid` and transitions into results/canvas view

- **`/share/:uuid`**
  - **Primary view**: Shared Prompt (read-only)
  - **Component**: `SharedPrompt`

## Global overlays (available in Prompt Optimizer)

These are mounted at the workspace level and appear on top of both input/results views:

- **Settings modal** (via shortcut `Cmd/Ctrl + ,`)
- **Keyboard shortcuts modal** (via shortcut `Cmd/Ctrl + K`)
- **“Improve your prompt” modal** (triggered via improvement flow shortcut; see wireframes)

## Wireframe index

- [`01-prompt-input.md`](./01-prompt-input.md) — Prompt Optimizer (input view)
- [`02-prompt-results-canvas.md`](./02-prompt-results-canvas.md) — Prompt Optimizer (results/canvas view)
- [`03-history-sidebar.md`](./03-history-sidebar.md) — History sidebar (collapsed/expanded)
- [`04-shared-prompt.md`](./04-shared-prompt.md) — Shared prompt route
- [`05-modals.md`](./05-modals.md) — Settings / Shortcuts / Improve prompt
- [`06-video-concept-builder.md`](./06-video-concept-builder.md) — Video Concept Builder component (implemented but not currently routed)

