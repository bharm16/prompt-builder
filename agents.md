# Codex Agent Guide (Vidra / PromptCanvas)

This file is for Codex agents working in this repository.  
Do not replace existing `CLAUDE.md` / `GEMINI.md` files; use this as Codex-specific operating guidance.

## Project Snapshot

- Monorepo: Node.js 20+, ESM (`"type": "module"`).
- Client: React 18 + Vite + Tailwind + DaisyUI.
- Server: Express + TypeScript (`tsx`) with LLM/Firebase/Stripe integrations.
- Shared imports: `#shared/*`.

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
2. Add a failing test when practical.
3. Fix root cause (not symptom) in service/hook layer first, then UI/API layer.
4. Re-run the failing test, then regression checks.

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

## Validation Order Before Handoff

1. `npm run lint:all`
2. `npm run test:unit`
3. `npm run test:e2e` (or targeted e2e spec if scope is narrow)
4. `npm run build`

## Useful References

- `/Users/bryceharmon/Desktop/prompt-builder/README.md`
- `/Users/bryceharmon/Desktop/prompt-builder/CLAUDE.md`
- `/Users/bryceharmon/Desktop/prompt-builder/GEMINI.md`
- `/Users/bryceharmon/Desktop/prompt-builder/client/GEMINI.md`
- `/Users/bryceharmon/Desktop/prompt-builder/server/GEMINI.md`
- `/Users/bryceharmon/Desktop/prompt-builder/scripts/README.md`
