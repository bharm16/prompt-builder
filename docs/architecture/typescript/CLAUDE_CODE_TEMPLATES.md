# Claude Code TypeScript Templates

Copy-paste these templates when working with Claude Code for TypeScript development.

---

## 🔴 Critical: SRP/SoC Over Line Counts

**Line counts are heuristics, NOT splitting triggers.** Before splitting any file:

1. **Identify distinct responsibilities** - Does the file have multiple reasons to change?
2. **Check for mixed concerns** - Is orchestration mixed with implementation?
3. **Evaluate cohesion** - Would splitting improve or harm cohesion?

**If a file has ONE cohesive responsibility → Don't split, even if over threshold.**

### ❌ Mechanical Splitting (Never Do This)
```typescript
// BAD: Split because 210 > 200, but they change together
UserProfile.tsx (180 lines) + UserProfileHeader.tsx (30 lines)
```

### ✅ Principled Splitting
```typescript
// GOOD: Split because different responsibilities, reusable
UserProfile.tsx (orchestration) + UserAvatar.tsx (reused elsewhere)
```

---

## 🔴 Before Every Request

```
Follow TypeScript + [VideoConceptBuilder | PromptOptimizationService] pattern.

SRP CHECK (answer before implementing):
1. How many distinct responsibilities does this have?
2. How many reasons to change?
3. If only 1 responsibility → keep cohesive, don't split mechanically

TYPE REQUIREMENTS:
- NO `any` or type assertions without TODO comment
- Props/State interfaces in types.ts
- API responses validated with Zod schemas in schemas.ts
- Discriminated unions for reducer actions

Show me the proposed file structure BEFORE implementing.
```

---

## Template 1: New TypeScript Frontend Component

```
Add [FEATURE NAME] component

ARCHITECTURE: TypeScript + VideoConceptBuilder pattern

Structure:
```text
ComponentName/
├── ComponentName.tsx        (orchestrator, typically ~300-500 lines)
├── index.ts                 (barrel exports)
├── types.ts                 (Props, State, Domain interfaces)
├── constants.ts             (as const literals, config)
├── hooks/
│   └── useComponentState.ts (useReducer with typed actions)
├── api/
│   ├── index.ts             (typed fetch functions)
│   └── schemas.ts           (Zod schemas + inferred types)
└── components/              (UI pieces - split by responsibility, not line count)
```

NOTE: Only create subdirectories for files with DISTINCT responsibilities.
A 250-line component with one cohesive flow is better than 3 artificially split files.

TYPE REQUIREMENTS:
- [ ] Props interface exported from types.ts
- [ ] State interface with all fields typed
- [ ] Actions as discriminated union: `type Action = { type: 'X'; payload: Y } | ...`
- [ ] API responses validated with Zod `.parse()`
- [ ] NO `any` - use `unknown` and narrow
- [ ] Explicit return types on exported functions

REFERENCE: client/src/components/VideoConceptBuilder/
SHOW STRUCTURE FIRST, then show types.ts content
```

### Example Usage:

```
Add VideoWizard component for step-by-step video prompt creation

ARCHITECTURE: TypeScript + VideoConceptBuilder pattern

[paste template above]

EXPECTED TYPES:
- VideoWizardProps: { onComplete, initialData? }
- VideoWizardState: { step, formData, errors, isSubmitting }
- VideoWizardAction: SET_FIELD | NEXT_STEP | PREV_STEP | SUBMIT | SET_ERROR
- VideoFormData: { subject, action, location, atmosphere? }

API:
- POST /api/video-concept → VideoConceptResponseSchema

SHOW STRUCTURE AND types.ts FIRST
```

---

## Template 2: New TypeScript Backend Service

```
Add [SERVICE NAME] service

ARCHITECTURE: TypeScript + PromptOptimizationService pattern

Structure:
```text
services/feature-name/
├── FeatureService.ts        (orchestrator, typically ~300-500 lines)
├── index.ts                 (barrel exports)
├── types/
│   ├── index.ts             (barrel exports)
│   ├── domain.ts            (domain object interfaces)
│   └── requests.ts          (request/response interfaces)
├── contracts/
│   └── IFeatureService.ts   (public interface for DI)
├── services/                (specialized sub-services - split by responsibility)
├── strategies/              (strategy pattern implementations)
└── schemas/
    ├── requests.ts          (Zod input validation)
    └── responses.ts         (Zod output validation)
```

NOTE: Only create specialized services for DISTINCT responsibilities.
A 400-line service doing one thing well is better than 4 artificially split files.

TYPE REQUIREMENTS:
- [ ] IFeatureService interface in contracts/
- [ ] All dependencies injected via constructor with interfaces
- [ ] Request schemas validate incoming data
- [ ] Response schemas validate outgoing data
- [ ] NO `any` - all parameters and returns typed
- [ ] Explicit return types on all public methods

REFERENCE: server/src/services/prompt-optimization/PromptOptimizationService.ts
SHOW STRUCTURE FIRST, then show contracts/IFeatureService.ts
```

### Example Usage:

```
Add VideoAnalysisService for analyzing video prompt quality

ARCHITECTURE: TypeScript + PromptOptimizationService pattern

[paste template above]

EXPECTED INTERFACES:
- IVideoAnalysisService: { analyze, score, suggest }
- AnalysisRequest: { prompt, mode }
- AnalysisResult: { score, suggestions, metadata }

DEPENDENCIES (inject via constructor):
- IClaudeClient
- ICacheService
- ILogger

STRATEGIES:
- CinematicStrategy
- DocumentaryStrategy
- AbstractStrategy

SHOW STRUCTURE AND IVideoAnalysisService.ts FIRST
```

---

## Template 3: Migrate Existing JS to TypeScript

```
Migrate [FILE PATH] from JavaScript to TypeScript

CURRENT:
- File: [path]
- Lines: [count]
- Dependencies: [list key imports]

MIGRATION STEPS:
1. [ ] Create types.ts with interfaces for all data structures
2. [ ] Create schemas.ts if file makes API calls
3. [ ] Rename .js → .ts (or .jsx → .tsx)
4. [ ] Add type annotations to all function parameters
5. [ ] Add explicit return types to exported functions
6. [ ] Replace JSDoc @param/@returns with TS types
7. [ ] Wrap API responses with Zod .parse()
8. [ ] Handle all null/undefined cases

TYPE REQUIREMENTS:
- [ ] NO `any` - use `unknown` + type guards
- [ ] NO `as X` type assertions without TODO comment
- [ ] All imports typed (add .d.ts if needed)
- [ ] Discriminated unions for action objects

VALIDATION:
After migration:
- tsc --noEmit passes
- grep ": any" returns zero matches
- All tests pass

SHOW types.ts FIRST, then the migrated file
```

### Example Usage:

```
Migrate client/src/hooks/usePromptOptimizer.js to TypeScript

CURRENT:
- File: client/src/hooks/usePromptOptimizer.js
- Lines: 145
- Dependencies: fetch, useState, useCallback

[paste template above]

EXPECTED TYPES:
- UsePromptOptimizerOptions: { mode, onComplete? }
- UsePromptOptimizerReturn: { optimize, isLoading, error, result }
- OptimizationResult (from Zod schema)

API CALLS TO WRAP:
- POST /api/optimize → OptimizationResponseSchema

SHOW types.ts AND schemas.ts FIRST
```

---

## Template 4: Add Zod Schema for Existing API

```
Add Zod validation for [API ENDPOINT]

CURRENT STATE:
- Endpoint: [method] [path]
- Current response handling: [describe - probably `as Type`]
- Used in: [list files that call this]

CREATE:
1. schemas.ts with:
   - Request schema (if POST/PUT)
   - Response schema
   - Inferred TypeScript types

2. Update API function to:
   - Use Schema.parse() on response
   - Handle ZodError appropriately

SCHEMA REQUIREMENTS:
- [ ] All fields explicitly typed (no z.any())
- [ ] Optional fields marked with .optional()
- [ ] Arrays typed with z.array(ItemSchema)
- [ ] Nested objects as separate schemas
- [ ] Error messages for user-facing validations

SHOW schemas.ts FIRST, then updated API function
```

### Example Usage:

```
Add Zod validation for video concept API

CURRENT STATE:
- Endpoint: POST /api/video-concept
- Current response handling: `as VideoConceptResponse`
- Used in: VideoBuilder.tsx, useVideoConcept.ts

[paste template above]

EXPECTED RESPONSE SHAPE:
{
  id: string (uuid),
  concept: string,
  elements: { subject, action, location, atmosphere? },
  confidence: number (0-1),
  suggestions: string[],
  createdAt: ISO datetime
}

SHOW VideoConceptResponseSchema FIRST
```

---

## Template 5: Add Types to Existing Hook

```
Add TypeScript types to [HOOK NAME]

CURRENT:
- File: [path]
- Parameters: [list current params]
- Return value: [describe return shape]
- State: [describe internal state]

CREATE types.ts WITH:
- HookOptions interface (input parameters)
- HookReturn interface (return value)
- Internal state interfaces
- Action types (if useReducer)

REQUIREMENTS:
- [ ] Generic parameters if hook is generic
- [ ] Explicit return type annotation
- [ ] All callbacks typed: `(params: X) => Y`
- [ ] Event handlers typed: `React.MouseEvent<HTMLButtonElement>`

SHOW types.ts FIRST, then hook signature
```

---

## Template 6: Full-Stack TypeScript Feature

```
Add [FEATURE NAME] feature (full-stack TypeScript)

SHARED TYPES (if monorepo):
Create shared types that backend and frontend both use

BACKEND:
- Location: server/src/services/[name]/
- Pattern: TypeScript + PromptOptimizationService
- Interface: IFeatureService with full method signatures
- Schemas: Request and Response Zod schemas

FRONTEND:
- Location: client/src/features/[name]/
- Pattern: TypeScript + VideoConceptBuilder
- Types: Props, State, Actions
- Schemas: Mirror backend response schemas

API CONTRACT:
```typescript
// Define before implementing
interface ApiContract {
  'POST /api/feature': {
    request: CreateFeatureRequest;
    response: FeatureResponse;
  };
  'GET /api/feature/:id': {
    params: { id: string };
    response: FeatureResponse;
  };
}
```

IMPLEMENTATION ORDER:
1. Shared types (if applicable)
2. Backend schemas (Zod)
3. Backend service (implements interface)
4. Frontend schemas (copy or import from backend)
5. Frontend API layer (typed fetch with Zod)
6. Frontend hooks (typed state)
7. Frontend components (typed props)

SHOW API CONTRACT AND SHARED TYPES FIRST
```

---

## Template 7: Fix Type Errors

```
Fix TypeScript errors in [FILE PATH]

ERRORS:
[Paste the actual TypeScript errors]

CONSTRAINTS:
- NO `any` unless absolutely necessary (with TODO comment)
- NO `@ts-ignore` or `@ts-expect-error`
- Prefer type guards over type assertions
- If type is genuinely unknown, use `unknown` and narrow

APPROACHES (in order of preference):
1. Fix the type definition to match reality
2. Add type guard function
3. Use Zod to validate at runtime
4. Narrow with `typeof`/`instanceof`
5. LAST RESORT: `as unknown as X` with TODO

SHOW THE FIX with explanation of why it's type-safe
```

---

## Quick Reference: Type Patterns

### Discriminated Union for Actions
```typescript
type Action =
  | { type: 'SET_VALUE'; value: string }
  | { type: 'SET_ERROR'; error: Error }
  | { type: 'RESET' };
```

### Generic Hook Return
```typescript
interface UseAsyncReturn<T> {
  data: T | null;
  isLoading: boolean;
  error: Error | null;
  execute: () => Promise<void>;
}
```

### Props with Children
```typescript
interface CardProps {
  title: string;
  children: React.ReactNode;
}
```

### Event Handlers
```typescript
interface FormProps {
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
}
```

### API Function
```typescript
async function fetchUser(id: string): Promise<User> {
  const response = await fetch(`/api/users/${id}`);
  const data = await response.json();
  return UserSchema.parse(data);
}
```

---

## Validation Commands

```bash
# Type check without emitting
npx tsc --noEmit

# Find all `any` types
grep -r ": any" src/ --include="*.ts" --include="*.tsx"

# Find all type assertions
grep -r " as " src/ --include="*.ts" --include="*.tsx" | grep -v "import"

# Find all @ts-ignore
grep -r "@ts-ignore" src/ --include="*.ts" --include="*.tsx"

# Count TS vs JS files
echo "TypeScript: $(find src -name '*.ts' -o -name '*.tsx' | wc -l)"
echo "JavaScript: $(find src -name '*.js' -o -name '*.jsx' | wc -l)"
```

---

## Red Flags (Stop and Fix)

### Type Safety
- ❌ Using `any` without TODO comment
- ❌ Using `as Type` without runtime validation
- ❌ Missing return type on exported function
- ❌ `@ts-ignore` or `@ts-expect-error`
- ❌ Optional chaining (`?.`) more than 2 levels deep
- ❌ Manual type that duplicates Zod schema
- ❌ JSDoc `@param` or `@returns` with type info

### Architecture (SRP/SoC)
- ❌ Splitting files solely because they exceed a line threshold
- ❌ Creating components only used in one place
- ❌ Extracting code that always changes together
- ❌ Adding indirection without improving cohesion

### When to Split (✅ Do This)
- ✅ File has multiple distinct responsibilities
- ✅ Different parts have different reasons to change
- ✅ Extracted piece is reusable elsewhere
- ✅ Mixing orchestration with implementation details

---

*Companion docs: [ARCHITECTURE_STANDARD.md](./ARCHITECTURE_STANDARD.md), [STYLE_RULES.md](./STYLE_RULES.md), [ZOD_PATTERNS.md](./ZOD_PATTERNS.md)*
