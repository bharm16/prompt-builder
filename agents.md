# Codex Agent Guide (Vidra / PromptCanvas)

This file is for Codex agents working in this repository.  
Do not replace existing `CLAUDE.md` / `GEMINI.md` files; use this as Codex-specific operating guidance.

## Project Snapshot

- Monorepo: Node.js 20+, ESM (`"type": "module"`).
- Client: React 18 + Vite + Tailwind + DaisyUI.
- Server: Express + TypeScript (`tsx`) with LLM/Firebase/Stripe integrations.
- Shared imports: `#shared/*`.

## Domain Glossary

These terms have specific meanings in this codebase. Do not conflate them.

| Term | Meaning | Server Path | Route |
|------|---------|-------------|-------|
| **Span labeling** | ML categorization of prompt phrases into taxonomy categories (subject, camera, lighting…) for UI highlights | `server/src/llm/span-labeling/` | `/llm/label-spans` |
| **Enhancement / Suggestions** | AI-generated alternative phrases for a user-selected span (click-to-enhance) | `server/src/services/enhancement/` | `/api/suggestions`, `/api/enhance` |
| **Optimization** | Two-stage prompt rewriting pipeline (Groq fast draft → OpenAI refinement) | `server/src/services/prompt-optimization/` | `/api/optimize-stream` (SSE) |
| **Continuity** | Shot-to-shot visual consistency in multi-shot sequences (frame-bridge, style-match) | `server/src/services/continuity/` | `/api/continuity` |
| **Convergence** | Motion and visual convergence pipeline (iterative refinement toward target) | `server/src/services/convergence/` | `/api/motion` |
| **Video Concept** | Guided wizard flow: subject → action → location → camera → lighting → style | `server/src/services/video-concept/` | via `/api` routes |
| **Model Intelligence** | AI-powered model recommendation based on prompt analysis | `server/src/services/model-intelligence/` | `/api/model-intelligence` |
| **Preview** | Image (Flux Schnell) and video (Wan 2.2) draft generation before final render | `server/src/services/image-generation/`, `server/src/services/video-generation/` | `/api/preview` |
| **Generation** | Final video render via Sora, Veo, Kling, Luma, Runway | `server/src/services/video-generation/` | `/api/preview` (shared routes) |

**Critical distinction:** root-level compatibility shims have been retired. Import only from canonical domain paths:
- `@services/enhancement/*`
- `@services/video-concept/*`

`@services/EnhancementService` and `@services/VideoConceptService` are forbidden imports.

See also: `docs/architecture/SERVICE_BOUNDARIES.md` for span-labeling vs. video-prompt-analysis boundary rules.

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
- Services may depend on infrastructure services (cache, metrics, clients) and peer services within their domain.
- Cross-domain dependencies should flow through the route layer or an orchestrator service, not via direct imports.
- The `aiService` is the **only** LLM routing layer. Never call provider clients (claude, groq, gemini) directly from business services.

### Frontend-Backend Decoupling

The client and server are **strictly decoupled**. Neither side may import from the other.

**Hard rules:**

- `client/src/` **NEVER** imports from `server/src/` — and vice versa.
- The only shared code lives in `shared/` (types, constants, Zod schemas — never runtime logic).
- Changes to `shared/` are **contract changes** that affect both sides — run `tsc --noEmit` immediately after modifying.

**The anti-corruption layer:**

Each client feature's `api/` directory insulates UI components from server response shapes:

```text
Server DTO → feature/api/schemas.ts (Zod) → feature/api/*.ts (transform) → hook → component
```

- UI components consume **transformed client types**, never raw server DTOs.
- If a server response field changes, only the feature's `api/` files should need updating — not components or hooks.
- If a UI-only concern needs a new type, create it in the feature's `types/` directory — do not add it to `shared/`.

**Cross-layer change protocol:**

When a change genuinely requires updating both client and server:

1. Update the `shared/` contract first.
2. Run `tsc --noEmit` — fix compilation errors on both sides.
3. Update the server route/service.
4. Update the client feature `api/` layer (schemas + transforms).
5. UI components should not need changes if the anti-corruption layer is working correctly.

## Feature Flags

These environment variables gate entire subsystems. Code that doesn't account for them will silently not execute or will crash on null references.

| Flag | Default | Effect When Set |
|------|---------|----------------|
| `PROMPT_OUTPUT_ONLY=true` | `false` | Disables ALL preview, video generation, motion, and convergence routes. Server becomes prompt-optimization-only. Video-related DI registrations still happen but routes are never mounted. |
| `ENABLE_CONVERGENCE=false` | `true` | Disables continuity service registration. `continuitySessionService` resolves to **`null`** from the DI container. Any code consuming this service must null-check. |

**Rule:** When adding code that depends on `continuitySessionService`, always handle the `null` case — the service is legitimately `null` when convergence is disabled.

**Rule:** When adding new routes, check `routes.config.ts` for the `promptOutputOnly` guard pattern. Generation-related routes must be inside the `if (!promptOutputOnly)` block.

## Route → Service → Client API Map

Use this table to find the correct client-side file for a given backend route. If no client file exists, create one following the existing pattern (thin wrapper in `api/` or stateful client in `services/`).

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

**Rule:** API calls never go directly in React components. Use `client/src/api/` for thin fetch wrappers or `client/src/services/` for stateful clients with caching/retry. Feature-scoped APIs live in `client/src/features/<name>/api/`.

## Primary Workflows

### 1) Feature Workflow
1. Read relevant scope docs and impacted modules first (`client/`, `server/`, `shared/`).
2. Implement using established patterns:
   - Frontend: `client/src/components/VideoConceptBuilder/` style (orchestrator + hooks + api + components).
   - Backend: `server/src/services/prompt-optimization/` style (thin orchestrator + specialized services).
3. Add/update tests close to changed behavior.
4. Run targeted verification first, then full checks before handoff.

### 2) Bugfix Workflow
1. Reproduce with the smallest deterministic path.
2. **Write a failing test first** that reproduces the bug. If the bug is in a service, write a unit test. If it crosses service boundaries, write an integration test. The test must fail _before_ the fix and pass _after_.
3. Fix root cause (not symptom) in service/hook layer first, then UI/API layer.
4. Run the new test — it must pass.
5. Run the full existing test suite (`npm run test:unit`) — all existing tests must still pass without modification.

**Test update rules during bugfixes:**
- Never weaken an existing test to accommodate a fix. If an existing test fails after your fix, your fix changed a contract — treat that as a separate decision.
- Never update a test and the source file it covers in the same logical change unless the contract itself is intentionally changing.
- A failing existing test after a bugfix is information, not a problem to silence. Investigate before touching the test.
- Default action: _add_ a new test case, don't _edit_ existing ones.

### 3) Performance Workflow
1. Start app and verify baseline behavior.
2. Use highlight/perf scripts to measure before/after.
3. Change one variable at a time and keep a short measurement note.
4. Validate no regression in unit/e2e smoke tests.

### 4) Data Migration / Backfill Workflow
1. Run dry-run modes first where available.
2. Validate expected record count/sample output.
3. Execute real migration only after dry-run is clean.
4. Re-check key API paths and logs.

## Command Reference

### Setup / Dev
```bash
npm install
npm start
npm run dev
npm run server
npm run restart
```

### Build / Lint / Format
```bash
npm run build
npm run lint
npm run lint:fix
npm run lint:css
npm run lint:all
npm run format
npm run format:check
```

### Test
```bash
npm run test
npm run test:unit
npm run test:coverage
npm run test:e2e
npm run test:e2e:debug
npm run test:all
```

### Evaluations / Quality Gates
```bash
npm run eval:span
npm run eval:suggestions
npm run eval:optimization
npm run eval:regression
npm run quality:gate
```

### Architecture Gates
```bash
npm run arch:check
npm run arch:cycles:client
npm run arch:cycles:server
npm run arch:forbidden-imports
```

### Performance / Diagnostics
```bash
npm run verify-keys
npm run highlight-stats
npm run highlight-stats:watch
npm run test:e2e:latency
npm run perf:monitor
npm run perf:stats
npm run perf:metrics
```

### Model Capability Sync
```bash
npm run sync:capabilities
```

### Migrations
```bash
npm run migrate:rerender:dry
npm run migrate:rerender
npm run migrate:rerender:regenerate
npm run migrate:backfill:dry
npm run migrate:backfill
```

## Guardrails for Codex

- Keep routes/controllers thin; business logic belongs in `server/src/services`.
- Keep API calls out of React components; use `client/src/api`.
- Prefer TypeScript, explicit types, and Zod at boundaries.
- Avoid splitting files purely by line count; split by responsibility/reason-to-change.
- Preserve existing architecture conventions unless task explicitly requires refactor.

### UX Behavioral Rules

These are architectural constraints, not styling opinions. They affect how components wire state and handle user interactions.

1. **Browsing is read-only. Editing is explicit.** Viewing past state (gallery, history, popovers) never mutates the current working prompt or settings. Any state restoration requires a deliberate, labeled action (e.g., "Reuse prompt and settings"). If clicking something can lose the user's work, the design is wrong.

2. **Tools persist. Navigation interrupts.** Panels the user checks repeatedly (generation history, credits, session info) must remain visible while switching contexts. Opening one panel should not close an unrelated panel. If the user has to click away and click back to see something, they'll stop checking it.

### File Splitting Guidelines

| Type | When to Actually Split |
|------|------------------------|
| Components | Mixed presentation + business logic |
| Hooks | Managing unrelated state domains |
| Services | Multiple reasons to change |
| Utils | Functions with different concerns |

## Writing Integration Tests

Read `docs/architecture/typescript/TEST_GUIDE.md` Part 3 before writing ANY integration test.

### The Cardinal Rule

**Write tests from contracts, not implementations.** Read registration files, type interfaces, route declarations, and schema definitions. Do NOT read service implementations when writing test assertions. The test encodes what the code PROMISES to do. If the implementation doesn't match the promise, the test should fail.

Files to read for contracts:
- `server/src/config/services.config.ts` — every service name and its factory
- `server/src/config/services.initialize.ts` — initialization order and health checks
- `server/src/app.ts` — middleware stack and route registration
- `server/src/routes/*.routes.ts` — route paths and their schemas
- `server/src/schemas/*.ts` — Zod validation contracts
- `shared/taxonomy.ts` — category definitions

Files to NOT read when writing assertions:
- Service class implementations (e.g., `EnhancementService.ts` internals)
- Route handler function bodies
- LLM prompt templates
- Utility function implementations

### When Generating Integration Tests

1. Read the contract files listed above
2. Write assertions based on what the contracts promise
3. Run the test — expect failures
4. Report failures to the user with root cause analysis
5. **STOP. Do not auto-fix.** Ask the user whether to fix the source code or adjust the test spec.

### When Fixing Integration Test Failures

If the user asks you to fix failing integration tests:
- Default to fixing the SOURCE CODE, not the test
- Only modify the test if it references a service name, route path, or schema field that genuinely does not exist in any contract file
- Never weaken an assertion to make it pass (e.g., changing `.toBe(200)` to `.toBeDefined()`)
- Never add try/catch in the test to swallow errors
- Never change `expect(x).toBe(y)` to `expect(x).toBe(z)` where `z` is what the broken code returns

### Integration Test Types (Quick Reference)

| Type | When to Write | What to Assert |
|------|--------------|----------------|
| Bootstrap (Type 1) | Changed startup sequence, DI config, env validation | Server starts, health check returns 200 |
| DI Container (Type 2) | Added/removed/renamed a service registration | Every registered name resolves without throwing |
| Full-Stack Route (Type 3) | Changed middleware, auth, or route wiring | Request through real app gets expected status |
| Database (Type 4) | Changed Firestore schema, transaction logic | Data round-trips correctly through emulator |
| Workflow (Type 5) | Changed service that feeds into another service | Output of service A is valid input for service B |
| Contract (Type 6) | Integrated new external API or updated client | Client handles real response fixtures correctly |

## Commit Protocol (MANDATORY)

Before EVERY commit, run all three checks in order:

1. `npx tsc --noEmit` — must exit 0
2. `npx eslint --config config/lint/eslint.config.js . --quiet` — must have 0 errors
3. `npm run test:unit` — must pass all shards

If any check fails, DO NOT commit. Fix the failures first.

A pre-commit hook enforces checks 1-2 automatically. Run `bash scripts/install-hooks.sh` to install it.

### Integration Test Gate (Service Changes)

When modifying files in `server/src/config/services.config.ts`, `server/src/config/services.initialize.ts`, `server/src/app.ts`, `server/src/server.ts`, or `server/index.ts`, also run:

```bash
PORT=0 npx vitest run tests/integration/bootstrap.integration.test.ts tests/integration/di-container.integration.test.ts --config config/test/vitest.integration.config.js
```

If these fail, the change broke application startup or DI wiring. Fix the source code, not the tests.

### Commit Scope Rules

- Maximum ~10 files per commit unless it's a mechanical refactor (rename, import path change).
- If a fix requires touching 20+ files, stop and reconsider — there's probably a root cause fix that touches 2-3 files.
- Never combine dependency upgrades with code changes in the same commit.
- Never combine test infrastructure changes with production code changes.

### Change Scope Limits

- Type changes to shared interfaces: must run `tsc --noEmit` BEFORE continuing to other files.
- Dependency version bumps: isolated commit, nothing else in it.
- If fixing types requires adding `| null` or `| undefined` to more than 3 interfaces, STOP — find the root cause instead of widening types.
- If a test fix requires changing the production type to make it pass, that's a production code change, not a test fix — treat it accordingly.

## Validation Order Before Handoff

1. `npx tsc --noEmit`
2. `npm run lint:all`
3. `npm run test:unit`
4. `npm run test:e2e` (or targeted e2e spec if scope is narrow)
5. `npm run build`

## Useful References

- `/Users/bryceharmon/Desktop/prompt-builder/README.md`
- `/Users/bryceharmon/Desktop/prompt-builder/CLAUDE.md`
- `/Users/bryceharmon/Desktop/prompt-builder/GEMINI.md`
- `/Users/bryceharmon/Desktop/prompt-builder/client/GEMINI.md`
- `/Users/bryceharmon/Desktop/prompt-builder/server/GEMINI.md`
- `/Users/bryceharmon/Desktop/prompt-builder/scripts/README.md`
- `/Users/bryceharmon/Desktop/prompt-builder/docs/architecture/typescript/TEST_GUIDE.md` (Part 3: Integration Tests)
