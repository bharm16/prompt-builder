# Implementation Plan: AI Suggestions Fixes

## Overview

This plan implements fixes for race conditions, error handling, and UX issues in the AI suggestions workflow. Tasks are ordered by priority (P0 first) and dependency (foundation utilities before consumers).

## Tasks

- [x] 1. Create foundation utilities (P0)
  - [x] 1.1 Create `signalUtils.ts` with `CancellationError` class and `combineSignals` function
    - Implement `CancellationError` with `isCancellation` flag
    - Implement `combineSignals` to combine multiple AbortSignals
    - _Requirements: 1.1, 1.2_

  - [x] 1.2 Write unit tests for signalUtils
    - Test `CancellationError` has correct properties
    - Test `combineSignals` aborts when any input aborts
    - Test `combineSignals` handles pre-aborted signals
    - _Requirements: 1.1, 1.2_

  - [x] 1.3 Create `SuggestionRequestManager.ts` with debounce, cancellation, and deduplication
    - Implement `cancelCurrentRequest()` that clears debounce timer and aborts controller
    - Implement `scheduleRequest()` with trailing-edge debounce
    - Implement `isRequestInFlight()` using `currentDedupKey`
    - Implement `dispose()` for cleanup
    - Ensure `currentDedupKey` is set at start and cleared on completion/error
    - _Requirements: 1.1, 2.1, 2.3, 4.1, 4.2_

  - [x] 1.4 Write property tests for SuggestionRequestManager
    - **Property 1: Cancellation Prevents State Updates**
    - **Property 2: Deduplication Prevents Redundant Requests**
    - **Property 4: Debounce Coalesces Rapid Selections**
    - _Requirements: 1.1, 1.3, 2.1, 4.1, 4.2_

  - [x] 1.5 Create `SuggestionCache.ts` with TTL-based caching
    - Implement `generateKey()` static method
    - Implement `get()` that returns null for expired entries
    - Implement `set()` with maxEntries limit
    - Implement `prune()` for cleanup
    - Export `simpleHash()` utility function
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

  - [x] 1.6 Write property tests for SuggestionCache
    - **Property 5: Cache Key Uniqueness**
    - **Property 6: Cache Hit Returns Without API Call**
    - _Requirements: 6.2, 6.3, 6.5_

- [x] 2. Checkpoint - Foundation utilities complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 3. Update API layer (P0/P1)
  - [x] 3.1 Update `enhancementSuggestionsApi.ts` to support cancellation and timeout
    - Add `signal` parameter to `FetchEnhancementSuggestionsParams`
    - Implement 3-second timeout using AbortController
    - Use `combineSignals` to combine external signal with timeout
    - Distinguish timeout vs user cancellation in error handling
    - Extract context using `metadata.startIndex` with fallback
    - _Requirements: 1.4, 1.5, 3.4, 3.5_

  - [x] 3.2 Write unit tests for enhanced API
    - Test timeout triggers after 3 seconds
    - Test external signal cancellation works
    - Test timeout throws error (not silent)
    - Test user cancellation throws CancellationError
    - _Requirements: 3.4, 3.5_

  - [x] 3.3 Update `customSuggestionsApi.ts` to support cancellation and timeout
    - Add `signal` parameter
    - Implement 3-second timeout
    - _Requirements: 1.4, 3.6_

- [x] 4. Update hooks (P0/P1)
  - [x] 4.1 Update `useSuggestionFetch.ts` to use new utilities
    - Add `SuggestionRequestManager` ref
    - Add `SuggestionCache` ref
    - Implement deduplication check before scheduling
    - Show loading state after debounce fires (not before)
    - Wire up `onRetry` callback in error state
    - Store `lastPayloadRef` for retry functionality
    - Handle `CancellationError` silently
    - _Requirements: 1.1, 1.3, 2.1, 2.3, 3.1, 3.3, 4.1, 4.2, 6.3_

  - [x] 4.2 Write integration tests for useSuggestionFetch
    - Test full flow: selection → debounce → cache → API → state
    - Test cancellation doesn't update state
    - Test deduplication skips duplicate requests
    - Test error state includes onRetry
    - Test cache hit returns without API call
    - _Requirements: 1.1, 1.3, 2.1, 3.1, 6.3_

  - [x] 4.3 Update `useCustomRequest.ts` to use proper error handling
    - Add `setError` parameter for proper error state
    - Use `SuggestionRequestManager` for timeout (no debounce)
    - Remove error-as-suggestion anti-pattern
    - _Requirements: 3.1_

- [x] 5. Checkpoint - Core functionality complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Update UI components (P2/P3)
  - [x] 6.1 Update `ErrorState` component to support retry
    - Add `onRetry` prop
    - Render "Retry" button when `onRetry` is provided
    - _Requirements: 3.3_

  - [x] 6.2 Update `SuggestionsPanel` to pass `onRetry` to ErrorState
    - Extract `onRetry` from `suggestionsData`
    - Pass to `ErrorState` component
    - _Requirements: 3.2, 3.3_

  - [x] 6.3 Update `SuggestionsList` to use unique keys
    - Import `simpleHash` from SuggestionCache
    - Implement `generateSuggestionKey` function
    - Use backend ID if available, fallback to hash+index
    - _Requirements: 7.2, 7.3_

  - [x] 6.4 Write property test for key generation
    - **Property 7: Fallback Key Generation Determinism**
    - _Requirements: 7.3_

  - [x] 6.5 Update `useSuggestionsState` to sync with prop changes
    - Add effect to sync internal state when suggestions prop changes
    - Preserve active category if it still exists
    - Fall back to first category if active no longer exists
    - _Requirements: 8.1, 8.2, 8.3_

  - [x] 6.6 Write property test for state synchronization
    - **Property 8: State Synchronization Preserves Category**
    - _Requirements: 8.1, 8.2, 8.3_

- [x] 7. Update clipboard handling (P3)
  - [x] 7.1 Update clipboard operations in `SuggestionsList` to handle errors
    - Wrap clipboard.writeText in try/catch
    - Add visual feedback on success (optional toast)
    - Log warning on failure, don't crash
    - _Requirements: 9.1, 9.2_

  - [x] 7.2 Write test for clipboard error handling
    - **Property 9: Clipboard Errors Don't Crash**
    - _Requirements: 9.2_

- [x] 8. Update configuration (P2)
  - [x] 8.1 Update `api.config.ts` with correct timeout values
    - Change suggestions timeout from 15000 to 3000
    - Add debounce interval configuration (150ms)
    - _Requirements: 3.5, 4.3_

- [x] 9. Final checkpoint - All features complete
  - Ensure all tests pass, ask the user if questions arise.
  - Run full test suite including property tests
  - Verify no regressions in existing functionality

## Notes

- Tasks marked with `*` are optional test tasks that can be skipped for faster MVP
- Property tests use `fast-check` library for TypeScript
- Backend ID generation (Requirement 7.1) is tracked as a separate ticket
- Each property test should run minimum 100 iterations

## Testing Standards

All tests MUST follow the patterns in `docs/architecture/typescript/TEST_PATTERNS.md`:

### Type-Safe Mocking
- Use `MockedFunction<typeof fn>` for typed mock functions
- Create typed mock objects that implement interfaces fully
- Never use `as unknown as Type` - maintain type safety

### Test Structure
```typescript
import { vi, type MockedFunction } from 'vitest';

// Typed mocks
let mockFetch: MockedFunction<typeof fetch>;

beforeEach(() => {
  mockFetch = vi.fn();
  vi.clearAllMocks();
});
```

### Mock Return Values
```typescript
// ✅ GOOD - TypeScript validates mock return type
const validResponse: EnhancementSuggestionsResponse = {
  suggestions: ['suggestion 1'],
  isPlaceholder: false,
};
mockFetch.mockResolvedValue(validResponse);

// ❌ BAD - No type checking
mockFetch.mockResolvedValue({ wrong: 'shape' });
```

### Assertions
```typescript
// ✅ GOOD - Type-safe assertion
expect(result).toEqual<ExpectedType>({
  suggestions: expect.any(Array),
  isPlaceholder: false,
});
```

### Hook Tests
```typescript
import { renderHook, act } from '@testing-library/react';

const { result } = renderHook(() => useCustomHook());

await act(async () => {
  result.current.someAction();
});

expect(result.current.state).toEqual(expectedState);
```

### Zod Schema Tests
```typescript
import { ZodError } from 'zod';

it('should reject invalid response', () => {
  expect(() => Schema.parse(invalidData)).toThrow(ZodError);
});
```
