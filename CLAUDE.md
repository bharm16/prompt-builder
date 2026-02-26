# Vidra

Interactive editing canvas for AI video prompts with semantic span labeling, click-to-enhance suggestions, and fast previews.

## Tech Stack

- **Monorepo**: Node.js >= 20, ESM (`"type": "module"` in all package.json files)
- **Client**: React 18 + Vite, Tailwind CSS + DaisyUI, Radix UI primitives, TypeScript (migration in progress)
- **Server**: Express + tsx (TypeScript), LLM providers (OpenAI, Gemini, Groq), Firebase Admin, Stripe
- **Shared**: Import via `#shared/*` path alias
- **Testing**: Vitest (unit), Playwright (e2e), fast-check (property)

## Runtime Constraints

- ESM only — no `require()`, no `__dirname` (use `import.meta.url` + `fileURLToPath`)
- Node 20+ — top-level await, `structuredClone`, native fetch all available
- Vite dev server proxies `/api` to port 3001 — never hardcode URLs in client code
- Firebase Admin requires `GOOGLE_APPLICATION_CREDENTIALS` env var at startup
- Redis is optional — all caching falls back to in-memory when `REDIS_URL` is unset

## Repository Structure

```
client/          # React frontend (Vite) — see client/CLAUDE.md
server/          # Express API + services — see server/CLAUDE.md
shared/          # Shared types and utilities (contract layer)
packages/        # Workspace packages (@promptstudio/system)
config/          # Build, lint, and test configuration
scripts/         # Dev tools, migrations, evaluations
docs/            # Architecture docs (see docs/architecture/)
tests/           # E2E, load, and evaluation suites
```

## Domain Glossary

These terms have specific meanings in this codebase. Do not conflate them.

| Term | Meaning | Server Path | Route |
|------|---------|-------------|-------|
| **Span labeling** | ML categorization of prompt phrases into taxonomy categories (subject, camera, lighting…) for UI highlights | `server/src/llm/span-labeling/` | `/llm/label-spans` |
| **Enhancement / Suggestions** | AI-generated alternative phrases for a user-selected span (click-to-enhance) | `server/src/services/enhancement/` | `/api/suggestions`, `/api/enhance` |
| **Optimization** | Two-stage prompt rewriting pipeline (Groq fast draft → OpenAI refinement) | `server/src/services/prompt-optimization/` | `/api/optimize-stream` (SSE) |
| **Continuity** | Shot-to-shot visual consistency in multi-shot sequences | `server/src/services/continuity/` | `/api/continuity` |
| **Convergence** | Motion and visual convergence pipeline (iterative refinement toward target) | `server/src/services/convergence/` | `/api/motion` |
| **Video Concept** | Guided wizard flow: subject → action → location → camera → lighting → style | `server/src/services/video-concept/` | via `/api` routes |
| **Model Intelligence** | AI-powered model recommendation based on prompt analysis | `server/src/services/model-intelligence/` | `/api/model-intelligence` |
| **Preview** | Image (Flux Schnell) and video (Wan 2.2) draft generation before final render | `server/src/services/image-generation/`, `server/src/services/video-generation/` | `/api/preview` |
| **Generation** | Final video render via Sora, Veo, Kling, Luma, Runway | `server/src/services/video-generation/` | `/api/preview` (shared routes) |

**Critical distinction:** `EnhancementService.ts` and `VideoConceptService.ts` at the root of `server/src/services/` are **legacy files**. The canonical implementations live in the domain subdirectories (`enhancement/`, `video-concept/`). Do not import from the root-level files.

## Service Architecture

### DI Registration

Services are registered via domain-scoped files in `server/src/config/services/`:

| Registration File | Registers |
|---|---|
| `infrastructure.services.ts` | cache, metrics, Firebase clients, storage, assets, credits |
| `llm.services.ts` | aiService, claudeClient, groqClient, geminiClient |
| `enhancement.services.ts` | enhancementService, sceneDetection, coherence, videoPromptAnalysis |
| `generation.services.ts` | imageGeneration, videoGeneration, storyboardPreview, keyframe, faceSwap |
| `continuity.services.ts` | continuitySessionService (gated — see Feature Flags below) |
| `session.services.ts` | sessionService, modelIntelligence |

The container is created in `server/src/config/services.config.ts` and initialized in `services.initialize.ts`. Routes consume services via factory functions in `server/src/config/routes.config.ts`.

### Dependency Rules

- Services receive dependencies through **constructor injection** — never call `container.resolve()` outside of route factory functions or DI config files.
- The `aiService` is the **only** LLM routing layer. Never call provider clients (claude, groq, gemini) directly from business services.
- Cross-domain dependencies flow through the route layer or an orchestrator service, not via direct imports.

### Frontend-Backend Decoupling

The client and server are **strictly decoupled**. Neither side may import from the other.

- `client/src/` **NEVER** imports from `server/src/` — and vice versa
- The only shared code lives in `shared/` (types, constants, Zod schemas, and pure utility functions — never I/O or framework-dependent logic)
- Changes to `shared/` are **contract changes** — run `tsc --noEmit` immediately after modifying

**Shared layer rule:** Code in `shared/` must be pure — no Node.js APIs, no React, no `fetch`,
no file I/O, no database access. Pure functions that operate on data (validation, parsing,
condition matching) are acceptable and encouraged to prevent client/server implementation drift.

**Anti-corruption layer:** Each client feature's `api/` directory insulates UI from server DTOs:
```
Server DTO → feature/api/schemas.ts (Zod) → feature/api/*.ts (transform) → hook → component
```

Cross-layer change protocol: see `.claude/skills/cross-layer-change/SKILL.md`.

## Feature Flags

| Flag | Default | Effect When Set |
|------|---------|----------------|
| `PROMPT_OUTPUT_ONLY=true` | `false` | Disables ALL preview, video generation, motion, and convergence routes. Video-related DI registrations still happen but routes are never mounted. |
| `ENABLE_CONVERGENCE=false` | `true` | Disables continuity service registration. `continuitySessionService` resolves to **`null`** from the DI container. |

**Rule:** Code consuming `continuitySessionService` must always null-check — the service is legitimately `null` when convergence is disabled.

**Rule:** Generation-related routes must be inside the `if (!promptOutputOnly)` block in `routes.config.ts`.

## Route → Service → Client API Map

| Route | Server Route File | Client API/Service |
|-------|-------------------|--------------------|
| `POST /api/optimize-stream` | `optimize.routes.ts` | `services/PromptOptimizationApi.ts` |
| `POST /api/enhance`, `POST /api/suggestions` | `enhancement.routes.ts`, `suggestions.ts` | `services/EnhancementApi.ts` |
| `POST /llm/label-spans` | `labelSpansRoute.ts` | `features/span-highlighting/api/spanLabelingApi.ts` |
| `/api/preview/*` | `preview.routes.ts` | `features/preview/api/` |
| `/api/payment/*` | `payment.routes.ts` | `api/billingApi.ts` |
| `/api/motion/*` | `motion.routes.ts` | `api/motionApi.ts` |
| `/api/storage/*` | `storage.routes.ts` | `api/storageApi.ts` |
| `/api/capabilities` | `capabilities.routes.ts` | `services/CapabilitiesApi.ts` |
| `/api/continuity/*` | `continuity.routes.ts` | `features/continuity/api/` |
| `/api/model-intelligence/*` | `model-intelligence.routes.ts` | `features/model-intelligence/api/` |
| `/api/sessions/*` | `sessions.routes.ts` | (no dedicated client — uses ApiClient directly) |
| `/api/video/*` | `video.routes.ts` | `services/VideoConceptApi.ts` |
| `/api/assets/*` | `asset.routes.ts` | `features/assets/` |
| `/api/reference-images/*` | `reference-images.routes.ts` | `features/reference-images/` |
| `/health` | `health.routes.ts` | (not called from client) |

**Rule:** API calls never go directly in React components. Use `client/src/api/` for thin fetch wrappers or `client/src/services/` for stateful clients. Feature-scoped APIs live in `client/src/features/<name>/api/`.

## Commands

```bash
npm start           # Dev orchestrator (client + server)
npm run dev         # Vite client only
npm run server      # API server only
npm run restart     # Kill ports 3001/5173 and restart dev
npm run build       # Production build
npm run lint        # ESLint
npm run lint:fix    # ESLint with auto-fix
npm run lint:all    # ESLint + Stylelint
npm run format      # Prettier format all files
npm run test:unit   # Run unit tests
npm run test:e2e    # Playwright e2e tests
npm run test:coverage # Unit tests with coverage report
npm run test:regression      # Run only regression tests
npm run test:regression:list  # Audit all regression test files
```

## Commit Protocol (MANDATORY)

Before EVERY commit, run all three checks in order:

1. `npx tsc --noEmit` — must exit 0
2. `npx eslint --config config/lint/eslint.config.js . --quiet` — must have 0 errors
3. `npm run test:unit` — must pass all shards

If any check fails, DO NOT commit. Fix the failures first.

A pre-commit hook enforces checks 1-2 automatically, plus: **fix commits must include a regression test** (the hook rejects `fix:` / `fix(` commits without new test blocks). Run `bash scripts/install-hooks.sh` after cloning.

### Integration Test Gate (Service Changes)

When modifying `server/src/config/services.config.ts`, `services.initialize.ts`, `app.ts`, `server.ts`, or `server/index.ts`, also run:

```bash
PORT=0 npx vitest run tests/integration/bootstrap.integration.test.ts tests/integration/di-container.integration.test.ts --config config/test/vitest.integration.config.js
```

## Primary Workflows

### 1) Feature Workflow
1. Read relevant scope docs and impacted modules first (`client/`, `server/`, `shared/`).
2. Implement using established patterns:
   - Frontend: `client/src/components/VideoConceptBuilder/` style (orchestrator + hooks + api + components).
   - Backend: `server/src/services/prompt-optimization/` style (thin orchestrator + specialized services).
3. Add/update tests close to changed behavior.
4. Run targeted verification first, then full checks before handoff.

## Validation Order Before Handoff

1. `npx tsc --noEmit`
2. `npm run lint:all`
3. `npm run test:unit`
4. `npm run test:e2e` (or targeted e2e spec if scope is narrow)
5. `npm run build`

### Commit Scope Rules

- Maximum ~10 files per commit unless it's a mechanical refactor (rename, import path change)
- If a fix requires touching 20+ files, stop and reconsider — there's probably a root cause fix that touches 2-3 files
- Never combine dependency upgrades with code changes in the same commit
- Never combine test infrastructure changes with production code changes

### Change Scope Limits

- Type changes to shared interfaces: must run `tsc --noEmit` BEFORE continuing to other files
- Dependency version bumps: isolated commit, nothing else in it
- If fixing types requires adding `| null` or `| undefined` to more than 3 interfaces, STOP — find the root cause instead of widening types
- If a test fix requires changing the production type to make it pass, that's a production code change — treat it accordingly

## Code Rules

### SRP / Separation of Concerns

Before modifying code, ask:
1. How many distinct responsibilities does this file have?
2. How many reasons to change? (different stakeholders, different triggers)
3. If only 1 responsibility → don't split, even if over line threshold

### File Splitting: When to Actually Split

| Type | Split When |
|------|-----------|
| Components | Mixed presentation + business logic |
| Hooks | Managing unrelated state domains |
| Services | Multiple reasons to change |
| Utils | Functions with different concerns |

Do NOT split files solely because they exceed a line threshold. Do NOT create components only used in one place. Do NOT extract code that always changes together. Do NOT add indirection without improving cohesion. Do NOT use `?.` more than 2 levels deep (fix your types instead).

### TypeScript Rules

- **No `any`**: Use `unknown` + type guards, generics, or `Record<string, unknown>`
- **No JSDoc types**: Use TypeScript annotations (JSDoc OK for descriptions/examples)
- **No magic strings**: Lift to union types or `as const` arrays
- **Zod at boundaries**: Validate API responses, user input, URL params, localStorage
- **Explicit return types**: Required for exported functions and async functions
- **Prefer `undefined`**: Over `null` (except when API explicitly returns null)

## UX Behavioral Rules

These are architectural constraints, not styling opinions.

1. **Browsing is read-only. Editing is explicit.** Viewing past state never mutates the current working prompt or settings. Any state restoration requires a deliberate, labeled action. If clicking something can lose the user's work, the design is wrong.

2. **Tools persist. Navigation interrupts.** Panels the user checks repeatedly must remain visible while switching contexts. Opening one panel should not close an unrelated panel.

## Procedural Workflows

These are on-demand — loaded via skills when the task applies:

- **Bugfix protocol:** `.claude/skills/bugfix/SKILL.md` — invariant-first regression tests at the failure boundary. **Read this before every bugfix.**
- **Integration tests:** `docs/architecture/typescript/TEST_GUIDE.md` Part 3
- **Cross-layer changes:** `.claude/skills/cross-layer-change/SKILL.md`
- **New feature scaffolding:** `.claude/skills/new-feature/SKILL.md`

## Subsystem Guides

- Frontend-specific: `client/CLAUDE.md`
- Backend-specific: `server/CLAUDE.md`
- Architecture rules: `docs/architecture/CLAUDE_CODE_RULES.md`
- Service boundaries: `docs/architecture/SERVICE_BOUNDARIES.md`
