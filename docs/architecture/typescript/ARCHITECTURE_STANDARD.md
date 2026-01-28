# TypeScript Architecture Standard

## Overview

This document defines the directory structure and file organization patterns for TypeScript code in the Prompt Builder codebase. It extends the existing refactoring standards with TypeScript-specific requirements.

---

## 1. Frontend Component Structure

**When to Use This Structure:** Components that have **multiple distinct responsibilities** (e.g., state management + API calls + complex UI logic) should be split following this pattern. The test: can you describe each file in one sentence without "and"? If not, split by responsibility.

```text
ComponentName/
├── ComponentName.tsx         // Orchestration only—wires pieces, no business logic
├── index.ts                  // Re-exports (barrel file)
├── types.ts                  // Interfaces: Props, State, Domain Objects
├── constants.ts              // Static data, magic strings as const
├── hooks/                    // State + handlers—testable without rendering
│   ├── useComponentState.ts  // Main hook with useReducer
│   └── useSpecificFeature.ts // Specialized sub-hooks (one responsibility each)
├── api/                      // Fetch + parsing—one place for endpoint changes
│   ├── index.ts              // Exported fetch functions
│   └── schemas.ts            // Zod schemas for API responses
├── components/               // Display only—props in, JSX out (only if reused)
│   ├── SubComponent.tsx      
│   └── types.ts              // Props for sub-components (optional)
└── utils/                    // Pure transforms—no dependencies
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

**When to Use This Structure:** Services that have **multiple reasons to change** (different stakeholders, different data flows) should be split using the orchestrator pattern. The test: can you test each service with ≤2 mocks? If not, it knows too much.

```text
services/feature-name/
├── FeatureService.ts         // Orchestrator—coordinates, doesn't implement
├── index.ts                  // Re-exports
├── types/                    // TypeScript interfaces
│   ├── index.ts              // Barrel exports
│   ├── domain.ts             // Domain object types
│   └── requests.ts           // Request/Response types
├── contracts/                // Interface definitions for DI
│   └── IFeatureService.ts    // Public contract
├── services/                 // One responsibility per service
│   ├── ProcessingService.ts  
│   └── ValidationService.ts  
├── strategies/               // Strategy pattern implementations
│   ├── IStrategy.ts          // Strategy interface
│   ├── VideoStrategy.ts      
│   └── ResearchStrategy.ts   
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

## 4. When to Split

**The only question:** How many reasons does this have to change?

### Split when:
- File has multiple distinct responsibilities
- Different parts have different reasons to change
- You want to test parts independently
- Parts could be reused elsewhere

### Don't split when:
- File has one responsibility (even if it's long)
- Pieces always change together
- Pieces only make sense together
- You're just hitting some arbitrary threshold

### ❌ Mechanical Splitting (Anti-Pattern)

```typescript
// BAD: Split because "it was too long", but these change together
UserProfile.tsx + UserProfileHeader.tsx
```

If `UserProfileHeader` is only used by `UserProfile` and they always change together, this split adds indirection without improving cohesion.

### ✅ Principled Splitting

```typescript
// GOOD: Split because different responsibilities
UserProfile.tsx (orchestration) + UserAvatar.tsx (reusable, independent)
```

`UserAvatar` is reused elsewhere and has its own reason to change.

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

## 8. Code Smells: What Actually Triggers Refactoring

**Core Principle:** Line counts are secondary indicators. These code smells are the primary triggers for refactoring. Use this section when reviewing code or asking Claude Code to find architectural issues.

### 8.1 Dependency Explosion

**The Smell:** Constructor or hook requires 6+ dependencies.

```typescript
// 🚨 RED FLAG: 6+ constructor dependencies
class PromptService {
  constructor(
    private readonly aiService: AIService,
    private readonly cacheService: CacheService,
    private readonly videoService: VideoService,
    private readonly promptBuilder: PromptBuilder,
    private readonly validationService: ValidationService,
    private readonly metricsService: MetricsService,
    private readonly loggingService: LoggingService,
    private readonly configService: ConfigService,  // 8 deps = definite smell
  ) {}
}

// 🚨 RED FLAG: Hook with 6+ dependencies
function usePromptEditor() {
  const auth = useAuth();
  const api = useApi();
  const validation = useValidation();
  const analytics = useAnalytics();
  const storage = useStorage();
  const notifications = useNotifications();  // 6 hooks = smell
  // ...
}
```

**Why It Matters:** Each dependency is a "reason to change." High dependency count indicates the unit is orchestrating multiple unrelated workflows.

**The Fix:** Split into focused services/hooks, or introduce a facade that groups related dependencies.

```typescript
// ✅ BETTER: Grouped dependencies behind focused interfaces
class PromptService {
  constructor(
    private readonly generation: IGenerationPipeline,  // groups AI + prompts
    private readonly persistence: IPersistencePipeline, // groups cache + storage
    private readonly observability: IObservability,     // groups metrics + logging
  ) {}
}
```

**Detection Command:**
```bash
# Find classes/functions with many constructor params or hook calls
grep -r "constructor(" server/src --include="*.ts" -A 10 | grep -c "private readonly"
```

---

### 8.2 Method Name Clustering

**The Smell:** Methods in a class/hook group into distinct prefixes that represent different concerns.

```typescript
// 🚨 RED FLAG: Method names reveal hidden sub-services
class PromptService {
  // Cluster 1: Generation concern
  generatePrompt() {}
  generateVariations() {}
  generateFromTemplate() {}
  
  // Cluster 2: Validation concern (different reason to change!)
  validatePromptLength() {}
  validatePromptSafety() {}
  validatePromptStructure() {}
  
  // Cluster 3: Persistence concern (different reason to change!)
  savePrompt() {}
  loadPrompt() {}
  deletePrompt() {}
}

// 🚨 RED FLAG: React component with method clusters
function PromptEditor() {
  // Cluster 1: Form state
  const handleInputChange = () => {};
  const handleFormSubmit = () => {};
  const resetForm = () => {};
  
  // Cluster 2: API operations (different concern!)
  const fetchSuggestions = () => {};
  const saveDraft = () => {};
  const publishPrompt = () => {};
  
  // Cluster 3: UI state (different concern!)
  const toggleSidebar = () => {};
  const openModal = () => {};
  const showToast = () => {};
}
```

**The Test:** Can you group methods by prefix? Do those groups have different reasons to change? If yes, split.

**The Fix:**
```typescript
// ✅ BETTER: Separate services for separate concerns
class PromptGenerationService { /* generate* methods */ }
class PromptValidationService { /* validate* methods */ }
class PromptRepository { /* save/load/delete methods */ }

// ✅ BETTER: Separate hooks for separate concerns
function usePromptForm() { /* form state */ }
function usePromptApi() { /* API operations */ }
function useEditorUI() { /* UI state */ }
```

---

### 8.3 Cross-Domain Imports

**The Smell:** A file imports from 4+ unrelated feature domains.

```typescript
// 🚨 RED FLAG: Service importing from unrelated domains
import { UserService } from '@services/user';
import { BillingService } from '@services/billing';
import { AnalyticsService } from '@services/analytics';
import { NotificationService } from '@services/notification';
import { VideoService } from '@services/video';
import { TemplateService } from '@services/templates';

// 🚨 RED FLAG: Component importing from unrelated features
import { useAuth } from '@features/auth';
import { useSubscription } from '@features/billing';
import { usePromptHistory } from '@features/history';
import { useTeamMembers } from '@features/teams';
import { useAnalytics } from '@features/analytics';
```

**Why It Matters:** A unit touching auth, billing, video, AND notifications is doing too much. It will break when any of those domains change.

**The Fix:** Create a focused orchestrator at a higher level, or split into domain-specific handlers.

**Detection Command:**
```bash
# Find files with imports from many different service directories
grep -l "@services/" server/src/**/*.ts | xargs -I {} sh -c 'echo "{}:"; grep -c "@services/" {}' | sort -t: -k2 -rn
```

---

### 8.4 Type/Mode Switching

**The Smell:** Large if/else or switch statements based on a "type" or "mode" parameter.

```typescript
// 🚨 RED FLAG: Giant conditional based on type
async function processPrompt(input: Input) {
  if (input.type === 'video') {
    // 50 lines of video-specific logic
    const model = detectVideoModel(input.text);
    const constraints = getVideoConstraints(model);
    // ... more video stuff
  } else if (input.type === 'image') {
    // 50 lines of image-specific logic
    const dimensions = parseImageDimensions(input.text);
    // ... more image stuff
  } else if (input.type === 'audio') {
    // 50 lines of audio-specific logic
    const duration = parseAudioDuration(input.text);
    // ... more audio stuff
  } else if (input.type === 'research') {
    // 50 lines of research-specific logic
  }
}

// 🚨 RED FLAG: Component rendering based on mode
function Editor({ mode }: { mode: 'basic' | 'advanced' | 'expert' }) {
  if (mode === 'basic') {
    return <BasicEditor />; // But with 100 lines of basic-specific setup
  } else if (mode === 'advanced') {
    return <AdvancedEditor />; // With 100 lines of advanced-specific setup
  }
  // ...
}
```

**The Fix:** Strategy pattern for backend, component composition for frontend.

```typescript
// ✅ BETTER: Strategy pattern
interface IProcessingStrategy {
  process(input: Input): Promise<Output>;
}

class VideoStrategy implements IProcessingStrategy { /* video logic */ }
class ImageStrategy implements IProcessingStrategy { /* image logic */ }
class AudioStrategy implements IProcessingStrategy { /* audio logic */ }

class PromptProcessor {
  constructor(private strategies: Map<string, IProcessingStrategy>) {}
  
  async process(input: Input): Promise<Output> {
    const strategy = this.strategies.get(input.type);
    if (!strategy) throw new Error(`Unknown type: ${input.type}`);
    return strategy.process(input);
  }
}

// ✅ BETTER: Component composition
const EDITOR_COMPONENTS = {
  basic: BasicEditor,
  advanced: AdvancedEditor,
  expert: ExpertEditor,
} as const;

function Editor({ mode }: { mode: keyof typeof EDITOR_COMPONENTS }) {
  const EditorComponent = EDITOR_COMPONENTS[mode];
  return <EditorComponent />;
}
```

---

### 8.5 Mixed Concerns in Methods

**The Smell:** A single method performs data transformation + business logic + I/O side effects.

```typescript
// 🚨 RED FLAG: Method doing 3 different things
async function processEnhancement(prompt: string) {
  // 1. Data transformation (should be in utils/)
  const normalized = prompt.toLowerCase().trim().replace(/\s+/g, ' ');
  const tokens = normalized.split(' ').filter(t => t.length > 2);
  const wordCount = tokens.length;
  
  // 2. Business logic (core responsibility - OK here)
  const suggestions = await this.ai.generate(tokens);
  const filtered = suggestions.filter(s => s.confidence > 0.5);
  
  // 3. I/O side effects (should be separate)
  await this.db.save({ prompt, suggestions: filtered, timestamp: Date.now() });
  await this.analytics.track('enhancement_generated', { count: filtered.length });
  await this.cache.set(prompt, filtered);
  
  return filtered;
}

// 🚨 RED FLAG: React handler doing too much
const handleSubmit = async () => {
  // 1. Validation (could be in schema)
  if (!form.title || form.title.length < 3) {
    setError('Title too short');
    return;
  }
  
  // 2. Transformation (could be in utils)
  const slug = form.title.toLowerCase().replace(/\s+/g, '-');
  const normalized = { ...form, slug, createdAt: new Date().toISOString() };
  
  // 3. API call
  const result = await api.create(normalized);
  
  // 4. Side effects
  analytics.track('created');
  toast.success('Created!');
  router.push(`/prompts/${result.id}`);
};
```

**The Fix:** Single responsibility per function.

```typescript
// ✅ BETTER: Separated concerns
// utils/normalize.ts
export function normalizePrompt(prompt: string): NormalizedPrompt {
  const text = prompt.toLowerCase().trim().replace(/\s+/g, ' ');
  const tokens = text.split(' ').filter(t => t.length > 2);
  return { text, tokens, wordCount: tokens.length };
}

// services/EnhancementService.ts
async function processEnhancement(prompt: string) {
  const normalized = normalizePrompt(prompt);  // Pure transformation
  const suggestions = await this.generateSuggestions(normalized);  // Business logic
  await this.persistResults(prompt, suggestions);  // I/O (could be event-driven)
  return suggestions;
}

// ✅ BETTER: React with separated concerns
const handleSubmit = async () => {
  const validation = validateForm(form);  // Pure function
  if (!validation.ok) {
    setError(validation.error);
    return;
  }
  
  const normalized = prepareForSubmit(form);  // Pure function
  await submitAndNavigate(normalized);  // Async handler
};
```

---

### 8.6 Trapped Utilities

**The Smell:** Private methods that are generic algorithms with no domain-specific logic.

```typescript
// 🚨 RED FLAG: Generic algorithm trapped in domain service
class SuggestionService {
  private calculateJaccardSimilarity(a: string, b: string): number {
    // This is a generic text algorithm, nothing suggestion-specific
    const set1 = new Set(a.toLowerCase().split(/\s+/));
    const set2 = new Set(b.toLowerCase().split(/\s+/));
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);
    return intersection.size / union.size;
  }
  
  private formatAsMarkdown(text: string): string {
    // Generic formatting, could be in @utils/format
    return text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  }
  
  private debounce<T extends (...args: unknown[]) => unknown>(fn: T, ms: number) {
    // Generic utility, definitely should be in @utils/
    let timeout: NodeJS.Timeout;
    return (...args: Parameters<T>) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => fn(...args), ms);
    };
  }
}

// 🚨 RED FLAG: Component with generic helpers
function PromptEditor() {
  // Generic deep equality check
  const isEqual = (a: unknown, b: unknown) => 
    JSON.stringify(a) === JSON.stringify(b);
  
  // Generic array shuffle
  const shuffle = <T>(arr: T[]): T[] => 
    [...arr].sort(() => Math.random() - 0.5);
}
```

**The Test:** Could this function work in a completely different feature without modification? If yes, extract it.

**The Fix:**
```typescript
// ✅ BETTER: Extracted to utils
// utils/text/similarity.ts
export function jaccardSimilarity(a: string, b: string): number { /* ... */ }

// utils/format/markdown.ts  
export function markdownToHtml(text: string): string { /* ... */ }

// utils/async/debounce.ts
export function debounce<T extends (...args: unknown[]) => unknown>(fn: T, ms: number) { /* ... */ }

// Now SuggestionService just imports them
import { jaccardSimilarity } from '@utils/text/similarity';
```

---

### 8.7 Observability Bloat

**The Smell:** More logging/metrics code than actual business logic.

```typescript
// 🚨 RED FLAG: 20 lines of observability for 3 lines of logic
async function generateSuggestions(prompt: string) {
  const startTime = Date.now();
  const requestId = crypto.randomUUID();
  
  this.logger.info('Starting suggestion generation', {
    requestId,
    promptLength: prompt.length,
    timestamp: new Date().toISOString(),
  });
  this.metrics.increment('suggestions.generation.started');
  this.metrics.gauge('suggestions.generation.prompt_length', prompt.length);
  
  try {
    const result = await this.ai.complete(prompt);  // <- Actual work: 1 line
    
    const duration = Date.now() - startTime;
    this.logger.info('Suggestion generation complete', {
      requestId,
      duration,
      resultCount: result.length,
      avgConfidence: result.reduce((a, b) => a + b.confidence, 0) / result.length,
    });
    this.metrics.histogram('suggestions.generation.duration', duration);
    this.metrics.increment('suggestions.generation.success');
    this.metrics.gauge('suggestions.generation.result_count', result.length);
    
    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    this.logger.error('Suggestion generation failed', {
      requestId,
      duration,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    this.metrics.increment('suggestions.generation.error');
    this.metrics.histogram('suggestions.generation.error_duration', duration);
    throw error;
  }
}
```

**The Fix:** Use decorators, middleware, or aspect-oriented patterns.

```typescript
// ✅ BETTER: Decorator pattern
@Traced('suggestions.generation')
@Metered('suggestions.generation')
async function generateSuggestions(prompt: string) {
  return this.ai.complete(prompt);  // Just the business logic
}

// ✅ BETTER: Wrapper utility
const generateSuggestions = withObservability(
  'suggestions.generation',
  async (prompt: string) => this.ai.complete(prompt)
);

// ✅ ACCEPTABLE: Minimal inline logging
async function generateSuggestions(prompt: string) {
  this.logger.debug('Generating suggestions', { promptLength: prompt.length });
  const result = await this.ai.complete(prompt);
  this.logger.debug('Generated suggestions', { count: result.length });
  return result;
}
```

---

### 8.8 The "And" Test

**The Smell:** You can't describe what a unit does without using "and" multiple times.

```typescript
// 🚨 RED FLAG: Description requires multiple "and"s
// "PromptManager validates prompts AND generates suggestions AND 
//  saves to database AND sends notifications AND tracks analytics"

class PromptManager {
  async handlePrompt(prompt: string) {
    // Validation
    const isValid = await this.validate(prompt);
    if (!isValid) throw new ValidationError();
    
    // Generation
    const suggestions = await this.generateSuggestions(prompt);
    
    // Persistence
    await this.db.savePrompt({ prompt, suggestions });
    
    // Notifications
    await this.notificationService.notify(user, 'prompt_processed');
    
    // Analytics
    await this.analytics.track('prompt_processed', { suggestionCount: suggestions.length });
    
    return suggestions;
  }
}
```

**The Test:** Describe your class/function/component in one sentence. Count the "and"s.
- 0 "and"s: Good single responsibility
- 1 "and": Possibly OK if tightly coupled
- 2+ "and"s: Needs splitting

**The Fix:**
```typescript
// ✅ BETTER: Each service has one "and"-free description
// "PromptValidationService validates prompts"
class PromptValidationService { /* ... */ }

// "SuggestionGenerationService generates suggestions"
class SuggestionGenerationService { /* ... */ }

// "PromptRepository persists prompts"
class PromptRepository { /* ... */ }

// "PromptOrchestrator coordinates the prompt processing workflow"
class PromptOrchestrator {
  async handlePrompt(prompt: string) {
    const validated = await this.validation.validate(prompt);
    const suggestions = await this.generation.generate(validated);
    await this.repository.save({ prompt, suggestions });
    this.events.emit('prompt:processed', { prompt, suggestions });  // Let listeners handle notifications/analytics
    return suggestions;
  }
}
```

---

### 8.9 Props/Parameter Drilling

**The Smell:** Passing props through 3+ component layers without using them.

```typescript
// 🚨 RED FLAG: Props passed through multiple layers
function PageLayout({ user, theme, onLogout, notifications, ...props }) {
  return (
    <MainContent 
      user={user} 
      theme={theme} 
      onLogout={onLogout}
      notifications={notifications}  // Just passing through
    >
      {props.children}
    </MainContent>
  );
}

function MainContent({ user, theme, onLogout, notifications, children }) {
  return (
    <Sidebar 
      user={user} 
      onLogout={onLogout}
      notifications={notifications}  // Still just passing through
    />
    <Content theme={theme}>{children}</Content>
  );
}

function Sidebar({ user, onLogout, notifications }) {
  // Finally uses these props
  return <UserMenu user={user} onLogout={onLogout} notifications={notifications} />;
}
```

**The Fix:** Context for truly global state, or composition pattern.

```typescript
// ✅ BETTER: Context for cross-cutting concerns
const UserContext = createContext<UserContextValue>(null);

function PageLayout({ children }) {
  return <MainContent>{children}</MainContent>;
}

function Sidebar() {
  const { user, onLogout, notifications } = useUserContext();
  return <UserMenu user={user} onLogout={onLogout} notifications={notifications} />;
}

// ✅ BETTER: Composition pattern
function PageLayout({ sidebar, children }) {
  return (
    <div>
      {sidebar}  {/* Sidebar rendered at top level with direct access to props */}
      <Content>{children}</Content>
    </div>
  );
}

// Usage
<PageLayout sidebar={<Sidebar user={user} onLogout={onLogout} />}>
  <MyPage />
</PageLayout>
```

---

### 8.10 Async/State Spaghetti

**The Smell:** Multiple `useState` calls that depend on each other, or async operations that must happen in sequence with manual coordination.

```typescript
// 🚨 RED FLAG: Interdependent useState calls
function PromptEditor() {
  const [prompt, setPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [selectedSuggestion, setSelectedSuggestion] = useState<Suggestion | null>(null);
  const [isApplying, setIsApplying] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const [canUndo, setCanUndo] = useState(false);  // Derived from history!
  
  // Now you have to manually keep these in sync...
  const handleSelectSuggestion = (s: Suggestion) => {
    setSelectedSuggestion(s);
    setError(null);  // Clear error when selecting
  };
  
  const handleApply = async () => {
    setIsApplying(true);
    setError(null);
    try {
      // ...
      setHistory([...history, prompt]);
      setCanUndo(true);  // Must remember to sync this!
      setPrompt(selectedSuggestion.text);
      setSelectedSuggestion(null);
      setSuggestions([]);
    } catch (e) {
      setError(e.message);
    } finally {
      setIsApplying(false);
    }
  };
}
```

**The Fix:** `useReducer` for complex state, derived state for computed values.

```typescript
// ✅ BETTER: useReducer with clear state machine
type State = {
  prompt: string;
  suggestions: Suggestion[];
  selectedIndex: number | null;
  history: string[];
  status: 'idle' | 'loading' | 'applying' | 'error';
  error: string | null;
};

type Action =
  | { type: 'FETCH_START' }
  | { type: 'FETCH_SUCCESS'; suggestions: Suggestion[] }
  | { type: 'FETCH_ERROR'; error: string }
  | { type: 'SELECT'; index: number }
  | { type: 'APPLY_START' }
  | { type: 'APPLY_SUCCESS'; newPrompt: string }
  | { type: 'UNDO' };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'APPLY_SUCCESS':
      return {
        ...state,
        prompt: action.newPrompt,
        history: [...state.history, state.prompt],
        suggestions: [],
        selectedIndex: null,
        status: 'idle',
      };
    // ... other cases
  }
}

function PromptEditor() {
  const [state, dispatch] = useReducer(reducer, initialState);
  
  // Derived state - no useState needed!
  const canUndo = state.history.length > 0;
  const selectedSuggestion = state.selectedIndex !== null 
    ? state.suggestions[state.selectedIndex] 
    : null;
  const isLoading = state.status === 'loading';
}
```

---

## Code Smell Detection Checklist

Use this checklist when reviewing code or running architectural audits:

| Smell | Detection Method | Threshold |
|-------|------------------|----------|
| Dependency explosion | Count constructor params / hook imports | >5 dependencies |
| Method clustering | Group methods by prefix | 3+ distinct clusters |
| Cross-domain imports | Count unique `@services/` or `@features/` imports | >4 domains |
| Type switching | Search for `if.*type ===` or `switch.*type` | >3 branches with 20+ lines each |
| Mixed concerns | Count distinct operations in one method | Transform + Logic + I/O |
| Trapped utilities | Private methods usable elsewhere unchanged | Any generic algorithm |
| Observability bloat | Ratio of logging lines to logic lines | >2:1 ratio |
| The "And" test | Describe unit in one sentence | >1 "and" |
| Props drilling | Props passed through without use | >2 layers |
| Async spaghetti | Count interdependent `useState` calls | >5 related states |

### Quick Detection Commands

```bash
# Find files with many dependencies (constructor params)
grep -r "constructor(" server/src --include="*.ts" -A 15 | grep -c "private readonly"

# Find potential type-switching (large conditionals)
grep -rn "if.*\.type ===\|switch.*\.type" server/src client/src --include="*.ts" --include="*.tsx"

# Find files with many useState calls (potential spaghetti)
grep -c "useState" client/src/**/*.tsx | awk -F: '$2 > 5 {print}'

# Find cross-domain imports
for f in server/src/services/**/*.ts; do
  count=$(grep -c "@services/" "$f" 2>/dev/null || echo 0)
  if [ "$count" -gt 4 ]; then echo "$f: $count imports"; fi
done
```

---

## When to Refactor vs. Leave Alone

### ✅ Refactor When:
- Adding a feature would require touching 3+ unrelated methods
- A bug fix in one area keeps breaking another area
- New team members consistently misunderstand the code's purpose
- You need to copy-paste code because it's trapped in a specific context
- Tests require mocking 5+ dependencies

### ❌ Leave Alone When:
- Code is stable and rarely changes
- "Smell" is just line count, not actual coupling
- Splitting would create files with <50 lines that always change together
- The code is scheduled for replacement anyway
- Refactoring would delay a critical deadline with no ongoing maintenance benefit

---

*Companion docs: [MIGRATION_GUIDE.md](./MIGRATION_GUIDE.md), [STYLE_RULES.md](./STYLE_RULES.md)*
