# Wireframe — History Sidebar

Used in: `PromptInputLayout`, `PromptResultsLayout`  
Primary component(s): `HistorySidebar` (wrapped by `PromptSidebar`)

## Collapsed state (default)

```
┌──────────────────────────┐
│ [>] Expand sidebar        │
│                          │
│ [+] New prompt           │
│                          │
│ [⟲] History              │
│   (badge: recent count)  │
│                          │
│          (spacer)        │
│                          │
│ [Login] / [User avatar]  │
└──────────────────────────┘
```

## Expanded state

```
┌───────────────────────────────────────────┐
│ [<]  Prompt Builder                       │
├───────────────────────────────────────────┤
│ [New Prompt] (primary, orange)            │
│ “Sign in to sync across devices” (if anon)│
├───────────────────────────────────────────┤
│ Recent                                    │
│ - HistoryItem (prompt)   [⋯ delete]       │
│ - HistoryItem (prompt)   [⋯ delete]       │
│ - … (up to 5 unless “See more…”)          │
│ [See more… / See less] (if > 5)           │
├───────────────────────────────────────────┤
│ Auth menu                                 │
│ - Signed out: [Sign in with Google]       │
│ - Signed in: user info + [Sign out]       │
└───────────────────────────────────────────┘
```

## Key states

- **Loading history**: spinner + “Loading…”
- **Empty history**: `HistoryEmptyState` CTA
- **Search query active with no matches**: “No results for …”

