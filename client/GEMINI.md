# Client workspace (client/)

## Stack
- React 18 + Vite
- Tailwind CSS + DaisyUI
- TypeScript/JavaScript mix (migration in progress)

## Structure
- client/src/
  - App.tsx, main.tsx
  - components/, features/, pages/
  - hooks/, api/, services/, repositories/
  - schemas/, types/, utils/, styles/

## Architecture pattern
- Follow VideoConceptBuilder pattern in client/src/components/VideoConceptBuilder/.
  - Orchestrator component (max ~500 lines, heuristic)
  - hooks/ using useReducer for state
  - api/ for fetch calls
  - components/ for UI pieces (max ~200 lines, heuristic)
- Use config/ for constants and utils/ for pure functions.

## Conventions
- Prefer functional components and hooks.
- Keep UI styling in Tailwind/DaisyUI and reuse existing components/styles when possible.
- If a change needs backend data, add the client call in client/src/api first.

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
