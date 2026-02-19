---
name: cross-layer-change
description: Coordinate a change that spans both client and server through the shared contract layer. Use when modifying shared/ types, changing API response shapes, or renaming fields that cross the frontend-backend boundary.
allowed-tools:
  - read_file
  - write_file
  - bash
  - grep
  - edit
---

## Cross-Layer Change Protocol

When a change genuinely requires updating both client and server, follow these steps in order. Do not skip or reorder.

### 1. Update the `shared/` Contract First

Modify the type, schema, or constant in `shared/`. This is the single source of truth.

### 2. Type-Check Immediately

```bash
npx tsc --noEmit
```

Fix compilation errors on **both** sides before writing any new code. This reveals the full blast radius.

### 3. Update the Server Route/Service

Change the server code to produce the new shape. Ensure routes return the updated DTO.

### 4. Update the Client Anti-Corruption Layer

Update **only** the feature's `api/` files:

- `feature/api/schemas.ts` — update the Zod schema
- `feature/api/*.ts` — update the transform function

The anti-corruption layer's job is to insulate UI components from server contract changes.

### 5. Verify UI Components Are Untouched

If the anti-corruption layer is working correctly, UI components and hooks should not need changes. If they do, the layer has a gap — fix the layer, not the components.

### 6. Run Full Checks

```bash
npx tsc --noEmit
npx eslint --config config/lint/eslint.config.js . --quiet
npm run test:unit
```

### Guardrails

- If fixing types requires adding `| null` or `| undefined` to more than 3 interfaces → STOP. Find the root cause instead of widening types.
- If the change touches more than 10 files → STOP. There's probably a root cause fix that touches 2-3 files.
- Never combine the shared/ contract change with unrelated code changes in the same commit.
