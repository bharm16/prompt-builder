# Design Document: TypeScript Configuration Fixes

## Overview

This design document outlines the systematic approach to fixing 512 TypeScript errors in the Prompt Builder codebase. The fixes are organized into configuration changes, type declaration files, and code modifications to achieve full type safety while maintaining the project's architecture standards.

The solution follows the TypeScript architecture documented in `/docs/architecture/typescript/` and ensures all imports use path aliases rather than relative imports.

## Architecture

The fix strategy is organized into three layers:

```
┌─────────────────────────────────────────────────────────────┐
│                    Configuration Layer                       │
│  (tsconfig.json files, vitest.config.js, path aliases)      │
├─────────────────────────────────────────────────────────────┤
│                  Type Declaration Layer                      │
│  (Express augmentation, supertest types, global types)      │
├─────────────────────────────────────────────────────────────┤
│                    Code Modification Layer                   │
│  (exactOptionalPropertyTypes, null checks, import paths)    │
└─────────────────────────────────────────────────────────────┘
```

### Error Categories and Fix Strategy

| Error Type | Count | Fix Strategy |
|------------|-------|--------------|
| TS2307 (Cannot find module) | 279 | Path alias configuration + import refactoring |
| TS2339 (Property does not exist) | 61 | Express Request type augmentation |
| TS2345/TS2379/TS2322 (Type assignment) | 68 | exactOptionalPropertyTypes fixes |
| TS18048/TS18047 (Possibly undefined) | 31 | Null checks and type guards |
| TS7016 (Missing declarations) | 2 | Install @types/supertest |
| TS7006 (Implicit any) | 8 | Add explicit type annotations |

## Components and Interfaces

### 1. TypeScript Configuration Structure

```
project-root/
├── tsconfig.json                    # Base config (shared settings)
├── client/
│   └── tsconfig.json               # Client-specific (extends base)
├── server/
│   └── tsconfig.json               # Server-specific (extends base)
└── config/test/
    └── vitest.config.js            # Test runner path aliases
```

### 2. Type Declaration Files

```
server/src/types/
├── index.ts                        # Barrel exports
├── common.ts                       # Shared types
├── requests.ts                     # Request/response types
├── services.ts                     # Service types
├── express.d.ts                    # Express Request augmentation (NEW)
└── vendor.d.ts                     # Third-party type augmentations (NEW)
```

### 3. Express Request Augmentation Interface

```typescript
// server/src/types/express.d.ts
import 'express';

declare global {
  namespace Express {
    interface Request {
      id: string;
      perfMonitor?: {
        start: (operationName: string) => void;
        end: (operationName: string) => void;
        addMetadata: (key: string, value: unknown) => void;
      };
    }
  }
}

export {};
```

### 4. Path Alias Configuration

#### Server Path Aliases (server/tsconfig.json)
```typescript
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@infrastructure/*": ["src/infrastructure/*"],
      "@services/*": ["src/services/*"],
      "@interfaces/*": ["src/interfaces/*"],
      "@types/*": ["src/types/*"],
      "@utils/*": ["src/utils/*"],
      "@config/*": ["src/config/*"],
      "@llm/*": ["src/llm/*"],
      "@middleware/*": ["src/middleware/*"],
      "@routes/*": ["src/routes/*"],
      "@clients/*": ["src/clients/*"],
      "@shared/*": ["../shared/*"],
      "#shared/*": ["../shared/*"]
    }
  }
}
```

#### Client Path Aliases (client/tsconfig.json)
```typescript
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"],
      "@components/*": ["src/components/*"],
      "@features/*": ["src/features/*"],
      "@hooks/*": ["src/hooks/*"],
      "@utils/*": ["src/utils/*"],
      "@config/*": ["src/config/*"],
      "@types/*": ["src/types/*"],
      "@shared/*": ["../shared/*"],
      "#shared/*": ["../shared/*"]
    }
  }
}
```

## Data Models

### exactOptionalPropertyTypes Pattern

When `exactOptionalPropertyTypes` is enabled, optional properties that can be explicitly set to `undefined` must include `| undefined`:

```typescript
// BEFORE (causes TS2379 errors)
interface Options {
  timeout?: number;
  retries?: number;
}

// AFTER (compliant with exactOptionalPropertyTypes)
interface Options {
  timeout?: number | undefined;
  retries?: number | undefined;
}
```

### Common Type Patterns to Fix

```typescript
// Pattern 1: Function parameters with optional properties
interface RequestOptions {
  operation?: string | undefined;
  model?: string | undefined;
  client?: string | undefined;
}

// Pattern 2: Service method signatures
interface VideoService {
  getVideoReplacementConstraints(params: {
    highlightWordCount: number;
    phraseRole: string | null;  // Allow null explicitly
    highlightedText: string;
    highlightedCategory?: string | null | undefined;
    highlightedCategoryConfidence?: number | null | undefined;
  }): VideoConstraints | null;
}

// Pattern 3: Schema definitions
const SCHEMA = {
  name: string;
  strict: boolean | undefined;  // Allow undefined for Groq
  schema: Record<string, unknown>;
};
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

Based on the prework analysis, the acceptance criteria consolidate into three key properties:

### Property 1: Zero TypeScript Compilation Errors

*For any* TypeScript file in the project (client, server, or tests), running `tsc --noEmit` SHALL produce zero errors.

**Validates: Requirements 1.3, 1.4, 1.5, 2.3, 2.4, 2.5, 2.6, 3.1, 3.4, 4.1, 4.2, 4.3, 4.4, 4.5, 5.1, 5.2, 5.3, 6.1, 6.2, 6.4, 7.1, 7.2, 7.3, 7.4**

### Property 2: No Deep Relative Imports

*For any* TypeScript file in the project, there SHALL be no import statements containing `../../` (traversing more than one directory level).

**Validates: Requirements 1.9, 8.1, 8.2, 8.4**

### Property 3: Configuration Correctness

*For any* path alias defined in tsconfig.json, the alias SHALL resolve to a valid directory path, and the vitest.config.js SHALL contain matching alias configurations.

**Validates: Requirements 1.1, 1.2, 1.6, 1.7, 1.8, 1.10, 2.7, 3.2, 3.3, 6.3**

## Error Handling

### TypeScript Compilation Errors

When fixing TypeScript errors, follow this priority order:

1. **Configuration errors first** - Fix tsconfig.json path aliases
2. **Type declaration errors second** - Add missing type declarations
3. **Code errors last** - Fix individual file type issues

### Common Error Patterns and Fixes

| Error | Pattern | Fix |
|-------|---------|-----|
| TS2307 | `Cannot find module '@infrastructure/Logger'` | Add path alias to tsconfig.json |
| TS2339 | `Property 'id' does not exist on type 'Request'` | Add Express type augmentation |
| TS2379 | `exactOptionalPropertyTypes` mismatch | Add `\| undefined` to optional properties |
| TS18048 | `'x' is possibly 'undefined'` | Add null check or optional chaining |
| TS7016 | `Could not find declaration file for 'supertest'` | Install @types/supertest |

## Testing Strategy

### Dual Testing Approach

The testing strategy combines:
- **Unit tests**: Verify specific configuration examples and edge cases
- **Property tests**: Verify universal properties across all files

### Property-Based Testing Configuration

- **Library**: Vitest with fast-check for property-based testing
- **Minimum iterations**: 100 per property test
- **Tag format**: `Feature: typescript-config-fixes, Property {number}: {property_text}`

### Test Categories

1. **Configuration Tests**
   - Verify tsconfig.json path aliases are correctly defined
   - Verify vitest.config.js aliases match tsconfig.json
   - Verify Express type augmentation is included

2. **Compilation Tests**
   - Run `tsc --noEmit` and verify zero errors
   - Test specific error categories are resolved

3. **Import Pattern Tests**
   - Scan codebase for `../../` patterns
   - Verify all cross-module imports use path aliases

### Example Test Structure

```typescript
// tests/unit/typescript-config.test.ts
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { execSync } from 'child_process';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

describe('TypeScript Configuration', () => {
  // Property 1: Zero compilation errors
  it('should compile without errors', () => {
    const result = execSync('npx tsc --noEmit 2>&1', { encoding: 'utf-8' });
    expect(result).not.toContain('error TS');
  });

  // Property 2: No deep relative imports
  it('should have no deep relative imports', () => {
    const files = getAllTypeScriptFiles();
    for (const file of files) {
      const content = readFileSync(file, 'utf-8');
      const deepImports = content.match(/from ['"]\.\.\/\.\.\//g);
      expect(deepImports).toBeNull();
    }
  });

  // Property 3: Configuration correctness
  it('should have matching path aliases in tsconfig and vitest', () => {
    const tsconfig = JSON.parse(readFileSync('server/tsconfig.json', 'utf-8'));
    const vitestConfig = readFileSync('config/test/vitest.config.js', 'utf-8');
    
    const aliases = Object.keys(tsconfig.compilerOptions.paths);
    for (const alias of aliases) {
      expect(vitestConfig).toContain(alias.replace('/*', ''));
    }
  });
});
```
