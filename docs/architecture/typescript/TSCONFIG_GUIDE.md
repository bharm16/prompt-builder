# TypeScript Configuration Guide

## Overview

This document defines the TypeScript compiler configuration for the Prompt Builder codebase. It explains what each setting does and why it's enabled.

---

## Base Configuration

### `tsconfig.json` (Project Root)

```json
{
  "compilerOptions": {
    // === Module System ===
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "resolveJsonModule": true,
    "isolatedModules": true,

    // === Strictness (ALL ON) ===
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "strictBindCallApply": true,
    "strictPropertyInitialization": true,
    "noImplicitThis": true,
    "alwaysStrict": true,
    "useUnknownInCatchVariables": true,

    // === Additional Strictness ===
    "noUncheckedIndexedAccess": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "noImplicitOverride": true,
    "exactOptionalPropertyTypes": true,

    // === Migration Support ===
    "allowJs": true,
    "checkJs": false,

    // === Output ===
    "noEmit": true,
    "skipLibCheck": true,
    "declaration": false,

    // === Path Aliases ===
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"],
      "@/components/*": ["src/components/*"],
      "@/hooks/*": ["src/hooks/*"],
      "@/types/*": ["src/types/*"],
      "@/utils/*": ["src/utils/*"],
      "@/api/*": ["src/api/*"]
    },

    // === React ===
    "jsx": "react-jsx",

    // === Type Roots ===
    "typeRoots": ["./node_modules/@types", "./src/types"]
  },
  "include": ["src/**/*", "tests/**/*"],
  "exclude": ["node_modules", "dist", "build"]
}
```

---

## Setting Explanations

### Module System

| Setting | Value | Why |
|---------|-------|-----|
| `target` | `ES2022` | Modern JS features (Node 18+, modern browsers) |
| `module` | `ESNext` | ES modules with dynamic import |
| `moduleResolution` | `bundler` | Works with Vite/webpack bundlers |
| `esModuleInterop` | `true` | Better CJS/ESM interop |
| `allowSyntheticDefaultImports` | `true` | `import React from 'react'` works |
| `resolveJsonModule` | `true` | `import data from './data.json'` works |
| `isolatedModules` | `true` | Each file is a module (required for Vite) |

### Strictness Settings

#### `strict: true` (Umbrella Flag)

Enables all of these:

| Setting | Effect |
|---------|--------|
| `noImplicitAny` | Error on implicit `any` type |
| `strictNullChecks` | `null` and `undefined` are distinct types |
| `strictFunctionTypes` | Stricter function type checking |
| `strictBindCallApply` | Strict `bind`, `call`, `apply` checking |
| `strictPropertyInitialization` | Class properties must be initialized |
| `noImplicitThis` | Error on `this` with implicit `any` type |
| `alwaysStrict` | Emit `"use strict"` in all files |
| `useUnknownInCatchVariables` | `catch (e)` is `unknown`, not `any` |

#### Additional Strictness (Beyond `strict`)

| Setting | Effect | Why Enable |
|---------|--------|------------|
| `noUncheckedIndexedAccess` | `obj[key]` returns `T \| undefined` | Catches missing key bugs |
| `noImplicitReturns` | All code paths must return | Catches forgotten returns |
| `noFallthroughCasesInSwitch` | Must `break` or `return` in switch | Catches fallthrough bugs |
| `noImplicitOverride` | Require `override` keyword | Clearer inheritance intent |
| `exactOptionalPropertyTypes` | `prop?: T` means `T \| undefined`, not `T \| undefined \| null` | Stricter optional handling |

### Migration Support

| Setting | Value | Why |
|---------|-------|-----|
| `allowJs` | `true` | JS files can coexist during migration |
| `checkJs` | `false` | Don't type-check JS files (too noisy) |

**After Migration Complete:** Set `allowJs: false`

### Output Settings

| Setting | Value | Why |
|---------|-------|-----|
| `noEmit` | `true` | Vite handles compilation |
| `skipLibCheck` | `true` | Faster builds (skip node_modules types) |
| `declaration` | `false` | Don't generate .d.ts files (not a library) |

---

## Frontend-Specific Config

### `client/tsconfig.json`

```json
{
  "extends": "../tsconfig.json",
  "compilerOptions": {
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "jsx": "react-jsx",
    "types": ["vite/client"]
  },
  "include": ["src/**/*", "vite.config.ts"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

### `client/tsconfig.node.json` (For Vite Config)

```json
{
  "compilerOptions": {
    "composite": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true,
    "strict": true
  },
  "include": ["vite.config.ts"]
}
```

---

## Backend-Specific Config

### `server/tsconfig.json`

```json
{
  "extends": "../tsconfig.json",
  "compilerOptions": {
    "lib": ["ES2022"],
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "target": "ES2022",
    "types": ["node"],
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "**/*.test.ts"]
}
```

**Note:** Backend uses `NodeNext` module resolution for native ESM in Node.js.

---

## Path Aliases

### Configuration

```json
// tsconfig.json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"],
      "@/components/*": ["src/components/*"],
      "@/hooks/*": ["src/hooks/*"],
      "@/types/*": ["src/types/*"]
    }
  }
}
```

### Vite Integration

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
```

### Usage

```typescript
// Instead of:
import { Button } from '../../../components/ui/Button';
import type { User } from '../../../types/user';

// Use:
import { Button } from '@/components/ui/Button';
import type { User } from '@/types/user';
```

---

## Strict Mode Deep Dive

### `noUncheckedIndexedAccess`

**What it does:** Indexed access returns `T | undefined`

```typescript
const users: Record<string, User> = {};

// Without noUncheckedIndexedAccess:
const user = users['alice']; // Type: User (WRONG - could be undefined)

// With noUncheckedIndexedAccess:
const user = users['alice']; // Type: User | undefined (CORRECT)

// Must handle undefined:
if (user) {
  console.log(user.name);
}
```

**Why enable:** Catches bugs where you access a key that doesn't exist.

### `exactOptionalPropertyTypes`

**What it does:** Optional properties can't be `null`

```typescript
interface User {
  name: string;
  nickname?: string; // string | undefined, NOT string | undefined | null
}

// Without exactOptionalPropertyTypes:
const user: User = { name: 'Alice', nickname: null }; // Allowed ❌

// With exactOptionalPropertyTypes:
const user: User = { name: 'Alice', nickname: null }; // Error ✅
```

**Why enable:** Enforces consistent use of `undefined` for optional values.

### `useUnknownInCatchVariables`

**What it does:** `catch` clause variable is `unknown`, not `any`

```typescript
// Without useUnknownInCatchVariables:
try { ... } catch (e) {
  console.log(e.message); // Works (e is any) - but might crash!
}

// With useUnknownInCatchVariables:
try { ... } catch (e) {
  console.log(e.message); // Error: e is unknown

  // Must narrow:
  if (e instanceof Error) {
    console.log(e.message); // Works
  }
}
```

**Why enable:** Forces you to handle errors properly.

---

## Migration Mode vs Production Mode

### During Migration

```json
{
  "compilerOptions": {
    "allowJs": true,
    "checkJs": false,
    "strict": true
  }
}
```

### After Migration Complete

```json
{
  "compilerOptions": {
    "allowJs": false,  // No more JS files
    "checkJs": false,  // Not applicable
    "strict": true,
    
    // Additional strictness (enable gradually):
    "noPropertyAccessFromIndexSignature": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true
  }
}
```

---

## Incremental Strictness Adoption

If full strictness is too much at once, enable incrementally:

### Phase 1: Basic Strictness
```json
{
  "strict": true
}
```

### Phase 2: Additional Null Safety
```json
{
  "strict": true,
  "noUncheckedIndexedAccess": true
}
```

### Phase 3: Full Strictness
```json
{
  "strict": true,
  "noUncheckedIndexedAccess": true,
  "exactOptionalPropertyTypes": true,
  "noPropertyAccessFromIndexSignature": true
}
```

---

## Troubleshooting

### "Cannot find module '@/...'"

**Fix:** Ensure path alias is in both `tsconfig.json` AND `vite.config.ts`

### "Type 'X' is not assignable to type 'Y'"

**Possible causes:**
1. Zod inference issue - use `z.infer<typeof Schema>`
2. Missing `as const` on literal array
3. Optional vs required property mismatch

### "Object is possibly 'undefined'"

**Cause:** `noUncheckedIndexedAccess` is enabled

**Fix:** Add null check or use optional chaining

### "Catch clause variable is unknown"

**Cause:** `useUnknownInCatchVariables` is enabled

**Fix:** Narrow the error type:
```typescript
catch (e) {
  if (e instanceof Error) {
    console.log(e.message);
  }
}
```

---

## VSCode Settings

For optimal TypeScript experience:

```json
// .vscode/settings.json
{
  "typescript.preferences.importModuleSpecifier": "non-relative",
  "typescript.suggest.autoImports": true,
  "typescript.updateImportsOnFileMove.enabled": "always",
  "editor.codeActionsOnSave": {
    "source.organizeImports": true
  }
}
```

---

*Companion docs: [ARCHITECTURE_STANDARD.md](./ARCHITECTURE_STANDARD.md), [MIGRATION_GUIDE.md](./MIGRATION_GUIDE.md)*
