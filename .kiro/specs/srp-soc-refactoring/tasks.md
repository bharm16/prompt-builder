# Implementation Plan: SRP/SOC Refactoring

## Overview

This plan systematically analyzes the entire codebase for SRP/SOC violations and refactors files with multiple distinct responsibilities. Analysis covers all source directories recursively, with results prioritized by violation severity (High: 3+ responsibilities, Medium: 2 responsibilities).

## Tasks

- [x] 1. Full Codebase Analysis
  - [x] 1.1 Analyze `client/src/` recursively for violations
    - Scan all files >150 lines (excluding tests, types, configs, index files)
    - Identify responsibility categories in each candidate
    - Document violations with reasons to change and stakeholders
    - Classify as High (3+) or Medium (2) severity
    - _Requirements: 1.1, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 3.1, 3.2_
  - [x] 1.2 Analyze `server/src/` recursively for violations
    - Scan all files >150 lines (excluding tests, types, configs, index files)
    - Identify responsibility categories in each candidate
    - Document violations with reasons to change and stakeholders
    - Classify as High (3+) or Medium (2) severity
    - _Requirements: 1.1, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 3.1, 3.2_
  - [x] 1.3 Analyze `shared/` for violations
    - Scan all files >150 lines (excluding tests, types, configs, index files)
    - Identify responsibility categories in each candidate
    - Document violations with reasons to change and stakeholders
    - Classify as High (3+) or Medium (2) severity
    - _Requirements: 1.1, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 3.1, 3.2_
  - [x] 1.4 Checkpoint - Review analysis results
    - Compile prioritized list of all violations
    - Ensure no files with <2 responsibilities are included
    - _Requirements: 3.3, 3.4_

- [x] 2. High Severity Refactoring (3+ responsibilities)
  - [x] 2.1 Refactor high-severity frontend violations
    - For each violation: justify split, apply VideoConceptBuilder pattern
    - Ensure extracted files are 50+ lines or genuinely reused
    - Create barrel exports and deprecated shims
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 5.1, 5.2, 5.3, 5.4, 7.1, 7.4_
  - [x] 2.2 Refactor high-severity backend violations
    - For each violation: justify split, apply orchestrator pattern
    - Ensure extracted files are 50+ lines or genuinely reused
    - Create barrel exports and deprecated shims
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 6.1, 6.2, 6.3, 7.1, 7.4_
  - [x] 2.3 Checkpoint - Verify high-severity refactoring
    - Ensure all tests pass
    - Verify no broken imports
    - Verify deprecated shims are in place
    - _Requirements: 7.1, 7.2, 7.3, 7.4_

- [x] 3. Medium Severity Refactoring (2 responsibilities)
  - [x] 3.1 Refactor medium-severity frontend violations
    - For each violation: justify split, apply VideoConceptBuilder pattern
    - Skip if justification cannot be articulated
    - Ensure extracted files are 50+ lines or genuinely reused
    - Create barrel exports and deprecated shims
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 5.1, 5.2, 5.3, 5.4, 7.1, 7.4_
  - [x] 3.2 Refactor medium-severity backend violations
    - For each violation: justify split, apply orchestrator pattern
    - Skip if justification cannot be articulated
    - Ensure extracted files are 50+ lines or genuinely reused
    - Create barrel exports and deprecated shims
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 6.1, 6.2, 6.3, 7.1, 7.4_
  - [x] 3.3 Final Checkpoint
    - Ensure all tests pass
    - Verify no broken imports across codebase
    - Verify all deprecated shims are in place
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

## Notes

- Each refactoring requires explicit justification BEFORE implementation
- If justification cannot be articulated, skip that file
- Files doing ONE thing well should NOT be split regardless of size
- Do NOT create extracted files under 50 lines unless genuinely reused by multiple consumers
- Create deprecated re-export shims at original paths with @deprecated JSDoc
- Complete analysis of all directories before starting refactoring

## Completion Summary

**Task 1 (Analysis):** Completed. Found 1 confirmed violation (api.routes.ts). 4 initially flagged files were re-evaluated as NOT violations using the "reasons to change" test.

**Task 2 (High Severity):** Completed. Refactored api.routes.ts into domain-specific modules:
- `optimize.routes.ts` - Optimization endpoints
- `video.routes.ts` - Video concept endpoints
- `enhancement.routes.ts` - Enhancement and NLP endpoints
- `api.routes.ts` - Aggregator that mounts sub-routers

**Task 3 (Medium Severity):** Completed with no refactoring needed. All initially flagged files (NlpSpanService.ts, GroqLlamaAdapter.ts, OpenAICompatibleAdapter.ts, AIModelService.ts) were re-evaluated as single-responsibility files. See checkpoint-summary.md for detailed justifications.
