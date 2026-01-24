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
