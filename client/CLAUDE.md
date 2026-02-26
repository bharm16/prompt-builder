# Client (Frontend)

React 18 + Vite frontend for the Vidra video prompt editor.

Commit protocol, TypeScript rules, and change scope limits are defined in the root `CLAUDE.md` — all rules apply here.
Also follow root validation expectations: run targeted unit tests after each substantive change and run the full validation order before handoff.

## Stack

- React 18 + Vite
- Tailwind CSS + DaisyUI + Radix UI primitives
- TypeScript/JavaScript mix (migration in progress)
- Lucide React for icons

## Structure

```
client/src/
├── App.tsx, main.tsx      # Entry points
├── components/            # Shared UI components
├── features/              # Feature-specific modules
├── pages/                 # Route pages
├── hooks/                 # Custom React hooks
├── api/                   # API client functions
├── services/              # Client-side services
├── repositories/          # Data access layer
├── schemas/               # Zod validation schemas
├── types/                 # TypeScript type definitions
├── utils/                 # Pure utility functions
└── styles/                # Global styles
```

## Architecture Pattern

Follow the **VideoConceptBuilder** pattern in `client/src/components/VideoConceptBuilder/`:

```
FeatureName/
├── FeatureName.tsx        # Orchestrator (~500 lines max, heuristic)
├── hooks/
│   └── useFeatureState.ts # useReducer for state management
├── api/
│   └── featureApi.ts      # All fetch calls (Zod-validated)
├── components/
│   └── SubComponent.tsx   # UI pieces (~200 lines max, heuristic)
└── config/
    └── constants.ts       # Config and constants
```

## Conventions

### Components

- Functional components with hooks only
- Props interface defined above component
- Explicit `React.ReactElement` return type for exported components
- Keep presentation separate from business logic

### State Management

- Use `useReducer` for complex state (not multiple `useState`)
- Discriminated union types for reducer actions

### API Calls

- All API calls go in `api/` or feature-specific `api/` folders — never fetch inline in components
- Use Zod to validate API responses
- Feature `api/` directories transform server DTOs into client-friendly shapes (anti-corruption layer)

### Frontend-Backend Boundary

- **NEVER** import from `server/src/` — only from `@shared/*`, `#shared/*`, or client-local code
- Shared types live in `shared/` — client-only types go in the feature's `types/` directory
- If a UI change seems to require a `shared/` type change, stop and ask whether a client-side display type would suffice
- For genuine cross-layer changes: see `.claude/skills/cross-layer-change/SKILL.md`

### Styling

- Tailwind CSS for all styling
- DaisyUI components for UI primitives
- Radix UI for accessible primitives (dialogs, popovers, tooltips)
- Check `client/src/components/` for existing shared components before creating new ones
