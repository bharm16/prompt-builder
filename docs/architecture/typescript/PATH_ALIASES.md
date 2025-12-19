# TypeScript Path Aliases Guide

## Overview

This document defines the path alias configuration for the Prompt Builder codebase. Path aliases eliminate fragile relative imports (`../../../`) and make refactoring safe.

---

## The Problem

```typescript
// ❌ FRAGILE - Relative import hell
import { Logger } from '../../../infrastructure/Logger';
import { UserService } from '../../../../services/UserService';

// Move this file? Every import breaks.
// Count dots wrong? Runtime error.
// 30+ files with wrong paths? Maintenance nightmare.
```

```typescript
// ✅ ROBUST - Path aliases
import { Logger } from '@infrastructure/Logger';
import { UserService } from '@services/UserService';

// Move this file? Imports still work.
// Refactor directory structure? Find-and-replace is trivial.
// IDE auto-imports? Always correct.
```

---

## Configuration

### Server (`server/tsconfig.json`)

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@infrastructure/*": ["src/infrastructure/*"],
      "@services/*": ["src/services/*"],
      "@api/*": ["src/api/*"],
      "@types/*": ["src/types/*"],
      "@utils/*": ["src/utils/*"],
      "@config/*": ["src/config/*"]
    },
    "module": "NodeNext",
    "moduleResolution": "NodeNext"
  }
}
```

### Client (`client/tsconfig.json`)

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"],
      "@components/*": ["src/components/*"],
      "@features/*": ["src/features/*"],
      "@hooks/*": ["src/hooks/*"],
      "@api/*": ["src/api/*"],
      "@types/*": ["src/types/*"],
      "@utils/*": ["src/utils/*"],
      "@config/*": ["src/config/*"]
    }
  }
}
```

---

## Runtime Resolution

**Critical:** TypeScript path aliases only affect type checking. At runtime, Node.js and bundlers need separate configuration.

### Server: Using `tsx` (Recommended)

`tsx` natively supports tsconfig paths without additional configuration:

```bash
# package.json scripts
"scripts": {
  "dev": "tsx watch src/index.ts",
  "start": "tsx src/index.ts"
}
```

### Server: Using `ts-node`

Requires `tsconfig-paths`:

```bash
npm install -D tsconfig-paths
```

```json
// package.json
{
  "scripts": {
    "dev": "ts-node -r tsconfig-paths/register src/index.ts"
  }
}
```

Or in `tsconfig.json`:

```json
{
  "ts-node": {
    "require": ["tsconfig-paths/register"]
  }
}
```

### Server: Production Build (Compiled JS)

When compiling to JS, paths must be rewritten. Use `tsc-alias`:

```bash
npm install -D tsc-alias
```

```json
// package.json
{
  "scripts": {
    "build": "tsc && tsc-alias",
    "start:prod": "node dist/index.js"
  }
}
```

### Client: Vite

Vite needs `vite-tsconfig-paths` plugin:

```bash
npm install -D vite-tsconfig-paths
```

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
});
```

### Client: Manual Vite Alias (Alternative)

If you prefer explicit configuration:

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@components': path.resolve(__dirname, './src/components'),
      '@features': path.resolve(__dirname, './src/features'),
      '@hooks': path.resolve(__dirname, './src/hooks'),
      '@api': path.resolve(__dirname, './src/api'),
      '@types': path.resolve(__dirname, './src/types'),
      '@utils': path.resolve(__dirname, './src/utils'),
      '@config': path.resolve(__dirname, './src/config'),
    },
  },
});
```

---

## Standard Aliases for This Codebase

### Server Aliases

| Alias | Resolves To | Use For |
|-------|-------------|---------|
| `@infrastructure/*` | `src/infrastructure/*` | Logger, database, cache |
| `@services/*` | `src/services/*` | Business logic services |
| `@api/*` | `src/api/*` | Route handlers, controllers |
| `@types/*` | `src/types/*` | Shared type definitions |
| `@utils/*` | `src/utils/*` | Pure utility functions |
| `@config/*` | `src/config/*` | Configuration files |

### Client Aliases

| Alias | Resolves To | Use For |
|-------|-------------|---------|
| `@/*` | `src/*` | Catch-all for src |
| `@components/*` | `src/components/*` | Reusable UI components |
| `@features/*` | `src/features/*` | Feature modules |
| `@hooks/*` | `src/hooks/*` | Custom React hooks |
| `@api/*` | `src/api/*` | API client functions |
| `@types/*` | `src/types/*` | TypeScript types |
| `@utils/*` | `src/utils/*` | Utility functions |
| `@config/*` | `src/config/*` | Configuration |

---

## Migration Steps

### Step 1: Update tsconfig.json

Add the `baseUrl` and `paths` configuration shown above.

### Step 2: Configure Runtime Resolution

Choose the appropriate method for your setup (tsx, ts-node, or bundler).

### Step 3: Find and Replace Imports

```bash
# Find files with deep relative imports (3+ levels)
grep -r "from '\.\./\.\./\.\." server/src --include="*.ts" | head -20
```

### Step 4: Convert Imports

| From | To |
|------|-----|
| `from '../../../infrastructure/Logger'` | `from '@infrastructure/Logger'` |
| `from '../../services/UserService'` | `from '@services/UserService'` |
| `from '../../../types/user'` | `from '@types/user'` |

### Step 5: Validate

```bash
# TypeScript check
npx tsc --noEmit

# Runtime check
npm run dev
```

---

## IDE Setup

### VSCode

Add to `.vscode/settings.json`:

```json
{
  "typescript.preferences.importModuleSpecifier": "non-relative",
  "typescript.suggest.autoImports": true,
  "typescript.updateImportsOnFileMove.enabled": "always"
}
```

Now when you auto-import, VSCode will use path aliases instead of relative paths.

### WebStorm/IntelliJ

Path aliases are automatically detected from `tsconfig.json`. No additional configuration needed.

---

## Testing Configuration

### Vitest

Vitest reads `tsconfig.json` automatically. No additional config needed.

### Jest

Requires `moduleNameMapper`:

```javascript
// jest.config.js
module.exports = {
  moduleNameMapper: {
    '^@infrastructure/(.*)$': '<rootDir>/src/infrastructure/$1',
    '^@services/(.*)$': '<rootDir>/src/services/$1',
    '^@api/(.*)$': '<rootDir>/src/api/$1',
    '^@types/(.*)$': '<rootDir>/src/types/$1',
    '^@utils/(.*)$': '<rootDir>/src/utils/$1',
    '^@config/(.*)$': '<rootDir>/src/config/$1',
  },
};
```

---

## Troubleshooting

### "Cannot find module '@infrastructure/Logger'"

**Cause:** Runtime doesn't know about TypeScript paths.

**Fix:** Ensure runtime resolution is configured:
- `tsx`: Works automatically
- `ts-node`: Add `tsconfig-paths/register`
- Vite: Add `vite-tsconfig-paths` plugin
- Production: Run `tsc-alias` after `tsc`

### "Module '@infrastructure/Logger' has no exported member 'Logger'"

**Cause:** Path resolves, but export doesn't exist.

**Fix:** Check the actual export in the target file.

### "Cannot find module '@services/UserService' or its corresponding type declarations"

**Cause:** `tsconfig.json` paths not configured correctly.

**Fix:** Verify:
1. `baseUrl` is set to `"."`
2. Paths use correct glob patterns (`*` at the end)
3. File is saved and TS server restarted

### VSCode Not Suggesting Alias Imports

**Fix:**
1. Restart TS server: `Cmd+Shift+P` → "TypeScript: Restart TS Server"
2. Ensure `.vscode/settings.json` has `"typescript.preferences.importModuleSpecifier": "non-relative"`

### Production Build Fails with Module Not Found

**Cause:** Compiled JS still has TypeScript path aliases.

**Fix:** Use `tsc-alias` to rewrite paths after compilation:
```json
{
  "scripts": {
    "build": "tsc && tsc-alias"
  }
}
```

---

## Anti-Patterns

### ❌ Don't Mix Relative and Alias Imports

```typescript
// ❌ Inconsistent
import { Logger } from '@infrastructure/Logger';
import { Config } from '../config/Config';

// ✅ Consistent - use aliases everywhere
import { Logger } from '@infrastructure/Logger';
import { Config } from '@config/Config';
```

### ❌ Don't Create Overly Specific Aliases

```typescript
// ❌ Too granular
"@services/optimization/strategies/*": ["src/services/optimization/strategies/*"]

// ✅ Keep it simple
"@services/*": ["src/services/*"]
```

### ❌ Don't Use Aliases for Relative Sibling Imports

```typescript
// In src/services/optimization/StrategyService.ts

// ❌ Unnecessary - same directory
import { helper } from '@services/optimization/helper';

// ✅ Relative is fine for same directory/siblings
import { helper } from './helper';
```

**Rule of thumb:** Use aliases when crossing major boundaries (infrastructure, services, types). Use relative imports within the same feature/module.

---

## Quick Reference

### Setup Checklist

- [ ] `tsconfig.json` has `baseUrl` and `paths`
- [ ] Runtime resolution configured (tsx/ts-node/bundler)
- [ ] Production build rewrites paths (`tsc-alias`)
- [ ] VSCode configured for non-relative imports
- [ ] Tests configured to resolve aliases

### Standard Import Pattern

```typescript
// External packages first
import { z } from 'zod';
import express from 'express';

// Alias imports (infrastructure, services, types)
import { Logger } from '@infrastructure/Logger';
import { UserService } from '@services/UserService';
import type { User } from '@types/user';

// Relative imports (same module/feature)
import { helper } from './helper';
import { localUtil } from '../utils';
```

---

*Companion docs: [TSCONFIG_GUIDE.md](./TSCONFIG_GUIDE.md), [MIGRATION_GUIDE.md](./MIGRATION_GUIDE.md), [ARCHITECTURE_STANDARD.md](./ARCHITECTURE_STANDARD.md)*
