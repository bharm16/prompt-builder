# Wireframe — Video Concept Builder (component)

Component: `VideoConceptBuilder` (`client/src/components/VideoConceptBuilder.tsx`)  
Note: This is **implemented** as a standalone component, but is **not currently mounted via the main router**.

## Layout (desktop)

```
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│ Main content (left)                                                          Suggestions (R) │
│                                                                              (sticky panel)  │
│  ┌──────────────────────────────────────────────────────────────────────────┐ ┌────────────┐ │
│  │ Header card                                                               │ │ PanelHeader│ │
│  │  - “Video Concept Builder”                                                │ │ + tabs     │ │
│  │  - badges: “AI-guided workflow”, “NN% filled”                             │ │ + list      │ │
│  │  - progress header (completion + groups)                                  │ │             │ │
│  │  - mode toggle: [Element Builder] [Describe Concept]                      │ │             │ │
│  │  - actions: [Templates] [Auto-complete] [Generate Prompt →]               │ │             │ │
│  └──────────────────────────────────────────────────────────────────────────┘ └────────────┘ │
│                                                                                              │
│  Concept preview card (assembled prompt preview)                                              │
│                                                                                              │
│  (Optional) Template selector                                                                 │
│  Guidance panel                                                                               │
│  Conflicts alert                                                                              │
│  Refinement suggestions                                                                        │
│  Technical blueprint                                                                           │
│                                                                                              │
│  If mode=concept: large textarea + “Parse concept” style action                               │
│  If mode=element: bento grid of element cards (subject/action/location/…)                     │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
```

## Key interactions

- **Select an element card** → fetches suggestions for that element and opens the suggestions panel.
- **Templates** → show template chooser, apply a template to elements.
- **Auto-complete** → fills missing elements via API.
- **Generate Prompt** → calls `onConceptComplete(concept, elements, metadata)` (intended to feed into optimization flow).

