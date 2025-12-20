# Implementation Plan: TypeScript Configuration Fixes

## Overview

This implementation plan systematically fixes 512 TypeScript errors by addressing configuration, type declarations, and code modifications in priority order. Tasks are organized to fix foundational issues first, enabling subsequent fixes to build on a stable base.

## Tasks

- [x] 1. Install missing type declarations
  - Install @types/supertest for test library types
  - Run `npm install -D @types/supertest`
  - _Requirements: 3.1, 3.2, 3.3_

- [x] 2. Create Express Request type augmentation
  - [x] 2.1 Create server/src/types/express.d.ts file
    - Extend Express.Request interface with `id: string` property
    - Extend Express.Request interface with `perfMonitor` property and methods
    - Export empty object to make it a module
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_
  - [x] 2.2 Update server/tsconfig.json to include type declaration
    - Add `server/src/types` to typeRoots
    - Ensure express.d.ts is in the include path
    - _Requirements: 2.7_

- [x] 3. Fix server path alias configuration
  - [x] 3.1 Update server/tsconfig.json paths
    - Ensure all path aliases resolve correctly without .js extensions
    - Configure paths for @infrastructure/*, @interfaces/*, @utils/*, @config/*, @llm/*, @services/*, @types/*, @middleware/*, @routes/*, @clients/*
    - Configure @shared/* and #shared/* paths
    - _Requirements: 1.1, 1.5, 1.6, 1.7_
  - [x] 3.2 Remove .js extensions from server imports
    - Search for imports with .js extension in server/src
    - Remove .js extensions from path alias imports
    - _Requirements: 1.5, 6.1, 6.2_
  - [x] 3.3 Refactor existing relative imports to use path aliases
    - Replace `../middleware/*` imports with `@middleware/*`
    - Replace `../routes/*` imports with `@routes/*`
    - Replace `../clients/*` imports with `@clients/*`
    - Replace other deep relative imports with appropriate aliases
    - _Requirements: 1.9, 8.1, 8.2_

- [x] 4. Fix client path alias configuration
  - [x] 4.1 Update client/tsconfig.json paths
    - Configure paths for @/*, @hooks/*, @components/*, @features/*, @utils/*, @config/*, @types/*
    - Configure @shared/* and #shared/* paths
    - _Requirements: 1.2, 1.6_
  - [x] 4.2 Verify client imports resolve correctly
    - Run tsc --noEmit on client code
    - Fix any remaining path resolution errors
    - _Requirements: 1.4_

- [x] 5. Update vitest configuration for path aliases
  - Update config/test/vitest.config.js alias configuration
  - Ensure aliases match tsconfig.json paths for both client and server
  - _Requirements: 1.10_

- [x] 6. Checkpoint - Verify path alias resolution
  - Run `npx tsc --noEmit` and verify TS2307 errors are resolved
  - Ensure all tests pass with `npm run test:unit`
  - Ask the user if questions arise

- [x] 7. Fix exactOptionalPropertyTypes errors in server code
  - [x] 7.1 Fix server/src/config/services.config.ts type errors
    - Update VideoService interface to match VideoPromptService
    - Fix ConstraintDetails type to allow null for phraseRole
    - Add `| undefined` to optional properties where needed
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 7.1_
  - [x] 7.2 Fix server/src/llm/span-labeling type errors
    - Fix ValidationPolicy type in RobustLlmClient.ts
    - Fix schema type in callModel function
    - Update UserPayloadParams type compatibility
    - _Requirements: 4.1, 4.4, 7.3_
  - [x] 7.3 Fix server/src/services type errors
    - Fix VideoConceptService storage type
    - Fix SystemPromptBuilder optional property types
    - _Requirements: 4.2, 4.5, 7.4_
  - [x] 7.4 Fix server/src/utils type errors
    - Fix PromptBuilder optional property types
    - Fix StructuredOutputEnforcer type compatibility
    - _Requirements: 4.1, 4.4_

- [x] 8. Fix strict null check errors
  - [x] 8.1 Fix CategoryGuidanceService null checks
    - Add null checks for latestEdit variable
    - Use optional chaining where appropriate
    - _Requirements: 5.1, 5.2_
  - [x] 8.2 Fix FallbackStrategyService null handling
    - Handle null phraseRole parameter
    - Add type guards where needed
    - _Requirements: 5.1, 5.3_
  - [x] 8.3 Fix SystemPromptBuilder undefined variables
    - Fix undefined 'result' variable references
    - Add proper type annotations
    - _Requirements: 5.1, 5.2_

- [x] 9. Fix remaining type errors
  - [x] 9.1 Fix TracingService type errors
    - Fix Resource type usage (value vs type)
    - Fix Attributes type compatibility
    - _Requirements: 7.1, 7.2_
  - [x] 9.2 Fix NlpSpanService type errors
    - Fix AhoCorasickMatch type conversion
    - Add proper type assertions where needed
    - _Requirements: 7.3_
  - [x] 9.3 Fix DescriptionEnrichedSchema type errors
    - Fix strict property type for Groq schema
    - _Requirements: 4.1, 7.4_
  - [x] 9.4 Fix common.ts type errors
    - Fix Record type with exactOptionalPropertyTypes
    - _Requirements: 4.1, 4.4_

- [x] 10. Refactor deep relative imports to path aliases
  - [x] 10.1 Fix test file imports
    - Update tests/unit/middleware-migration.test.ts imports
    - Update tests/unit/server-entry-routes-migration.test.ts imports
    - Update tests/unit/span-labeling-legacy-migration.test.ts imports
    - _Requirements: 8.1, 8.2_
  - [x] 10.2 Fix server file relative imports
    - Search for ../../ patterns in server/src
    - Replace with appropriate path aliases
    - _Requirements: 1.9, 8.1, 8.2_

- [x] 11. Checkpoint - Verify all type errors resolved
  - Run `npx tsc --noEmit` and verify zero errors
  - Run `npm run test:unit` and verify all tests pass
  - Ask the user if questions arise
  - **Status: INCOMPLETE** - 220 server TypeScript errors remain, span-labeling tests hang

- [ ] 12. Write property test for zero compilation errors
  - **Property 1: Zero TypeScript Compilation Errors**
  - **Validates: Requirements 1.3, 1.4, 2.3-2.6, 3.1, 3.4, 4.1-4.5, 5.1-5.3, 6.1-6.4, 7.1-7.4**

- [x] 13. Write property test for no deep relative imports
  - **Property 2: No Deep Relative Imports**
  - **Validates: Requirements 1.9, 8.1, 8.2, 8.4**

- [ ] 14. Write property test for configuration correctness
  - **Property 3: Configuration Correctness**
  - **Validates: Requirements 1.1, 1.2, 1.6-1.10, 2.7, 3.2, 3.3, 6.3**

- [-] 15. Final checkpoint - Complete verification
  - Run full test suite
  - Verify TypeScript compilation succeeds
  - Ensure all property tests pass
  - Ask the user if questions arise

## Notes

- All tasks are required for comprehensive TypeScript configuration fixes
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties
- Configuration fixes (tasks 1-5) must be completed before code fixes (tasks 7-10)
