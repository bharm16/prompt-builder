# Client (Frontend)

React 18 + Vite frontend for the Vidra video prompt editor.

## Stack

- React 18 + Vite
- Tailwind CSS + DaisyUI
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
│   └── featureApi.ts      # All fetch calls
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
- Discriminated union types for actions:
  ```typescript
  type Action =
    | { type: 'SET_LOADING'; loading: boolean }
    | { type: 'SET_DATA'; data: Data }
    | { type: 'SET_ERROR'; error: string };
  ```

### API Calls

- All API calls go in `api/` or feature-specific `api/` folders
- Never fetch inline in components
- Use Zod to validate API responses

### Frontend-Backend Boundary Rules

The client is **strictly decoupled** from the server. UI changes should never require server changes (and vice versa).

**Import rules:**

- **NEVER** import from `server/src/` — only from `@shared/*`, `#shared/*`, or client-local code
- Shared types live in `shared/` — if a type is client-only, put it in the feature's `types/` directory

**The anti-corruption layer (feature `api/` directories):**

Each feature's `api/` folder transforms server DTOs into client-friendly shapes. This insulates UI components from server contract changes.

```text
Server Response → feature/api/schemas.ts (Zod validate) → feature/api/*.ts (transform) → hook → component
```

- Components and hooks consume **transformed client types**, never raw server DTOs
- If a server response field is renamed, only the feature's `api/` files should need to change
- If a UI-only concern (display formatting, derived state) needs a new type, create it in the feature's `types/` — do not add it to `shared/`

**When a UI change seems to require a `shared/` type change:**

1. STOP — ask whether the UI really needs the server contract to change, or whether a client-side display type would suffice
2. If the contract genuinely needs to change, treat it as a cross-layer change: update `shared/`, run `tsc --noEmit`, fix both sides before committing

### Styling

- Tailwind CSS for all styling
- DaisyUI components for UI primitives
- Reuse existing component patterns before creating new ones
- Check `client/src/components/` for existing shared components

### TypeScript

- Prefer TypeScript for new files
- Avoid `any` - use `unknown` with type guards
- Define types in `types/` or co-located with feature
- Use Zod schemas at API boundaries

## Commit Protocol (MANDATORY)

Before EVERY commit, run all three checks in order:

1. `npx tsc --noEmit` — must exit 0
2. `npx eslint --config config/lint/eslint.config.js . --quiet` — must have 0 errors
3. `npm run test:unit` — must pass all shards

If any check fails, DO NOT commit. Fix the failures first.

A pre-commit hook enforces checks 1-2 automatically. Run `bash scripts/install-hooks.sh` after cloning.

### Commit Scope Rules

- Maximum ~10 files per commit unless it's a mechanical refactor (rename, import path change).
- If a fix requires touching 20+ files, stop and reconsider — there's probably a root cause fix that touches 2-3 files.
- Never combine dependency upgrades with code changes in the same commit.

### Change Scope Limits

- Type changes to shared interfaces: must run `tsc --noEmit` BEFORE continuing to other files.
- If fixing types requires adding `| null` or `| undefined` to more than 3 interfaces, STOP — find the root cause instead of widening types.
- If a test fix requires changing the production type to make it pass, that's a production code change, not a test fix.

## Common Patterns

### Custom Hook with Reducer

```typescript
// hooks/useFeatureState.ts
type State = { /* ... */ };
type Action = { type: 'ACTION_NAME'; payload: /* ... */ };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'ACTION_NAME':
      return { ...state, /* ... */ };
    default:
      return state;
  }
}

export function useFeatureState() {
  const [state, dispatch] = useReducer(reducer, initialState);
  // ... derived state, handlers
  return { state, dispatch, /* handlers */ };
}
```

### API Function

```typescript
// api/featureApi.ts
import { z } from 'zod';

const ResponseSchema = z.object({ /* ... */ });

export async function fetchFeatureData(id: string): Promise<FeatureData> {
  const response = await fetch(`/api/feature/${id}`);
  const data = await response.json();
  return ResponseSchema.parse(data);
}
```
