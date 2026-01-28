# Design Document: SRP/SOC Refactoring

## Overview

This design describes a manual process for identifying and refactoring Single Responsibility Principle (SRP) and Separation of Concerns (SOC) violations across the Prompt Builder codebase. The approach is principled rather than mechanical—focusing on distinct responsibilities and reasons to change rather than arbitrary line counts.

## Analysis Process

### Step 1: Scan All Source Directories

Recursively analyze all files in these directories:

- `client/src/` - All frontend source code
- `server/src/` - All backend source code
- `shared/` - Shared utilities and constants

Prioritize results by violation severity:
- **High**: Files with 3+ distinct responsibilities
- **Medium**: Files with 2 distinct responsibilities

Files with fewer than 2 distinct responsibilities are not violations and should not be included in analysis results.

### Step 2: Apply Exclusion Criteria

Skip these files (not worth analyzing):

- Files under 150 lines
- Test files (`*.test.ts`, `*.spec.ts`)
- Type definition files (`types.ts`, `*.types.ts`, `*.d.ts`)
- Configuration files (`*.config.ts`)
- Index/barrel files (`index.ts`)
- Files already in a refactored structure (e.g., `ComponentName/hooks/useX.ts`)

**Important**: Top-level hooks like `client/src/hooks/usePromptOptimizer.ts` SHOULD be analyzed. Only skip hooks that are already part of a component's extracted structure.

### Step 3: Identify Responsibility Categories

For each candidate file, identify which of these 6 categories are present:

| Category | What to Look For |
|----------|------------------|
| State Management | Reducers, complex useState orchestration, useReducer |
| API/Data Fetching | fetch calls, response handling, API client usage |
| Business Logic | Validation, formatting, calculations, transformations |
| UI Rendering | JSX, styling decisions, layout logic |
| Side Effects | useEffect chains, subscriptions, event listeners |
| Configuration | Magic numbers, feature flags, static data, constants |

### Step 4: Determine if Violation Exists

A file is a violation if it has **2 or more** distinct responsibility categories.

**NOT a violation:**
- A large file that does ONE thing well
- A component with many props but single rendering responsibility
- A service with many methods that all serve the same concern

### Step 5: Justify Before Refactoring (REQUIRED)

**Before splitting any file, you MUST answer these questions:**

1. **What are the two or more different reasons this file would need to change?**
   - Example: "A UI designer would change the rendering, while a backend developer would change the API integration"

2. **Who are the different stakeholders that would trigger these changes?**
   - Example: "Product team for business rules, DevOps for caching logic"

3. **How does splitting improve cohesion rather than just reducing file size?**
   - Example: "The API layer can be tested independently and reused by other components"

**If you cannot articulate distinct reasons to change → DO NOT SPLIT**

### Step 6: Apply Refactoring Pattern

#### Frontend Components

Follow the VideoConceptBuilder pattern:

```
ComponentName/
├── ComponentName.tsx         // Orchestration & JSX only
├── index.ts                  // Barrel exports
├── types.ts                  // Props, State, Domain types
├── hooks/
│   └── useComponentState.ts  // State management
├── api/
│   ├── index.ts              // Fetch functions
│   └── schemas.ts            // Zod schemas
├── components/
│   └── SubComponent.tsx      // Presentational components
└── utils/
    └── helpers.ts            // Pure functions
```

#### Backend Services

Follow the orchestrator pattern:

```
services/feature-name/
├── FeatureService.ts         // Orchestrator (coordination only)
├── index.ts                  // Barrel exports
├── types/
│   └── index.ts              // Domain and request/response types
├── contracts/
│   └── IFeatureService.ts    // Public interface
├── services/
│   └── ProcessingService.ts  // Specialized sub-service
└── schemas/
    └── requests.ts           // Zod validation
```

### Step 7: Verify After Refactoring

1. **Imports still work**: All files that imported from the original file can still import via barrel exports
2. **Tests pass**: Run the test suite to catch regressions
3. **Public API preserved**: The same exports are available from the same import path
4. **Backward compatibility shim**: Create a deprecated re-export at the original path

#### Backward Compatibility Shim Example

When splitting `Settings.tsx` into `Settings/Settings.tsx`:

```typescript
// client/src/components/Settings.tsx (deprecated shim)
/**
 * @deprecated Import from './Settings' directory instead.
 * This file will be removed in a future version.
 */
export * from './Settings';
export { Settings as default } from './Settings';
```

## Violation Report Format

For each violation found, document:

```
File: [path]
Lines: [count]

Responsibilities Found:
  1. [category] (lines X-Y): [description]
  2. [category] (lines X-Y): [description]

Reasons to Change:
  - [stakeholder/trigger 1]
  - [stakeholder/trigger 2]

Recommended Split:
  - [new file 1]: [responsibility]
  - [new file 2]: [responsibility]

Justification:
  [Why this split improves cohesion]
```

## Anti-Patterns to Avoid

### ❌ Mechanical Splitting

```
// BAD: Split because 210 > 200 lines, but these change together
UserProfile.tsx (180 lines) + UserProfileHeader.tsx (30 lines)
```

### ❌ Trivial Extractions

```
// BAD: Extracted file is under 50 lines and only used by one consumer
useUserProfileData.ts (35 lines)  // Only used by UserProfile.tsx
// Keep trivial code inline unless genuinely reused by multiple consumers
```

### ❌ Single-Use Extractions

```
// BAD: Created a hook only used by one component, doesn't represent separate concern
useUserProfileData.ts  // Only used by UserProfile.tsx, always changes with it
```

### ❌ Splitting Cohesive Logic

```
// BAD: Split a reducer that handles one state domain
userReducer.ts + userActions.ts + userSelectors.ts
// These always change together - keep them in one file
```

## Checklist Summary

**Before Refactoring:**
- [ ] File is >150 lines
- [ ] File is not excluded (test, types, config, index, already-refactored)
- [ ] File has 2+ distinct responsibility categories
- [ ] Can articulate different reasons to change
- [ ] Can identify different stakeholders
- [ ] Splitting improves cohesion (not just reduces size)
- [ ] Extracted files will be 50+ lines (or genuinely reused by multiple consumers)

**During Refactoring:**
- [ ] Applied correct refactoring pattern (frontend or backend)

**After Refactoring:**
- [ ] Imports still resolve via barrel exports
- [ ] Tests pass after refactoring
- [ ] Created deprecated re-export shim at original path (if applicable)


## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

Most requirements in this spec are process-oriented (manual analysis, human judgment about cohesion, documentation requirements) and are not amenable to automated property-based testing. However, the following properties can be verified:

### Property 1: Public API Preservation

*For any* refactored module, the set of exported symbols from the new barrel export (`index.ts`) SHALL be identical to the set of symbols exported from the original file before refactoring.

**Validates: Requirements 7.1**

### Property 2: Backward Compatibility Shim Correctness

*For any* file that is split into a directory structure, the deprecated re-export shim at the original path SHALL:
- Export all symbols that were previously exported
- Include a `@deprecated` JSDoc annotation

**Validates: Requirements 7.4**

## Error Handling

### Analysis Errors

- If a file cannot be read, skip it and log the error
- If responsibility categorization is ambiguous, document the ambiguity and request human review

### Refactoring Errors

- If barrel exports fail to resolve, revert the refactoring and investigate
- If tests fail after refactoring, identify the breaking change before proceeding
- If a circular dependency is introduced, restructure to eliminate it

## Testing Strategy

This spec primarily describes a manual analysis and refactoring process. Testing focuses on verification after refactoring:

### Unit Tests

- Verify that barrel exports resolve correctly
- Verify that deprecated shims re-export all expected symbols

### Property Tests

Property-based testing is limited for this spec since most requirements involve human judgment. The two testable properties (API preservation, backward compat shims) can be verified through:

1. **Export comparison**: Compare the set of exports before and after refactoring
2. **Shim verification**: Parse the deprecated shim file and verify it re-exports all symbols with @deprecated annotation

### Integration Tests

- Run the full test suite after each refactoring to catch regressions
- Verify that all imports from other files continue to resolve
