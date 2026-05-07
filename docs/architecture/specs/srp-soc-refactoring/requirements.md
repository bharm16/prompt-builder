# Requirements Document

## Introduction

This specification defines the requirements for systematically identifying and refactoring code that violates Single Responsibility Principle (SRP) and Separation of Concerns (SOC) across the Prompt Builder codebase. The refactoring follows the established patterns documented in `/docs/architecture/typescript/`.

**Core Principle:** Line counts are heuristics, NOT splitting triggers. A file violates SRP if it has multiple distinct responsibilities—meaning different reasons to change for different stakeholders or concerns.

## Glossary

- **Responsibility**: A distinct concern that could change independently (state management, API calls, business logic, UI rendering, side effects, configuration)
- **Orchestrator**: A component/service that coordinates work but delegates actual implementation to specialized modules
- **Violation**: A file containing 2+ distinct responsibility categories

## Requirements

### Requirement 1: SRP Violation Detection

**User Story:** As a developer, I want to identify files that have multiple distinct responsibilities, so that I can prioritize refactoring efforts effectively.

#### Acceptance Criteria

1. WHEN analyzing a file, identify it as a violation if it contains 2+ of these responsibilities:
   - State management logic (reducers, complex useState orchestration)
   - API/data fetching (fetch calls, response handling)
   - Business logic/transformations (validation, formatting, calculations)
   - UI rendering (JSX, styling decisions)
   - Side effect orchestration (useEffect chains, subscriptions)
   - Configuration/constants (magic numbers, feature flags, static data)
2. WHEN a violation is identified, document:
   - The distinct responsibilities present with line ranges
   - Different "reasons to change" (stakeholders/triggers)
   - Recommended split with new file assignments
3. DO NOT flag files that do ONE thing well regardless of line count
4. DO NOT flag files where splitting would harm cohesion

### Requirement 2: Exclusion Criteria

**User Story:** As a developer, I want certain file types excluded from analysis, so that analysis focuses on meaningful refactoring candidates.

#### Acceptance Criteria

1. Skip files under 150 lines
2. Skip test files (`*.test.ts`, `*.test.tsx`, `*.spec.ts`)
3. Skip type definition files (`*.types.ts`, `types.ts`, `*.d.ts`)
4. Skip configuration files (`*.config.ts`, `*.config.js`)
5. Skip index/barrel files (`index.ts`)
6. Skip files already part of a refactored component structure (e.g., `ComponentName/hooks/useX.ts`)
7. DO NOT skip top-level hooks like `client/src/hooks/usePromptOptimizer.ts`—these should be analyzed

### Requirement 3: Analysis Scope and Priority Order

**User Story:** As a developer, I want the entire project analyzed for SRP violations in priority order, so that high-impact refactoring is addressed first across the whole codebase.

#### Acceptance Criteria

1. THE Analysis SHALL recursively scan all source directories:
   - `client/src/` - all frontend source code
   - `server/src/` - all backend source code
   - `shared/` - shared utilities and constants
2. WHEN prioritizing analysis results, rank by impact:
   - High: Files with 3+ distinct responsibilities
   - Medium: Files with 2 distinct responsibilities
3. DO NOT include files with fewer than 2 distinct responsibilities in the analysis results
4. Within each impact level, process files with more mixed responsibilities first

### Requirement 4: Refactoring Justification (REQUIRED)

**User Story:** As a developer, I want each refactoring decision justified before implementation, so that we avoid unnecessary splitting.

#### Acceptance Criteria

1. BEFORE refactoring any file, articulate:
   - What are the two or more different reasons this file would need to change?
   - Who are the different stakeholders that would trigger these changes?
   - How does splitting improve cohesion rather than just reducing file size?
2. IF distinct reasons to change cannot be articulated, DO NOT split the file
3. Document the justification for each refactoring decision
4. DO NOT proceed with splits that would create tightly coupled files that always change together

### Requirement 5: Frontend Component Refactoring

**User Story:** As a developer, I want frontend components refactored to follow the established VideoConceptBuilder pattern, so that code is maintainable.

#### Acceptance Criteria

1. WHEN a React component has multiple distinct responsibilities, split it into:
   - Main component file (orchestration and JSX only)
   - `types.ts` for interfaces and type definitions
   - `hooks/` directory for state management
   - `api/` directory for data fetching
   - `components/` directory for presentational sub-components
   - `utils/` directory for pure functions
2. Create barrel exports (`index.ts`) for clean imports
3. DO NOT create components that are only used in one place unless they represent a truly separate concern
4. DO NOT create extracted files under 50 lines unless genuinely reused by multiple consumers—if the extracted code is trivial, keep it inline

### Requirement 6: Backend Service Refactoring

**User Story:** As a developer, I want backend services refactored to follow the orchestrator pattern, so that services are focused.

#### Acceptance Criteria

1. WHEN a backend service has multiple reasons to change, split it into:
   - Orchestrator service (coordination only)
   - Specialized sub-services for each concern
   - `types/` directory for domain and request/response types
   - `contracts/` directory for interface definitions
2. DO NOT extract services that would only be used by one caller unless they represent a genuinely distinct concern
3. DO NOT create extracted files under 50 lines unless genuinely reused by multiple consumers—if the extracted code is trivial, keep it inline

### Requirement 7: Preserve Functionality

**User Story:** As a developer, I want refactoring to preserve existing functionality, so that no regressions are introduced.

#### Acceptance Criteria

1. WHEN refactoring, maintain the same public API (exports)
2. Ensure all existing tests pass after refactoring
3. WHEN splitting a file, verify that all imports from other files continue to work via barrel exports
4. WHEN splitting a file, create a deprecated re-export shim at the original path to maintain backward compatibility—mark with `@deprecated` JSDoc comment
5. IF a breaking change is unavoidable, document the migration path
