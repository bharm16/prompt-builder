# Wireframe — Prompt Optimizer (input view)

Route(s): **`/`** (default) and **`/prompt/:uuid`** before load transitions to results  
Primary component(s): `PromptOptimizerWorkspace` → `PromptInputLayout` → `PromptInputSection` → `PromptInput`

## Layout (desktop)

```
┌───────────────────────────────┬──────────────────────────────────────────────────────────────┐
│ History sidebar               │ Main (centered)                                              │
│ (collapsed by default)        │                                                              │
│                               │  H1: "Turn your rough ideas into perfect prompts"           │
│ [>] Expand                    │                                                              │
│ [+] New prompt                │  ┌────────────────────────────────────────────────────────┐  │
│ [⟲] History (badge: count)    │  │ Textarea (rows=1, grows)                                │  │
│                               │  │ "Describe what you want to create..."                   │  │
│                               │  ├────────────────────────────────────────────────────────┤  │
│ (spacer)                      │  │ Mode dropdown (currently only “Video Prompt”)          │  │
│                               │  │ Model dropdown (video target model)                     │  │
│ [Login/User]                  │  │                                        [Optimize]      │  │
│                               │  └────────────────────────────────────────────────────────┘  │
│                               │                                                              │
│                               │ (Footer) “Privacy Policy” link → `/privacy-policy`          │
└───────────────────────────────┴──────────────────────────────────────────────────────────────┘
```

## Key states

- **Idle / empty**
  - Optimize button disabled until textarea has non-whitespace.
  - Sidebar can be expanded to show full history + auth controls.

- **Processing**
  - Input section is replaced by a **mode-specific loading skeleton** (shimmer card).
  - Sidebar remains available.

## Primary interactions

- **Optimize**
  - Button: “Optimize”
  - Shortcut: `Cmd/Ctrl + Enter` (global shortcut) and textarea behavior (see implementation notes below).

- **Mode select**
  - UI exists, but current mode set is effectively **video-only** (single option).

- **Target model select**
  - Only shown when mode is `video`.

## Notes / implementation quirks (as-is)

- `PromptInput` accepts `onShowBrainstorm`, but the current UI does **not** render a brainstorm button/CTA in this screen.
- There is no explicit on-screen button for Settings/Shortcuts; those are available via keyboard shortcuts.

