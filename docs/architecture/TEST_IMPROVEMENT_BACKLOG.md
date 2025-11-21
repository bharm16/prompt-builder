# Test Improvement Backlog

This document tracks tests that have minor violations of architecture guidelines but are acceptable for now or require source code refactoring before test improvements can be made.

---

## Tests with Minor Violations (Acceptable for Now)

### 1. PromptCanvas.caret.test.jsx

**Location:** `tests/unit/client/components/PromptCanvas.caret.test.jsx`

**Minor Violations:**
- Module-level mock for Toast component
- Highly specialized low-level test for caret/selection restoration

**Why Acceptable:**
- Tests critical DOM selection behavior that's hard to test otherwise
- Mock is necessary for test isolation
- Focused test scope makes the violation minimal impact

**Potential Improvements:**
- Consider extracting selection restoration logic to a utility function
- Test utility function in isolation without component mocking

**Priority:** Low

---

### 2. Toast.test.jsx

**Location:** `tests/unit/client/components/Toast.test.jsx`

**Minor Violations:**
- Testing mock infrastructure itself
- Non-standard test pattern

**Why Acceptable:**
- Toast is mocked globally in many other tests
- This test validates that the mock infrastructure works correctly
- Meta-test for test infrastructure

**Potential Improvements:**
- None needed - testing mocks is appropriate here

**Priority:** N/A (Working as intended)

---

### 3. errorHandler.test.js

**Location:** `server/src/middleware/__tests__/errorHandler.test.js`

**Minor Violations:**
- Module-level mock for logger

**Why Acceptable:**
- Middleware testing pattern often requires module mocks
- Logger is infrastructure concern, not business logic
- errorHandler doesn't support dependency injection currently

**Potential Improvements:**
- Refactor errorHandler to accept logger as parameter
- Would require updating all middleware registration code

**Priority:** Low

---

### 4. ModeSelector.test.jsx

**Location:** `tests/unit/client/components/ModeSelector.test.jsx`

**Minor Violations:**
- Uses `fireEvent` instead of `userEvent`
- Simple test, could be more comprehensive

**Why Acceptable:**
- Test is simple and works correctly
- fireEvent is sufficient for basic click/change events in this case

**Potential Improvements:**
- Replace `fireEvent` with `userEvent.setup()` and `user.click()` for consistency
- Add more interaction tests (keyboard navigation, accessibility)

**Priority:** Low

**Example Improvement:**
```javascript
// Instead of:
fireEvent.click(creativeTab);

// Use:
const user = userEvent.setup();
await user.click(creativeTab);
```

---

## Tests Requiring Source Code Refactoring

These tests cannot be fully improved without refactoring the source code to support dependency injection.

### 1. CacheService.test.js

**Location:** `tests/unit/server/services/CacheService.test.js`

**Issue:** Module-level mocks required because CacheService imports logger, metricsService, and SemanticCacheEnhancer directly.

**Source Code Change Needed:**

```javascript
// Current constructor:
constructor(config = {}) {
  // Direct imports used
}

// Should be:
constructor(config = {}, dependencies = {}) {
  this.logger = dependencies.logger || logger;
  this.metricsService = dependencies.metricsService || metricsService;
  this.semanticEnhancer = dependencies.semanticEnhancer || SemanticCacheEnhancer;
  // ...
}
```

**Test Improvement After Refactoring:**
- Remove all module-level mocks
- Inject mock objects via constructor in beforeEach
- Follow EXAMPLE_BACKEND_TEST.test.js pattern exactly

**Priority:** Medium

---

### 2. ClaudeAPIClient.test.js

**Location:** `server/src/clients/__tests__/ClaudeAPIClient.test.js`

**Issue:** Module-level mocks required because ClaudeAPIClient imports logger and metricsService directly.

**Source Code Change Needed:**

```javascript
// Current constructor:
constructor(apiKey, config = {}) {
  // Direct imports used
}

// Should be:
constructor(apiKey, config = {}, dependencies = {}) {
  this.logger = dependencies.logger || logger;
  this.metricsService = dependencies.metricsService || metricsService;
  // ...
}
```

**Test Improvement After Refactoring:**
- Remove module-level mocks for logger and metricsService
- Inject mock objects via constructor in beforeEach
- Keep fetch mocking (appropriate for HTTP client testing)

**Priority:** Medium

---

## Tests Already Following Best Practices

These tests serve as good examples:

✅ **server/src/services/prompt-optimization/strategies/__tests__/VideoStrategy.test.js**
- Constructor dependency injection
- No module-level mocks
- Comprehensive edge case coverage
- Clear AAA pattern

✅ **VideoConceptBuilder.test.jsx** (after rewrite)
- Service boundary mocking
- Uses userEvent for interactions
- Tests user behavior, not implementation
- No direct fetch mocking

✅ **usePromptOptimizer.test.js** (after rewrite)
- Service boundary mocking
- No direct fetch mocking
- Comprehensive state management tests

---

## Quick Reference: What to Fix vs. What to Accept

### ❌ Must Fix (Severe Violations)
- Direct `global.fetch` mocking (except in HTTP client tests)
- Testing implementation details instead of behavior
- No AAA pattern
- Missing test structure

### ⚠️ Should Improve (Moderate Violations)
- Using `fireEvent` instead of `userEvent`
- Insufficient error handling tests
- Missing edge case coverage

### ✅ Can Accept (Minor Violations)
- Module-level mocks when source code doesn't support DI (document why)
- Meta-tests for testing infrastructure
- Specialized low-level tests with necessary mocks

---

## Improvement Process

When improving a test from this backlog:

1. **Read the test** and understand what it's testing
2. **Check if source code refactoring is needed** (see sections above)
3. **Reference gold standards**:
   - Frontend: `docs/architecture/EXAMPLE_FRONTEND_TEST.test.jsx`
   - Backend: `docs/architecture/EXAMPLE_BACKEND_TEST.test.js`
4. **Follow patterns** from `CLAUDE_CODE_TEST_TEMPLATES.md`
5. **Run the test** before and after to ensure it still passes
6. **Update this document** when a test is improved

---

*Last Updated: Current Session*
*Companion to: CLAUDE_CODE_TEST_TEMPLATES.md*

