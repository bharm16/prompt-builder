# Implementation Plan

- [x] 0. Prime Kiro with logging rules
  - [x] 0.1 Read LOGGING_PATTERNS.md Section 2 (Method Signatures)
    - Understand that ONLY error() takes Error as 2nd argument
    - All other methods (warn, info, debug) take only (message, meta)
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_
  
  - [x] 0.2 Verify understanding of correct patterns
    - error(): `log.error(message, error, meta)` ✅ CAN pass Error object
    - warn(): `log.warn(message, meta)` ❌ NO Error argument
    - info(): `log.info(message, meta)` ❌ NO Error argument  
    - debug(): `log.debug(message, meta)` ❌ NO Error argument
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_
  
  - [x] 0.3 Understand pattern for warn/info/debug with errors
    - Put error details in meta object: `{ error: e.message, errorName: e.name }`
    - Never pass Error object as 2nd argument to warn/info/debug
    - _Requirements: 4.2, 4.3, 4.4, 4.5, 4.6_

- [x] 1. Audit and fix incorrect logger method signatures
  - [x] 1.1 Search for incorrect warn() usage
    - Find all instances of `log.warn('...', error, ...)`
    - Find all instances of `logger.warn('...', error, ...)`
    - _Requirements: 4.2, 4.5_
  
  - [x] 1.2 Search for incorrect info() usage
    - Find all instances of `log.info('...', error, ...)`
    - Find all instances of `logger.info('...', error, ...)`
    - _Requirements: 4.3, 4.5_
  
  - [x] 1.3 Search for incorrect debug() usage
    - Find all instances of `log.debug('...', error, ...)`
    - Find all instances of `logger.debug('...', error, ...)`
    - _Requirements: 4.4, 4.5_
  
  - [x] 1.4 Fix all incorrect signatures
    - Refactor to put error details in meta object for warn/info/debug
    - Ensure error() calls properly pass Error object as 2nd parameter
    - Verify error context is preserved
    - _Requirements: 4.2, 4.3, 4.4, 4.5, 4.6, 4.7_
  
  - [x] 1.5 Verification: Check for remaining 3-arg warn/info/debug calls
    - Run grep to find any remaining incorrect signatures
    - Command: `grep -rPn "\.(warn|info|debug)\s*\([^)]+,[^)]+,[^)]+\)" server/src client/src --include="*.ts" --include="*.tsx"`
    - Should return 0 results (excluding comments)
    - _Requirements: 4.2, 4.3, 4.4, 4.5_

- [x] 2. Replace console statements in frontend components
  - [x] 2.1 Update PromptEnhancementEditor.tsx
    - Replace console.error with logger.error
    - Add proper error context and metadata
    - _Requirements: 7.1, 7.5, 4.1_
  
  - [x] 2.2 Update SharedPrompt.tsx
    - Replace console.error calls with logger.error
    - Include component context and error details
    - _Requirements: 7.1, 7.5, 4.1_
  
  - [x] 2.3 Update Icon.tsx and iconMapping.ts
    - Replace console.warn with logger.warn
    - Add proper metadata for missing icon warnings
    - _Requirements: 7.2, 7.6, 4.2_
  
  - [x] 2.4 Update VideoConceptBuilder.tsx
    - Replace console.error with logger.error
    - Add operation context and timing
    - _Requirements: 7.1, 7.5, 4.1_
  
  - [x] 2.5 Update VideoConceptBuilder hooks
    - Replace console.error in useCompatibilityScores.ts
    - Replace console.error in useRefinements.ts
    - Replace console.error in useConflictDetection.ts
    - Replace console.error in useElementSuggestions.ts
    - Replace console.error in useTechnicalParams.ts
    - Add proper error handling and context
    - _Requirements: 7.1, 7.5, 4.1, 3.4_
  
  - [x] 2.6 Update DebugButton.tsx
    - Replace console.error with logger.error
    - Add debug operation context
    - _Requirements: 7.1, 7.5, 4.1_
  
  - [x] 2.7 Update SuggestionsPanel hooks
    - Replace console.error in useCustomRequest.ts
    - Add proper error context and metadata
    - _Requirements: 7.1, 7.5, 4.1, 3.4_
  
  - [x] 2.8 Update ErrorBoundary.tsx
    - Replace console.error with logger.error
    - Ensure error boundaries log with full context
    - _Requirements: 7.1, 7.5, 4.1, 3.3_
  
  - [x] 2.9 Update usePromptDebugger.ts
    - Replace console.error with logger.error
    - Add operation timing and context
    - _Requirements: 7.1, 7.5, 4.1, 3.4_
  
  - [x] 2.10 Update usePromptHistory.ts
    - Replace console.error and console.warn with logger calls
    - Add proper error context for storage operations
    - _Requirements: 7.1, 7.2, 7.5, 7.6, 4.1, 4.2_

- [ ] 3. Add logging to services without proper coverage
  - [x] 3.1 Audit all services in server/src/services/
    - Identify services lacking operation start/completion logging
    - Identify services lacking error logging
    - Identify services lacking timing measurements
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 6.1, 6.2, 6.3, 10.1_
  
  - [x] 3.2 Add logging to identified services
    - Add child logger creation in constructor
    - Add debug logs for operation start with input summary
    - Add info logs for operation completion with duration
    - Add error logs for failures with full context
    - Add warn logs for handled errors with error details in meta
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 6.1, 6.2, 6.3, 6.4_

- [x] 4. Add logging to API routes without proper coverage
  - [x] 4.1 Audit all routes in server/src/routes/
    - Identify routes lacking request logging
    - Identify routes lacking response logging
    - Identify routes lacking error logging
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 10.2_
  
  - [-] 4.2 Add logging to identified routes
    - Add info log for request received with requestId, method, path
    - Add info log for response sent with requestId, status, duration
    - Add debug log for operation start
    - Add error log for failures with Error object and request context
    - Add warn log for handled errors with error details in meta
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.7, 6.1, 6.2, 6.3_

- [x] 5. Add logging to complex React components
  - [x] 5.1 Identify components needing logging
    - Components with API calls
    - Components with complex state management
    - Components with error boundaries
    - Components with significant user interactions
    - _Requirements: 3.1, 3.2, 3.3, 10.3_
  
  - [x] 5.2 Add useDebugLogger to identified components
    - Import and initialize useDebugLogger hook
    - Add logEffect for useEffect triggers
    - Add logAction for user interactions
    - Add logError for error handling
    - Add timing for async operations
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.7, 6.1, 6.2, 6.3_

- [x] 6. Add logging to custom React hooks
  - [x] 6.1 Audit hooks in client/src/hooks/
    - Identify hooks lacking logging
    - Identify hooks with async operations
    - _Requirements: 3.4, 10.3_
  
  - [x] 6.2 Add logging to identified hooks
    - Create child logger with hook name
    - Add debug logs for operation start
    - Add info logs for operation completion with timing
    - Add error logs for failures
    - Use startTimer/endTimer for async operations
    - _Requirements: 3.4, 3.6, 6.1, 6.2, 6.3, 6.4_

- [x] 7. Audit and fix sensitive data logging
  - [x] 7.1 Search for potential sensitive data in logs
    - Search for password, token, apiKey, api_key in logging calls
    - Search for authorization, cookie in header logging
    - Search for email, ssn, creditCard in user data logging
    - _Requirements: 5.1, 5.2, 5.3, 5.6_
  
  - [x] 7.2 Implement sanitization for identified cases
    - Use sanitizeHeaders for request/response headers
    - Use summarize for large payloads
    - Redact or exclude sensitive fields
    - Use derived values (e.g., email domain) instead of full PII
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7_

- [x] 8. Standardize metadata across all logs
  - [x] 8.1 Audit metadata consistency
    - Check all service logs include 'service' field via child logger
    - Check all operation logs include 'operation' field
    - Check all timed operations include 'duration' field
    - Check all request logs include 'requestId' field
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.7_
  
  - [x] 8.2 Add missing standard metadata
    - Add 'operation' field to all operation logs
    - Add 'duration' field to all timed operations
    - Add 'requestId' field to all request-scoped logs
    - Add 'userId' field where user context exists
    - Add domain-specific fields for business events
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7_

- [x] 9. Verify logging configuration
  - [ ] 9.1 Verify backend configuration
    - Check LOG_LEVEL environment variable support
    - Verify default log level is 'info' in production
    - Verify default log level is 'debug' in development
    - Verify JSON output in production
    - Verify pretty-printing in development
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_
  
  - [ ] 9.2 Verify frontend configuration
    - Check VITE_DEBUG_LOGGING environment variable support
    - Check VITE_LOG_LEVEL environment variable support
    - Verify log storage in development
    - Verify browser console access to logs
    - _Requirements: 8.1, 8.2, 8.6_

- [x] 10. Documentation and validation
  - [x] 10.1 Update documentation
    - Ensure LOGGING_PATTERNS.md is up to date
    - Add examples of new logging patterns if needed
    - Document any new utility functions
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7_
  
  - [x] 10.2 Manual validation
    - Run application with LOG_LEVEL=debug
    - Exercise major code paths
    - Verify log output format and content
    - Check for remaining console statements
    - Verify no sensitive data in logs
    - Test log export functionality (frontend)
    - Verify timing measurements are accurate
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7_

- [x] 11. (Optional) Extract common patterns to utilities
  - Only create if same sanitization/summarization logic appears 3+ times
  - Create utility functions for logging helpers
  - Write functions for sanitizeHeaders, summarize, and other common logging helpers
  - Place in `server/src/utils/logging/` and `client/src/utils/logging/`
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_
