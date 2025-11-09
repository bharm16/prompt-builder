# Claude Code Test Writing Templates

Documentation for writing comprehensive tests using Claude Code. Maintains consistency with architecture patterns and testing best practices.

---

## Quick Start

```bash
# Basic usage - copy and modify for your needs:
claude-code "Write comprehensive tests for [FILE_PATH]

PATTERN TO FOLLOW:
- Backend: server/src/services/optimization/strategies/__tests__/VideoStrategy.test.js
- Frontend: Create new patterns (current tests need improvement)

TEST REQUIREMENTS:
1. Mock at service/module boundaries
2. Test behavior, not implementation
3. Follow AAA pattern
4. Cover edge cases

OUTPUT: [path]/__tests__/[name].test.js"
```

---

## Current Test Quality Assessment

### ✅ Good Examples (Use as Reference)
- **Backend:** `server/src/services/optimization/strategies/__tests__/VideoStrategy.test.js`
  - Proper mocking with vitest
  - Comprehensive edge cases
  - Clear AAA pattern
  - Tests public interface only

### ⚠️ Needs Improvement (Don't Reference)
- **Frontend:** `client/src/components/__tests__/VideoConceptBuilder.test.jsx`
  - Direct fetch mocking (anti-pattern)
  - Should use dependency injection
  - Needs better separation of concerns

---

## 🏆 Gold Standard Test Examples

### Frontend Component Test Pattern
**File:** `EXAMPLE_FRONTEND_TEST.test.jsx` (Add to your project)

This exemplary test demonstrates:
- Service boundary mocking (NOT fetch)
- Comprehensive user flow testing
- Proper AAA pattern
- Accessibility testing
- Responsive behavior testing
- Error handling
- Complete keyboard navigation

Key patterns from this test:
```javascript
// ✅ GOOD - Dependency injection
const mockAiWizardService = {
  getSuggestions: vi.fn(),
  generatePrompt: vi.fn()
};

// ✅ GOOD - Test user behavior
await user.click(screen.getByRole('button', { name: /next/i }));
expect(screen.getByRole('heading', { name: /atmosphere/i })).toBeInTheDocument();

// ✅ GOOD - Accessibility testing
const results = await axe(container);
expect(results).toHaveNoViolations();
```

### Backend Service Test Pattern
**File:** `EXAMPLE_BACKEND_TEST.test.js` (Add to your project)

This exemplary test demonstrates:
- Constructor dependency injection
- No module-level mocks
- Comprehensive error handling
- Cache behavior testing
- Performance testing
- Resource cleanup

Key patterns from this test:
```javascript
// ✅ GOOD - Constructor injection
service = new PromptOptimizationService({
  claudeClient: mockClaudeClient,
  groqClient: mockGroqClient,
  cacheService: mockCacheService
});

// ✅ GOOD - Test cache behavior
mockCacheService.get.mockResolvedValue(cachedResult);
const result = await service.optimize(prompt);
expect(mockClaudeClient.complete).not.toHaveBeenCalled();

// ✅ GOOD - Test error recovery
mockClaudeClient.complete
  .mockRejectedValueOnce(new Error('Network timeout'))
  .mockResolvedValueOnce({ content: [{ text: 'Success after retry' }] });
```

---

## Template 1: React Component Tests

```bash
Write comprehensive tests for [COMPONENT_PATH]

TEST REQUIREMENTS:
1. Use React Testing Library (@testing-library/react)
2. Use vitest for test runner
3. Follow AAA pattern (Arrange, Act, Assert)
4. Test user interactions, not implementation
5. Mock at service boundaries, not fetch
6. Test accessibility

COVERAGE TARGETS:
- User interactions (clicks, typing, keyboard)
- Props variations and edge cases
- Error states and loading states
- Conditional rendering
- Form validation
- Responsive behavior (if applicable)

TEST STRUCTURE:
describe('[ComponentName]', () => {
  let mockServices;
  
  beforeEach(() => {
    // Mock injected services, not fetch
    mockServices = {
      apiMethod: vi.fn()
    };
  });
  
  describe('Rendering', () => {
    it('should render with required props', () => {});
    it('should handle optional props', () => {});
  });
  
  describe('User Interactions', () => {
    it('should [behavior] when user [action]', async () => {
      // Arrange
      const user = userEvent.setup();
      
      // Act
      await user.click(element);
      
      // Assert
      expect(result).toBe(expected);
    });
  });
  
  describe('Edge Cases', () => {
    it('should handle empty data gracefully', () => {});
    it('should show error state when API fails', () => {});
  });
  
  describe('Accessibility', () => {
    it('should be keyboard navigable', () => {});
    it('should have proper ARIA labels', () => {});
  });
});

MOCKING STRATEGY:
- Mock service layer, not HTTP layer
- Use dependency injection where possible
- Create realistic mock data

DON'T TEST:
- CSS classes or styles
- Implementation details
- Third-party library behavior
- Console.log statements

OUTPUT:
Create test file at: [component-path]/__tests__/[ComponentName].test.jsx
```

### Example Usage:

```bash
claude-code "Write comprehensive tests for client/src/components/wizard/WizardVideoBuilder/WizardVideoBuilder.jsx

TEST REQUIREMENTS:
1. React Testing Library with vitest
2. Mock aiWizardService at service level
3. Test complete user flow through wizard
4. Test mobile/desktop responsive behavior
5. Test localStorage auto-save

COVERAGE TARGETS:
- Step navigation (next/back/jump)
- Form validation for required fields
- Auto-save every 2 seconds
- Restore from localStorage on mount
- Mobile single-field view
- Keyboard shortcuts (Enter, Esc)

MOCKING:
const mockAiWizardService = {
  getSuggestions: vi.fn(),
  generatePrompt: vi.fn(),
  getCompletionPercentage: vi.fn()
};

OUTPUT: client/src/components/wizard/WizardVideoBuilder/__tests__/WizardVideoBuilder.test.jsx"
```

---

## Template 2: Custom Hook Tests

```bash
Write comprehensive tests for [HOOK_PATH]

TEST REQUIREMENTS:
1. Use @testing-library/react renderHook
2. Use vitest
3. Test all returned values and functions
4. Test state transitions
5. Test side effects and cleanup

COVERAGE TARGETS:
- Initial state/return values
- State updates via actions
- Side effects (useEffect)
- Memoization behavior
- Error handling
- Cleanup on unmount

TEST STRUCTURE:
describe('[useHookName]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  
  describe('Initial State', () => {
    it('should initialize with default values', () => {
      const { result } = renderHook(() => useHookName());
      expect(result.current.value).toBe(defaultValue);
    });
  });
  
  describe('State Updates', () => {
    it('should update state when action called', async () => {
      const { result } = renderHook(() => useHookName());
      
      await act(async () => {
        result.current.updateValue('new');
      });
      
      expect(result.current.value).toBe('new');
    });
  });
  
  describe('Side Effects', () => {
    it('should trigger effect on dependency change', () => {});
    it('should cleanup on unmount', () => {});
  });
});

OUTPUT:
Create test file at: [hook-path]/__tests__/[hookName].test.js
```

### Example Usage:

```bash
claude-code "Write comprehensive tests for client/src/hooks/useWizardState

TEST REQUIREMENTS:
1. Test useReducer actions
2. Test localStorage persistence
3. Test state initialization
4. Test computed values

COVERAGE TARGETS:
- All reducer actions
- localStorage save/restore
- Validation state management
- Step navigation logic

OUTPUT: client/src/hooks/__tests__/useWizardState.test.js"
```

---

## Template 3: Backend Service Tests

```bash
Write comprehensive tests for [SERVICE_PATH]

TEST REQUIREMENTS:
1. Use vitest
2. Mock all constructor dependencies
3. Test public methods only
4. Test error handling comprehensively
5. Test async operations

COVERAGE TARGETS:
- Happy path for all public methods
- Error scenarios
- Edge cases (null, undefined, empty)
- Validation logic
- Cache hits/misses
- External API interactions

TEST STRUCTURE:
describe('[ServiceName]', () => {
  let service;
  let mockDependency1;
  let mockDependency2;
  
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Create mocks for injected dependencies
    mockDependency1 = {
      method: vi.fn()
    };
    mockDependency2 = {
      method: vi.fn()
    };
    
    // Inject mocks via constructor
    service = new ServiceName(mockDependency1, mockDependency2);
  });
  
  describe('constructor', () => {
    it('should initialize with dependencies', () => {});
  });
  
  describe('[methodName]', () => {
    it('should [expected behavior] when [condition]', async () => {
      // Arrange
      const input = { data: 'test' };
      mockDependency1.method.mockResolvedValue({ result: 'mocked' });
      
      // Act
      const result = await service.methodName(input);
      
      // Assert
      expect(result).toEqual({ expected: 'output' });
      expect(mockDependency1.method).toHaveBeenCalledWith(input);
    });
    
    it('should handle errors when [error condition]', async () => {
      mockDependency1.method.mockRejectedValue(new Error('API failed'));
      
      await expect(service.methodName(input))
        .rejects.toThrow('API failed');
    });
  });
  
  describe('Edge Cases', () => {
    it('should handle null input gracefully', () => {});
    it('should handle empty arrays', () => {});
    it('should handle very large inputs', () => {});
  });
});

REFERENCE PATTERN:
server/src/services/optimization/strategies/__tests__/VideoStrategy.test.js

OUTPUT:
Create test file at: [service-path]/__tests__/[ServiceName].test.js
```

### Example Usage:

```bash
claude-code "Write comprehensive tests for server/src/services/EnhancementService

PATTERN: Follow VideoStrategy.test.js structure

TEST REQUIREMENTS:
1. Mock all injected services (claudeClient, groqClient, etc)
2. Test getEnhancementSuggestions thoroughly
3. Test fallback logic for video prompts
4. Test cache behavior

MOCKS NEEDED:
- claudeClient.complete
- groqClient (with fallback to claudeClient)
- cacheService.get/set
- All injected services from constructor

OUTPUT: server/src/services/__tests__/EnhancementService.test.js"
```

---

## Template 4: Utility Function Tests

```bash
Write comprehensive unit tests for [UTIL_PATH]

TEST REQUIREMENTS:
1. Use vitest
2. Pure function testing (minimal mocking)
3. Test all exported functions
4. Extensive edge case coverage
5. Use test.each for similar cases

COVERAGE TARGETS:
- All exported functions
- Type coercion scenarios
- Null/undefined handling
- Empty inputs
- Boundary values
- Special characters
- Performance (if relevant)

TEST STRUCTURE:
describe('[utilName]', () => {
  describe('[functionName]', () => {
    it.each([
      ['input1', 'expected1', 'handles normal case'],
      ['', '', 'handles empty string'],
      [null, defaultValue, 'handles null'],
      [undefined, defaultValue, 'handles undefined'],
    ])('should return %s when given %s (%s)', (input, expected, description) => {
      expect(functionName(input)).toBe(expected);
    });
    
    describe('Edge Cases', () => {
      it('should handle special characters', () => {});
      it('should handle unicode', () => {});
      it('should handle very long inputs', () => {});
    });
    
    describe('Type Handling', () => {
      it('should coerce types appropriately', () => {});
      it('should throw on invalid types', () => {});
    });
  });
});

OUTPUT:
Create test file at: [util-path]/__tests__/[utilName].test.js
```

---

## Template 5: Integration Tests

```bash
Write integration tests for [FEATURE_NAME]

TEST REQUIREMENTS:
1. Test complete user flows
2. Minimal mocking (only external services)
3. Test across component boundaries
4. Test data persistence
5. Test error recovery

TEST SCENARIOS:
- Complete happy path workflow
- Validation across components
- Error handling and recovery
- Data persistence verification
- State management across features

TEST STRUCTURE:
describe('[Feature] Integration Tests', () => {
  beforeAll(async () => {
    // Setup test environment
    // Initialize test database if needed
  });
  
  afterAll(async () => {
    // Cleanup
  });
  
  describe('Complete User Flow', () => {
    it('should complete [workflow] end-to-end', async () => {
      // Step 1: Initial setup
      // Step 2: User actions
      // Step 3: Verify intermediate state
      // Step 4: Continue flow
      // Step 5: Verify final outcome
    });
  });
  
  describe('Error Recovery', () => {
    it('should recover gracefully from [error]', async () => {
      // Trigger error condition
      // Verify error handling
      // Perform recovery action
      // Verify system recovered
    });
  });
  
  describe('Cross-Component Communication', () => {
    it('should update related components when [action]', async () => {});
  });
});

OUTPUT:
Create test file at: tests/integration/[feature].integration.test.js
```

---

## Template 6: Test Coverage Improvement

```bash
Improve test coverage for [DIRECTORY_PATH]

CURRENT COVERAGE:
Run: npm test -- --coverage [path]
[Paste current coverage numbers]

TARGET COVERAGE:
- Statements: > 80%
- Branches: > 75%
- Functions: > 80%
- Lines: > 80%

ANALYSIS NEEDED:
1. Identify uncovered lines
2. Identify uncovered branches
3. Find untested error paths
4. Find untested edge cases

PRIORITY ORDER:
1. Business-critical logic
2. Error handling paths
3. Complex conditionals
4. Edge cases
5. Utility functions

SKIP TESTING:
- Console.log statements
- Simple getters/setters
- Dev-only debug code
- Third-party integrations

ADD TESTS FOR:
- [ ] Uncovered business logic
- [ ] Error scenarios
- [ ] Branch conditions
- [ ] Edge cases

OUTPUT:
Update existing test files or create new ones
Show before/after coverage metrics
```

---

## Test Patterns Quick Reference

### Testing Priority Order

1. **What users see** (rendered output)
2. **What users do** (interactions)
3. **What happens next** (side effects)
4. **What could go wrong** (error cases)
5. **Accessibility** (keyboard, screen readers)

### AAA Pattern

```javascript
it('should do something when condition', async () => {
  // Arrange - Set up test data and mocks
  const input = { value: 'test' };
  mockService.method.mockResolvedValue('result');
  
  // Act - Execute the behavior
  const result = await functionUnderTest(input);
  
  // Assert - Verify the outcome
  expect(result).toBe('expected');
  expect(mockService.method).toHaveBeenCalledWith(input);
});
```

### Mocking Best Practices

```javascript
// ✅ GOOD - Mock at service boundary
const mockUserService = {
  getUser: vi.fn(),
  updateUser: vi.fn()
};

// ❌ BAD - Mock fetch directly
global.fetch = vi.fn();

// ✅ GOOD - Dependency injection
const service = new Service(mockDependency);

// ❌ BAD - Mock internal implementation
service._privateMethod = vi.fn();
```

### File Naming Convention

- Components: `[ComponentName].test.jsx`
- Hooks: `[hookName].test.js`
- Services: `[ServiceName].test.js`
- Utils: `[utilName].test.js`
- Integration: `[feature].integration.test.js`
- E2E: `[flow].e2e.test.js`

---

## Validation Commands

```bash
# Run specific test file
npm test -- [test-file-path]

# Run with coverage
npm test -- --coverage [path]

# Run in watch mode
npm test -- --watch [path]

# Run only changed files
npm test -- -o

# Run tests matching pattern
npm test -- --grep "should handle errors"

# Debug specific test
node --inspect-brk ./node_modules/.bin/vitest --run [test-file]

# Generate coverage report
npm test -- --coverage --reporter=html

# Check coverage thresholds
npm test -- --coverage --coverageThreshold='{"global":{"statements":80,"branches":75,"functions":80,"lines":80}}'
```

---

## Common Testing Pitfalls to Avoid

### ❌ Don't Do This

```javascript
// Testing implementation details
it('should call useState', () => {
  const useStateSpy = vi.spyOn(React, 'useState');
  render(<Component />);
  expect(useStateSpy).toHaveBeenCalled();
});

// Testing styles
it('should have correct className', () => {
  const { container } = render(<Component />);
  expect(container.firstChild).toHaveClass('flex-col');
});

// Mocking everything
it('should work', () => {
  vi.mock('entire-module');
  // Now you're testing mocks, not code
});

// Not cleaning up
it('should do something', () => {
  // Missing cleanup in afterEach
});
```

### ✅ Do This Instead

```javascript
// Test behavior
it('should show error message when validation fails', async () => {
  const user = userEvent.setup();
  render(<Form />);
  
  await user.click(screen.getByRole('button', { name: /submit/i }));
  
  expect(screen.getByText(/required field/i)).toBeInTheDocument();
});

// Test user perspective
it('should navigate to next step when form is complete', async () => {
  // Test what user experiences, not how it works
});

// Mock boundaries only
const mockAPI = { fetchUser: vi.fn() };
// Test with realistic mock behavior

// Always cleanup
afterEach(() => {
  vi.clearAllMocks();
  cleanup();
});
```

---

## Writing Tests with Claude Code - Complete Example

```bash
claude-code "Write comprehensive tests for the WizardVideoBuilder component

COMPONENT: client/src/components/wizard/WizardVideoBuilder/WizardVideoBuilder.jsx

ARCHITECTURE CONTEXT:
- Main orchestrator component (190 lines)
- Uses hooks for state management
- Has mobile/desktop responsive views
- Auto-saves to localStorage

TEST REQUIREMENTS:
1. Use React Testing Library with vitest
2. Follow AAA pattern strictly
3. Mock service layer, not fetch
4. Test user workflows
5. Test responsive behavior

COVERAGE TARGETS:
Critical User Flows:
- Complete wizard from start to finish
- Navigate between steps (next/back/skip)
- Form validation and error display
- Auto-save triggers every 2 seconds
- Restore from localStorage on mount

Responsive Behavior:
- Mobile view (< 768px) - single field
- Tablet view (768-1023px) - simplified
- Desktop view (>= 1024px) - full steps

Edge Cases:
- Empty required fields
- Network errors during save
- LocalStorage quota exceeded
- Browser back/forward navigation

MOCKING STRATEGY:
const mockAiWizardService = {
  getSuggestions: vi.fn().mockResolvedValue([]),
  generatePrompt: vi.fn().mockResolvedValue('Generated prompt'),
  getCompletionPercentage: vi.fn().mockReturnValue(75)
};

const mockLocalStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn()
};

Object.defineProperty(window, 'localStorage', { value: mockLocalStorage });

REFERENCE PATTERNS:
- Backend: server/src/services/optimization/strategies/__tests__/VideoStrategy.test.js
- Frontend: (create new pattern - current tests need improvement)

OUTPUT: client/src/components/wizard/WizardVideoBuilder/__tests__/WizardVideoBuilder.test.jsx

After writing tests, validate with:
npm test -- WizardVideoBuilder.test.jsx --coverage"
```

---

## Test Documentation Comments

Add these comments to your test files for clarity:

```javascript
/**
 * @test {ComponentName}
 * @description Comprehensive test suite for ComponentName
 * 
 * Test Coverage:
 * - User interactions and workflows
 * - Props variations and edge cases
 * - Error handling and recovery
 * - Accessibility requirements
 * 
 * Mocking Strategy:
 * - Services mocked at injection points
 * - External APIs mocked at service boundary
 * - LocalStorage mocked for persistence tests
 */
```

---

## Next Steps

1. **Assess current coverage**: Run `npm test -- --coverage`
2. **Identify gaps**: Focus on business-critical paths
3. **Start with integration tests**: They provide most confidence
4. **Add unit tests**: For complex logic and edge cases
5. **Monitor coverage trends**: Set up CI to track coverage

---

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/)
- [Testing Best Practices](https://github.com/goldbergyoni/javascript-testing-best-practices)

---

## 📎 Attached Gold Standard Examples

This template includes two exemplary test files:

1. **EXAMPLE_FRONTEND_TEST.test.jsx** - Gold standard React component test
   - 650+ lines of comprehensive testing
   - All best practices demonstrated
   - Use as template for frontend tests

2. **EXAMPLE_BACKEND_TEST.test.js** - Gold standard backend service test  
   - 500+ lines of thorough testing
   - Proper dependency injection
   - Use as template for service tests

Add these to your project at:
- `docs/examples/tests/EXAMPLE_FRONTEND_TEST.test.jsx`
- `docs/examples/tests/EXAMPLE_BACKEND_TEST.test.js`

---

*Last Updated: Current Session*
*Follows patterns from: CLAUDE_CODE_TEMPLATES.md, REFACTORING_STANDARD.md*
*Gold standard examples: EXAMPLE_FRONTEND_TEST.test.jsx, EXAMPLE_BACKEND_TEST.test.js*