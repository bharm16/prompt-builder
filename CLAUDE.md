# Vidra (PromptCanvas)

Interactive editing canvas for AI video prompts with semantic span labeling, click-to-enhance suggestions, and fast previews.

## Tech Stack

- **Monorepo**: Node.js >= 20, ESM (`"type": "module"` in package.json)
- **Client**: React 18 + Vite, Tailwind CSS + DaisyUI, TypeScript (migration in progress)
- **Server**: Express + tsx (TypeScript), LLM providers (OpenAI, Gemini, Groq), Firebase Admin, Stripe
- **Shared**: Import via `#shared/*` path alias
- **Testing**: Vitest (unit), Playwright (e2e), fast-check (property)

## Repository Structure

```
client/          # React frontend (Vite)
server/          # Express API + services
shared/          # Shared types and utilities
packages/        # Workspace packages (@promptstudio/system)
config/          # Build, lint, and test configuration
scripts/         # Dev tools, migrations, evaluations
docs/            # Architecture and TypeScript migration docs
tests/           # E2E, load, and evaluation suites
```

## Commands

```bash
npm start           # Dev orchestrator (client + server)
npm run dev         # Vite client only
npm run server      # API server only
npm run build       # Production build
npm run lint        # ESLint
npm run lint:fix    # ESLint with auto-fix
npm run test:unit   # Run unit tests
npm run test:e2e    # Playwright e2e tests
```

## Architecture Patterns

### Frontend Pattern: VideoConceptBuilder

Reference: `client/src/components/VideoConceptBuilder/`

- Orchestrator component (max ~500 lines, heuristic only)
- State via `useReducer` in `hooks/`
- API calls in `api/` (never inline in components)
- Config/constants in `config/`
- Small, focused UI components in `components/`

### Backend Pattern: PromptOptimizationService

Reference: `server/src/services/prompt-optimization/`

- Thin orchestrator service
- Specialized services for distinct responsibilities
- Templates in external `.md` files
- Validation schemas with Zod

## Code Rules

### SRP/SoC (Critical)

**Line counts are heuristics, NOT splitting triggers.**

Before modifying code, ask:
1. How many distinct responsibilities does this file have?
2. How many reasons to change? (different stakeholders, different triggers)
3. If only 1 responsibility → Don't split, even if over line threshold

### File Size Guidelines (Warnings Only)

| Type | Threshold | When to Actually Split |
|------|-----------|------------------------|
| Components | ~200 lines | Mixed presentation + business logic |
| Hooks | ~150 lines | Managing unrelated state domains |
| Services | ~300-500 lines | Multiple reasons to change |
| Utils | ~100 lines | Functions with different concerns |

### TypeScript Rules

- **No `any`**: Use `unknown` + type guards, generics, or `Record<string, unknown>`
- **No JSDoc types**: Use TypeScript annotations (JSDoc OK for descriptions/examples)
- **No magic strings**: Lift to union types or `as const` arrays
- **Zod at boundaries**: Validate API responses, user input, URL params, localStorage
- **Explicit return types**: Required for exported functions and async functions
- **Prefer `undefined`**: Over `null` (except when API explicitly returns null)

### What NOT to Do

- Split files solely because they exceed a line threshold
- Create components only used in one place
- Extract code that always changes together
- Add indirection without improving cohesion
- Use `?.` more than 2 levels deep (fix your types instead)

### What TO Do

- Split when file has multiple distinct responsibilities
- Extract when different parts have different reasons to change
- Create components when they're reusable elsewhere
- Separate orchestration from implementation details

## Environment Setup

1. Copy `.env.example` to `.env`
2. Required for local dev:
   - `VITE_FIREBASE_*` (all Firebase config vars)
   - At least one LLM key (e.g., `OPENAI_API_KEY`, `GOOGLE_API_KEY`)

## Documentation References

- Architecture rules: `docs/architecture/CLAUDE_CODE_RULES.md`
- TypeScript style: `docs/architecture/typescript/STYLE_RULES.md`
- Zod patterns: `docs/architecture/typescript/ZOD_PATTERNS.md`
- Logging: `docs/architecture/typescript/LOGGING_PATTERNS.md`

## Subsystem Guides

- See `client/CLAUDE.md` for frontend-specific guidance
- See `server/CLAUDE.md` for backend-specific guidance
