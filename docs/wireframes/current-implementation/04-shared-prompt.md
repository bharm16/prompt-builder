# Wireframe — Shared Prompt (read-only)

Route: **`/share/:uuid`**  
Primary component(s): `SharedPrompt` + `useSharedPrompt`

## Loading state

```
┌──────────────────────────────────────────────────────────────┐
│ Centered spinner                                              │
│ “Loading prompt…”                                             │
└──────────────────────────────────────────────────────────────┘
```

## Error / not found state

```
┌──────────────────────────────────────────────────────────────┐
│ (Centered card)                                                │
│ H1: “Prompt not found” / “Failed to load prompt”               │
│ Body: “The prompt you're looking for doesn't exist…”           │
│ [Go to Home]                                                   │
└──────────────────────────────────────────────────────────────┘
```

## Success state

```
┌──────────────────────────────────────────────────────────────┐
│ Sticky header                                                  │
│  Title: “Shared Prompt”                    [Home]              │
│  Sub:  <mode label> · <date>                                   │
├──────────────────────────────────────────────────────────────┤
│ Content (max width)                                            │
│  Section: “Original Input”                                     │
│   ┌────────────────────────────────────────────────────────┐   │
│   │ prompt.input (pre-wrapped text)                         │   │
│   └────────────────────────────────────────────────────────┘   │
│                                                                │
│  Section: “Optimized Output”                     [Copy/Copied]  │
│   ┌────────────────────────────────────────────────────────┐   │
│   │ prompt.output (rendered HTML)                            │   │
│   └────────────────────────────────────────────────────────┘   │
│                                                                │
│  (Optional) “Quality Score: NN/100” pill                        │
│                                                                │
│  Footer: “Create your own optimized prompts at Prompt Builder”  │
└──────────────────────────────────────────────────────────────┘
```

