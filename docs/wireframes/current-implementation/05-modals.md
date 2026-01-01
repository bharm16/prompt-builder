# Wireframes — Global modals (Prompt Optimizer)

Mounted by: `PromptOptimizerWorkspace` → `PromptModals`

## Settings modal

Trigger: `Cmd/Ctrl + ,` (global shortcut)

```
┌──────────────────────────────────────────────────────────────┐
│ Backdrop (dim + blur)                                         │
│  ┌────────────────────────────────────────────────────────┐   │
│  │ Header: “Settings”                               [X]   │   │
│  ├────────────────────────────────────────────────────────┤   │
│  │ Appearance                                             │   │
│  │  - Dark mode toggle (currently forced off in code)      │   │
│  │  - Font size: [Small] [Medium] [Large]                  │   │
│  │                                                        │   │
│  │ Behavior                                                │   │
│  │  - Auto-save toggle                                     │   │
│  │                                                        │   │
│  │ Export Preferences                                      │   │
│  │  - Default export: [Text] [Markdown] [JSON]             │   │
│  │                                                        │   │
│  │ Danger Zone                                             │   │
│  │  - Reset settings (with confirm)                        │   │
│  │  - Clear all data (with confirm)                        │   │
│  ├────────────────────────────────────────────────────────┤   │
│  │ Footer: “Settings are saved automatically”      [Done]  │   │
│  └────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────┘
```

## Keyboard shortcuts modal

Trigger: `Cmd/Ctrl + K` (global shortcut)

```
┌──────────────────────────────────────────────────────────────┐
│ Backdrop (dim + blur)                                         │
│  ┌────────────────────────────────────────────────────────┐   │
│  │ Header: “Keyboard Shortcuts”                      [X]   │   │
│  ├────────────────────────────────────────────────────────┤   │
│  │ Categories:                                             │   │
│  │  - General                                              │   │
│  │  - Prompt Actions                                       │   │
│  │  - Results View                                         │   │
│  │  - Navigation                                           │   │
│  │                                                        │   │
│  │ Row format: “Description”                  [kbd + kbd]   │   │
│  ├────────────────────────────────────────────────────────┤   │
│  │ Footer: platform hint                          [Close]  │   │
│  └────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────┘
```

## “Improve Your Prompt” modal (PromptImprovementForm)

Trigger: improvement flow (currently wired to keyboard shortcut handling; no dedicated button in the default UI)

```
┌──────────────────────────────────────────────────────────────┐
│ Backdrop (dim + blur)                                         │
│  ┌────────────────────────────────────────────────────────┐   │
│  │ [Close] (ghost button)                                  │   │
│  │                                                        │   │
│  │ Card: “Improve Your Prompt”                             │   │
│  │  - Loading state: “Generating context-aware questions…” │   │
│  │  - Accordion sections (3):                              │   │
│  │    (1) Specific focus   [textarea + example chips]      │   │
│  │    (2) Audience level   [textarea + examples]           │   │
│  │    (3) Intended use     [textarea + examples]           │   │
│  │                                                        │   │
│  │ [Optimize with Context] (disabled until any answer)     │   │
│  │ [Skip and optimize without context]                     │   │
│  └────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────┘
```

