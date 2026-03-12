# Wireframe — Prompt Optimizer (results/canvas view)

Route(s): **`/`** after optimize, **`/prompt/:uuid`** after load  
Primary component(s): `PromptOptimizerWorkspace` → `PromptResultsLayout` → `PromptResultsSection` → `PromptCanvas`

## Top-level layout (desktop)

```
┌───────────────────────────────┬──────────────────────────────────────────────────────────────┐
│ History sidebar               │ PromptCanvas (3-pane workspace)                               │
│ (collapsed or expanded)       │                                                              │
│                               │  [Optional banner] “Draft ready! Refining in background…”   │
│                               │                                                              │
│                               │  ┌───────────────┬──────────────────────────────┬──────────┐ │
│                               │  │ Span bento     │ Editor column                │ Preview  │ │
│                               │  │ grid (left)    │ (center)                    │ + AI     │ │
│                               │  │                │                             │ suggs    │ │
│                               │  └───────────────┴──────────────────────────────┴──────────┘ │
└───────────────────────────────┴──────────────────────────────────────────────────────────────┘
```

## PromptCanvas internal layout (desktop)

```
┌───────────────────────────────┬───────────────────────────────────────────┬───────────────────┐
│ Left: Span Bento Grid          │ Center: Editor                             │ Right: Preview +  │
│ (fixed width via CSS var)      │ (scrolls)                                  │ AI Suggestions     │
│                                │                                            │ (fixed width)      │
│ [Category cards w/ counts]     │ Label: “Original prompt”   [Edit]          │ Visual Preview     │
│ - Subject (n)                  │ ┌────────────────────────────────────────┐ │ (image)            │
│ - Location (n)                 │ │ textarea (editable original prompt)     │ │                    │
│ - Lighting (n)                 │ │ model dropdown (bottom-left in textarea)│ │ Video Preview      │
│ - …                            │ └────────────────────────────────────────┘ │ (video)            │
│ (click category/span → scroll) │                                            │ ─────────────────  │
│                                │ PromptEditor (contentEditable)            │ SuggestionsPanel   │
│                                │ - ML-highlighted spans (video mode)       │ “AI Suggestions”   │
│                                │ - click highlight / select text → fetch   │ - inactive state   │
│                                │                                            │ - loading state     │
│                                │ Floating PromptActions (aligned right):   │ - category tabs     │
│                                │ [Undo] [Redo] [Copy] [Export▾] [Legend]   │ - custom request    │
│                                │ [Share] [New]                              │ - list (click apply)│
└───────────────────────────────┴───────────────────────────────────────────┴───────────────────┘
```

## Key states

- **Draft + refine (two-stage)**
  - A banner appears at the top of the canvas when `isRefining=true`:
    - “Draft ready! Refining in background…”
  - User can edit draft while refinement runs.

- **Span highlighting**
  - In video mode, text is rendered as **escaped HTML** with DOM-based highlights applied.
  - Span bento grid is populated from parsed spans.

- **AI suggestions**
  - Suggestions live in the **right column** inside the Preview panel in this implementation.
  - Panel states: inactive (no selection), loading, error, empty, list.

## Primary interactions

- **Edit original prompt**
  - [Edit] toggles edit mode; [Cancel]/[Update] appear.
  - `Cmd/Ctrl + Enter` triggers Update/Re-optimize (when editing).

- **Click highlighted span / select text**
  - Triggers suggestions fetch for that selection.

- **Export**
  - Export menu supports: Text / Markdown / JSON (via `ExportService`).

- **Share**
  - Generates a share link for the current prompt UUID (route `"/share/:uuid"` is used for viewing).

