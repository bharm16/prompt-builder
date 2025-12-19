# TypeScript Migration Guide

## Overview

This guide covers the process of migrating existing JavaScript files to TypeScript. It assumes incremental migration where JS and TS files coexist.

---

## Phase 0: Project Setup

Before migrating any files, ensure the project is configured correctly.

### 1. Install Dependencies

```bash
npm install -D typescript @types/react @types/node zod
```

### 2. Configure TypeScript

See [TSCONFIG_GUIDE.md](./TSCONFIG_GUIDE.md) for the full configuration.

Key settings for migration:
```json
{
  "compilerOptions": {
    "allowJs": true,           // Allow JS files during migration
    "checkJs": false,          // Don't type-check JS files (too noisy)
    "strict": true,            // Full strictness for TS files
    "noEmit": true,            // Vite handles compilation
    "skipLibCheck": true       // Faster builds
  }
}
```

### 3. Set Up Path Aliases

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

---

## Phase 1: Foundation (Do This First)

### Step 1.1: Create Global Types Directory

```bash
mkdir -p src/types
```

Create foundational type files:

```typescript
// src/types/index.ts
export * from './api';
export * from './common';

// src/types/api.ts
export interface ApiResponse<T> {
  data: T;
  success: boolean;
  error?: {
    code: string;
    message: string;
  };
}

export interface ApiError {
  code: string;
  message: string;
  status: number;
}

// src/types/common.ts
export type Nullable<T> = T | null;
export type Optional<T> = T | undefined;
export type AsyncResult<T, E = Error> = Promise<{ data: T } | { error: E }>;
```

### Step 1.2: Create Global Schemas Directory

```bash
mkdir -p src/schemas
```

```typescript
// src/schemas/index.ts
export * from './common';

// src/schemas/common.ts
import { z } from 'zod';

// Reusable schema fragments
export const IdSchema = z.string().uuid();
export const TimestampSchema = z.string().datetime();
export const EmailSchema = z.string().email();

// Common response wrapper
export const ApiResponseSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    data: dataSchema,
    success: z.boolean(),
    error: z.object({
      code: z.string(),
      message: z.string(),
    }).optional(),
  });
```

---

## Phase 2: Migration Order

Migrate files in this order (lowest risk to highest):

### Priority 1: Types & Schemas (No Runtime Impact)
```
src/types/           → Define interfaces
src/schemas/         → Define Zod schemas
*/types.ts           → Component/feature types
*/schemas.ts         → Component/feature schemas
```

### Priority 2: Utilities (Pure Functions)
```
src/utils/           → Stateless helpers
*/utils/             → Feature-specific utils
```

### Priority 3: API Layer (Critical Path)
```
src/api/             → Global API functions
*/api/               → Feature-specific API
```

### Priority 4: Hooks (Complex but Isolated)
```
src/hooks/           → Global hooks
*/hooks/             → Feature-specific hooks
```

### Priority 5: Components (Highest Risk)
```
components/          → Shared UI components
features/            → Feature components
```

### Priority 6: Backend Services
```
services/            → Business logic
routes/              → API endpoints
middleware/          → Express middleware
```

---

## Phase 3: File Conversion Process

### The Checklist (Per File)

Use this checklist for every file you migrate:

#### Before Renaming
- [ ] **Identify all inputs/outputs** of the module
- [ ] **Create types.ts** (if needed) with interfaces
- [ ] **Create schemas.ts** (if API calls) with Zod schemas
- [ ] **Identify dependencies** that need `.d.ts` files

#### Rename & Convert
- [ ] **Rename file**: `.js` → `.ts` or `.jsx` → `.tsx`
- [ ] **Fix immediate errors**: Missing types, incorrect imports
- [ ] **Add type annotations**: Function parameters, return types
- [ ] **Replace JSDoc types**: Delete `@param {type}` comments
- [ ] **Handle `any` violations**: Replace with proper types or `unknown`

#### Harden
- [ ] **Add Zod parsing**: Wrap fetch responses with `.parse()`
- [ ] **Handle null/undefined**: Address all `?.` chain warnings
- [ ] **Test runtime behavior**: Ensure Zod errors are caught

#### Verify
- [ ] **No `any` remaining**: Search for `: any`
- [ ] **No `@ts-ignore`**: Fix underlying issues
- [ ] **Build passes**: Run `tsc --noEmit`
- [ ] **Tests pass**: Run existing test suite

---

## Phase 4: Specific Migration Patterns

### Pattern A: React Component

**Before (JavaScript):**
```javascript
// VideoBuilder.jsx
import { useState, useEffect } from 'react';
import { fetchConcept } from './api';

/**
 * @param {Object} props
 * @param {string} props.initialPrompt
 * @param {function} props.onComplete
 */
export function VideoBuilder({ initialPrompt, onComplete }) {
  const [concept, setConcept] = useState(null);
  const [loading, setLoading] = useState(false);
  
  useEffect(() => {
    if (initialPrompt) {
      setLoading(true);
      fetchConcept(initialPrompt)
        .then(data => setConcept(data))
        .finally(() => setLoading(false));
    }
  }, [initialPrompt]);
  
  return (/* JSX */);
}
```

**After (TypeScript):**
```typescript
// types.ts
export interface VideoBuilderProps {
  initialPrompt?: string;
  onComplete: (result: VideoResult) => void;
}

export interface VideoResult {
  concept: string;
  confidence: number;
}

// api/schemas.ts
import { z } from 'zod';

export const VideoConceptSchema = z.object({
  concept: z.string(),
  confidence: z.number(),
});

export type VideoConcept = z.infer<typeof VideoConceptSchema>;

// api/index.ts
import { VideoConceptSchema, type VideoConcept } from './schemas';

export async function fetchConcept(prompt: string): Promise<VideoConcept> {
  const response = await fetch('/api/concept', {
    method: 'POST',
    body: JSON.stringify({ prompt }),
  });
  const data = await response.json();
  return VideoConceptSchema.parse(data); // Runtime validation!
}

// VideoBuilder.tsx
import { useState, useEffect } from 'react';
import type { VideoBuilderProps } from './types';
import type { VideoConcept } from './api/schemas';
import { fetchConcept } from './api';

export function VideoBuilder({ initialPrompt, onComplete }: VideoBuilderProps) {
  const [concept, setConcept] = useState<VideoConcept | null>(null);
  const [loading, setLoading] = useState(false);
  
  useEffect(() => {
    if (initialPrompt) {
      setLoading(true);
      fetchConcept(initialPrompt)
        .then(setConcept)
        .catch(console.error) // Zod errors bubble up here
        .finally(() => setLoading(false));
    }
  }, [initialPrompt]);
  
  return (/* JSX */);
}
```

### Pattern B: Custom Hook with useReducer

**Before (JavaScript):**
```javascript
// useVideoState.js
import { useReducer, useCallback } from 'react';

const initialState = {
  step: 0,
  formData: {},
  errors: [],
};

function reducer(state, action) {
  switch (action.type) {
    case 'SET_FIELD':
      return { ...state, formData: { ...state.formData, [action.field]: action.value } };
    case 'NEXT_STEP':
      return { ...state, step: state.step + 1 };
    default:
      return state;
  }
}

export function useVideoState() {
  const [state, dispatch] = useReducer(reducer, initialState);
  
  const setField = useCallback((field, value) => {
    dispatch({ type: 'SET_FIELD', field, value });
  }, []);
  
  return { state, setField };
}
```

**After (TypeScript):**
```typescript
// types.ts
export interface VideoState {
  step: number;
  formData: VideoFormData;
  errors: ValidationError[];
}

export interface VideoFormData {
  subject: string;
  action: string;
  location: string;
}

export interface ValidationError {
  field: keyof VideoFormData;
  message: string;
}

// Discriminated union - TypeScript knows exactly what each action looks like
export type VideoAction =
  | { type: 'SET_FIELD'; field: keyof VideoFormData; value: string }
  | { type: 'NEXT_STEP' }
  | { type: 'PREV_STEP' }
  | { type: 'SET_ERRORS'; errors: ValidationError[] }
  | { type: 'RESET' };

// useVideoState.ts
import { useReducer, useCallback } from 'react';
import type { VideoState, VideoAction, VideoFormData } from './types';

const initialState: VideoState = {
  step: 0,
  formData: {
    subject: '',
    action: '',
    location: '',
  },
  errors: [],
};

function reducer(state: VideoState, action: VideoAction): VideoState {
  switch (action.type) {
    case 'SET_FIELD':
      return { 
        ...state, 
        formData: { ...state.formData, [action.field]: action.value },
        errors: state.errors.filter(e => e.field !== action.field),
      };
    case 'NEXT_STEP':
      return { ...state, step: state.step + 1 };
    case 'PREV_STEP':
      return { ...state, step: Math.max(0, state.step - 1) };
    case 'SET_ERRORS':
      return { ...state, errors: action.errors };
    case 'RESET':
      return initialState;
  }
}

export function useVideoState() {
  const [state, dispatch] = useReducer(reducer, initialState);
  
  const setField = useCallback((field: keyof VideoFormData, value: string) => {
    dispatch({ type: 'SET_FIELD', field, value });
  }, []);
  
  const nextStep = useCallback(() => {
    dispatch({ type: 'NEXT_STEP' });
  }, []);
  
  return { state, setField, nextStep, dispatch };
}
```

### Pattern C: Backend Service

**Before (JavaScript):**
```javascript
// OptimizationService.js
class OptimizationService {
  constructor(claudeClient, cacheService, logger) {
    this.claudeClient = claudeClient;
    this.cacheService = cacheService;
    this.logger = logger;
  }
  
  async optimize(prompt, context) {
    const cached = await this.cacheService.get(prompt);
    if (cached) return cached;
    
    const result = await this.claudeClient.complete(prompt);
    await this.cacheService.set(prompt, result);
    return result;
  }
}
```

**After (TypeScript):**
```typescript
// contracts/IOptimizationService.ts
import type { OptimizationResult, OptimizationContext } from '../types';

export interface IOptimizationService {
  optimize(prompt: string, context?: OptimizationContext): Promise<OptimizationResult>;
}

// contracts/dependencies.ts
export interface IClaudeClient {
  complete(prompt: string, options?: CompletionOptions): Promise<CompletionResult>;
}

export interface ICacheService {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttl?: number): Promise<void>;
}

export interface ILogger {
  info(message: string, meta?: Record<string, unknown>): void;
  error(message: string, error?: Error): void;
}

// types/index.ts
export interface OptimizationResult {
  optimized: string;
  score: number;
  metadata: OptimizationMetadata;
}

export interface OptimizationContext {
  mode: 'video' | 'research' | 'creative';
  temperature?: number;
}

// OptimizationService.ts
import type { IOptimizationService } from './contracts/IOptimizationService';
import type { IClaudeClient, ICacheService, ILogger } from './contracts/dependencies';
import type { OptimizationResult, OptimizationContext } from './types';

export class OptimizationService implements IOptimizationService {
  constructor(
    private readonly claudeClient: IClaudeClient,
    private readonly cacheService: ICacheService,
    private readonly logger: ILogger,
  ) {}
  
  async optimize(prompt: string, context?: OptimizationContext): Promise<OptimizationResult> {
    const cached = await this.cacheService.get<OptimizationResult>(prompt);
    if (cached) {
      this.logger.info('Cache hit', { prompt: prompt.slice(0, 50) });
      return cached;
    }
    
    const result = await this.claudeClient.complete(prompt);
    const optimizationResult: OptimizationResult = {
      optimized: result.content,
      score: this.calculateScore(result),
      metadata: { timestamp: new Date().toISOString() },
    };
    
    await this.cacheService.set(prompt, optimizationResult);
    return optimizationResult;
  }
  
  private calculateScore(result: CompletionResult): number {
    // Implementation
    return 0.85;
  }
}
```

---

## Phase 5: Coexistence Rules

During migration, JS and TS files will coexist. Follow these rules:

### Rule 1: New Files Must Be TypeScript
```
✅ NewFeature.tsx
❌ NewFeature.jsx
```

### Rule 2: Create `.d.ts` for Unmigrated Dependencies

If a TS file imports from a JS file that can't be migrated yet:

```typescript
// src/types/legacy.d.ts
declare module '@/legacy/oldService' {
  export function doSomething(input: string): Promise<unknown>;
}
```

### Rule 3: Don't Mix TS and JS in Same Directory

If migrating a directory, migrate ALL files in it:
```
✅ hooks/useAuth.ts + hooks/useVideo.ts
❌ hooks/useAuth.ts + hooks/useVideo.js
```

### Rule 4: API Layer First

Always migrate the API layer before components that use it:
```
1. api/schemas.ts  (define response types)
2. api/index.ts    (typed fetch functions)
3. Component.tsx   (uses typed API)
```

---

## Phase 6: Verification

### Daily Check
```bash
# Should show zero errors
npx tsc --noEmit

# Check for any remaining
grep -r ": any" src/ --include="*.ts" --include="*.tsx"
grep -r "@ts-ignore" src/ --include="*.ts" --include="*.tsx"
```

### Pre-Commit Hook
```bash
#!/bin/bash
# .git/hooks/pre-commit

echo "Running TypeScript check..."
npx tsc --noEmit || exit 1

echo "Checking for 'any' types..."
if grep -r ": any" src/ --include="*.ts" --include="*.tsx" | grep -v "// TODO"; then
  echo "ERROR: Found 'any' types without TODO comment"
  exit 1
fi
```

### Migration Progress Tracking
```bash
# Count migrated vs unmigrated
echo "TypeScript files: $(find src -name '*.ts' -o -name '*.tsx' | wc -l)"
echo "JavaScript files: $(find src -name '*.js' -o -name '*.jsx' | wc -l)"
```

---

## Common Migration Errors & Fixes

### Error: "Cannot find module"
```
Fix: Add path alias to tsconfig.json OR create .d.ts declaration
```

### Error: "Object is possibly undefined"
```typescript
// Bad
const value = obj.prop.nested;

// Good
const value = obj?.prop?.nested;
// OR if it should never be undefined:
const value = obj.prop.nested; // Fix the type to not be optional
```

### Error: "Type 'X' is not assignable to type 'Y'"
```typescript
// Check if it's a Zod inference issue
type Correct = z.infer<typeof Schema>; // Use infer, not manual type
```

### Error: "Property does not exist on type"
```typescript
// Usually means your type is incomplete
// Fix by adding the property to the interface
```

---

## Next Steps After Full Migration

1. **Remove `allowJs`** from tsconfig
2. **Enable `noUncheckedIndexedAccess`**
3. **Enable `exactOptionalPropertyTypes`**
4. **Add stricter ESLint rules** (see [STYLE_RULES.md](./STYLE_RULES.md))

---

*Companion docs: [ARCHITECTURE_STANDARD.md](./ARCHITECTURE_STANDARD.md), [ZOD_PATTERNS.md](./ZOD_PATTERNS.md)*
