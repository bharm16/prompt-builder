# Decoupling Baseline

Baseline captured on February 17, 2026.

## Initial Metrics

| Metric | Baseline | Target |
|---|---:|---:|
| Client circular dependencies (`madge`) | 7 | 0 |
| Server circular dependencies (`madge`) | 0 | 0 |
| Forbidden route/middleware singleton imports (`UserCreditService`, `StorageService`) | 20 | 0 |
| Legacy root service imports (`@services/EnhancementService`, `@services/VideoConceptService`) | 3 | 0 |

## Command Baseline

```bash
npx madge --circular --extensions ts,tsx --ts-config client/tsconfig.json client/src
npx madge --circular --extensions ts --ts-config server/tsconfig.json server/src
bash scripts/arch-forbidden-imports.sh
```

## Trend Tracking

| Date | Client Cycles | Server Cycles | Forbidden Route/Middleware Imports | Legacy Root Imports | Notes |
|---|---:|---:|---:|---:|---|
| 2026-02-17 | 7 | 0 | 20 | 3 | Program baseline |
| 2026-02-17 | 0 | 0 | 0 | 0 | Phases 0-5 applied, architecture gates green |
