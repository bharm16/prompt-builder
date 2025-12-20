# TypeScript Architecture Standard

## Overview

This document defines the directory structure and file organization patterns for TypeScript code in the Prompt Builder codebase. It extends the existing refactoring standards with TypeScript-specific requirements.

---

## 1. Frontend Component Structure

**When to Use This Structure:** Components that have **multiple distinct responsibilities** (e.g., state management + API calls + complex UI logic) should be split following this pattern. Line count is a secondary indicator—a 400-line component with a single cohesive responsibility may be fine, while a 150-line component mixing concerns should be split.

```text
ComponentName/
├── ComponentName.tsx         // Orchestration & JSX only (max 500 lines)
├── index.ts                  // Re-exports (barrel file)
├── types.ts                  // Interfaces: Props, State, Domain Objects
├── constants.ts              // Static data, magic strings as const
├── hooks/                    // Business logic & State Management
│   ├── useComponentState.ts  // Main hook with useReducer (max 150 lines)
│   └── useSpecificFeature.ts // Specialized sub-hooks (max 150 lines)
├── api/                      // Data Fetching & Validation
│   ├── index.ts              // Exported fetch functions (max 150 lines)
│   └── schemas.ts            // Zod schemas for API responses
├── components/               // Sub-components (pure presentational)
│   ├── SubComponent.tsx      // (max 200 lines each)
│   └── types.ts              // Props for sub-components (optional)
└── utils/                    // Pure functions (max 100 lines per file)
    └── helpers.ts
```

### Key Files Explained

#### `types.ts` - Compile-Time Contracts
```typescript
// Component props
export interface VideoBuilderProps {
  initialConcept?: string;
  onComplete: (result: VideoResult) => void;
  mode: OptimizationMode;
}

// Internal state
export interface VideoBuilderState {
  currentStep: number;
  formData: VideoFormData;
  validation: ValidationState;
}

// Domain objects
export interface VideoFormData {
  subject: string;
  action: string;
  location: string;
  atmosphere?: AtmosphereData;
}

// Discriminated union for reducer actions
export type VideoBuilderAction =
  | { type: 'SET_FIELD'; field: keyof VideoFormData; value: string }
  | { type: 'NEXT_STEP' }
  | { type: 'PREV_STEP' }
  | { type: 'RESET' };
```

#### `schemas.ts` - Runtime Validation
```typescript
import { z } from 'zod';

// API response schema
export const VideoConceptResponseSchema = z.object({
  concept: z.string(),
  elements: z.record(z.string()),
  confidence: z.number().min(0).max(1),
  suggestions: z.array(z.string()).optional(),
});

// Derive TypeScript type from schema
export type VideoConceptResponse = z.infer<typeof VideoConceptResponseSchema>;

// Form validation schema
export const VideoFormSchema = z.object({
  subject: z.string().min(3, 'Subject must be at least 3 characters'),
  action: z.string().min(3, 'Action must be at least 3 characters'),
  location: z.string().min(3, 'Location must be at least 3 characters'),
});
```

#### `constants.ts` - Static Values
```typescript
// Union types for string literals
export const OPTIMIZATION_MODES = ['video', 'research', 'creative', 'standard'] as const;
export type OptimizationMode = typeof OPTIMIZATION_MODES[number];

// Step configuration
export const WIZARD_STEPS = [
  { id: 'concept', label: 'Core Concept', required: true },
  { id: 'atmosphere', label: 'Atmosphere', required: false },
  { id: 'technical', label: 'Technical', required: false },
  { id: 'review', label: 'Review', required: true },
] as const;

// Feature flags
export const FEATURE_FLAGS = {
  enableAISuggestions: true,
  enableAutoSave: true,
  maxSuggestions: 5,
} as const;
```

---

## 2. Backend Service Structure

**When to Use This Structure:** Services that have **multiple reasons to change** (different stakeholders, different data flows) should be split using the orchestrator pattern. A 350-line service doing one thing well is preferable to artificially splitting cohesive logic.

```text
services/feature-name/
├── FeatureService.ts         // Orchestrator (max 500 lines)
├── index.ts                  // Re-exports
├── types/                    // TypeScript interfaces
│   ├── index.ts              // Barrel exports
│   ├── domain.ts             // Domain object types
│   └── requests.ts           // Request/Response types
├── contracts/                // Interface definitions for DI
│   └── IFeatureService.ts    // Public contract
├── services/                 // Specialized sub-services
│   ├── ProcessingService.ts  // Heavy logic (max 300 lines)
│   └── ValidationService.ts  // Validation logic (max 300 lines)
├── strategies/               // Strategy pattern implementations
│   ├── IStrategy.ts          // Strategy interface
│   ├── VideoStrategy.ts      // (max 300 lines)
│   └── ResearchStrategy.ts   // (max 300 lines)
├── schemas/                  // Zod schemas
│   ├── requests.ts           // Input validation
│   └── responses.ts          // Output validation
└── templates/                // Prompt templates (.md files)
```

### Key Files Explained

#### `contracts/IFeatureService.ts` - Public Interface
```typescript
import type { OptimizationResult, OptimizationContext } from '../types';

export interface IFeatureService {
  optimize(prompt: string, context?: OptimizationContext): Promise<OptimizationResult>;
  validate(prompt: string): Promise<ValidationResult>;
  getStrategies(): string[];
}
```

#### `FeatureService.ts` - Orchestrator
```typescript
import type { IFeatureService } from './contracts/IFeatureService';
import type { IProcessingService, IValidationService } from './contracts';
import type { OptimizationResult, OptimizationContext } from './types';

export class FeatureService implements IFeatureService {
  constructor(
    private readonly processingService: IProcessingService,
    private readonly validationService: IValidationService,
    private readonly cacheService: ICacheService,
    private readonly logger: ILogger,
  ) {}

  async optimize(prompt: string, context?: OptimizationContext): Promise<OptimizationResult> {
    // Orchestration only - delegate actual work
    const validated = await this.validationService.validate(prompt);
    const cached = await this.cacheService.get(this.getCacheKey(prompt, context));
    
    if (cached) {
      this.logger.debug('Cache hit');
      return cached;
    }
    
    const result = await this.processingService.process(validated, context);
    await this.cacheService.set(this.getCacheKey(prompt, context), result);
    
    return result;
  }
}
```

---

## 3. Shared Types Location

Global types that are used across multiple features:

```text
src/
├── types/                    // Global type definitions
│   ├── index.ts              // Barrel exports
│   ├── api.ts                // Generic API types (ApiResponse<T>, etc.)
│   ├── common.ts             // Shared domain types
│   └── vendor.d.ts           // Third-party type augmentations
└── schemas/                  // Global Zod schemas
    ├── index.ts
    └── common.ts             // Reusable schema fragments
```

### Global Types Example
```typescript
// types/api.ts
export interface ApiResponse<T> {
  data: T;
  success: boolean;
  error?: ApiError;
  metadata?: ResponseMetadata;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    hasMore: boolean;
  };
}
```

---

## 4. File Size Guidelines (Heuristics, Not Hard Limits)

**Core Principle:** Line counts are smell indicators, not splitting triggers. A file exceeding these thresholds should be **evaluated for SRP/SoC violations**, not automatically split.

| File Type | Warning Threshold | When to Split |
|-----------|-------------------|---------------|
| Orchestrator (.tsx/.ts) | ~500 lines | Multiple unrelated orchestration flows |
| UI Component (.tsx) | ~200 lines | Mixed presentation + business logic |
| React Hook (.ts) | ~150 lines | Managing unrelated state domains |
| Specialized Service (.ts) | ~300 lines | Multiple reasons to change |
| Utility (.ts) | ~100 lines | Functions with different concerns |
| Types (.ts) | ~200 lines | Types for unrelated domains |
| Schemas (.ts) | ~150 lines | Schemas for unrelated APIs |
| Constants (.ts) | ~100 lines | Config for different features |
| API Layer (.ts) | ~150 lines | Calls to unrelated endpoints |

### When NOT to Split (Even If Over Threshold)

- A reducer with 200 lines handling one cohesive state domain
- A form component with 250 lines but a single logical flow
- A service with many edge cases for one responsibility
- A config file that's large but logically unified

### ❌ Mechanical Splitting (Anti-Pattern)

```typescript
// BAD: Split because 210 > 200, but these change together
UserProfile.tsx (180 lines) + UserProfileHeader.tsx (30 lines)
```

If `UserProfileHeader` is only used by `UserProfile` and they always change together, this split adds indirection without improving cohesion.

### ✅ Principled Splitting

```typescript
// GOOD: Split because different responsibilities
UserProfile.tsx (orchestration) + UserAvatar.tsx (reusable presentation)
```

`UserAvatar` is reused elsewhere and encapsulates avatar-specific logic independent of the profile.

---

## 5. Import Organization

Enforce consistent import ordering:

```typescript
// 1. External libraries
import React, { useState, useCallback } from 'react';
import { z } from 'zod';

// 2. Internal absolute imports (aliases)
import { Button, Input } from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';

// 3. Relative imports - types first
import type { VideoBuilderProps, VideoBuilderState } from './types';
import type { VideoConceptResponse } from './api/schemas';

// 4. Relative imports - implementations
import { useVideoBuilderState } from './hooks/useVideoBuilderState';
import { fetchVideoConcept } from './api';
import { WIZARD_STEPS } from './constants';

// 5. Relative imports - components
import { StepIndicator } from './components/StepIndicator';
import { FormFields } from './components/FormFields';

// 6. Styles (if any)
import styles from './VideoBuilder.module.css';
```

---

## 6. Naming Conventions

| Item | Convention | Example |
|------|------------|---------|
| Interfaces | PascalCase, prefix with `I` for contracts | `IFeatureService`, `VideoBuilderProps` |
| Types | PascalCase | `OptimizationMode`, `VideoFormData` |
| Zod Schemas | PascalCase + `Schema` suffix | `VideoConceptResponseSchema` |
| Type from Schema | Same name without `Schema` | `VideoConceptResponse` |
| Enums | PascalCase, singular | `OptimizationMode` |
| Constants | SCREAMING_SNAKE_CASE | `WIZARD_STEPS`, `API_ENDPOINTS` |
| Functions | camelCase | `fetchVideoConcept`, `validatePrompt` |
| React Components | PascalCase | `VideoBuilder`, `StepIndicator` |
| Hooks | camelCase, `use` prefix | `useVideoBuilderState` |
| Files - Types | `types.ts` or `*.types.ts` | `types.ts`, `domain.types.ts` |
| Files - Schemas | `schemas.ts` or `*.schemas.ts` | `schemas.ts`, `api.schemas.ts` |

---

## 7. Barrel Exports Pattern

Use `index.ts` files for clean imports:

```typescript
// components/VideoBuilder/index.ts
export { VideoBuilder } from './VideoBuilder';
export type { VideoBuilderProps } from './types';

// Usage elsewhere
import { VideoBuilder, type VideoBuilderProps } from '@/components/VideoBuilder';
```

**Rules:**
- Export only public API
- Use `export type` for type-only exports
- Don't re-export internal implementation details

---

## Quick Reference: When to Create What

| Scenario | Create |
|----------|--------|
| New component with complex state | `types.ts` + `hooks/useXState.ts` |
| Component fetches data | `api/schemas.ts` + `api/index.ts` |
| Multiple related constants | `constants.ts` |
| Reusable UI piece | `components/SubComponent.tsx` |
| Complex business logic | `services/SpecializedService.ts` |
| Multiple strategies | `strategies/IStrategy.ts` + implementations |
| Shared across features | `src/types/` or `src/schemas/` |

---

*Companion docs: [MIGRATION_GUIDE.md](./MIGRATION_GUIDE.md), [STYLE_RULES.md](./STYLE_RULES.md)*
