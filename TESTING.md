# Testing Documentation

## Overview

This document provides comprehensive information about the testing infrastructure and practices for the Prompt Builder application.

## Test Coverage Goals

- **Overall Coverage:** 85%+
- **Critical Paths:** 95%+
- **Unit Tests:** All business logic and utilities
- **Integration Tests:** API routes and service interactions
- **E2E Tests:** Critical user workflows

## Testing Stack

### Unit & Integration Testing
- **Framework:** Vitest
- **React Testing:** @testing-library/react
- **User Interactions:** @testing-library/user-event
- **HTTP Mocking:** nock
- **Assertions:** vitest/expect + @testing-library/jest-dom

### E2E Testing
- **Framework:** Playwright
- **Browsers:** Chromium, Firefox, WebKit
- **Mobile:** Chrome Mobile, Safari Mobile

## Directory Structure

```
prompt-builder/
├── e2e/                          # E2E tests
│   ├── fixtures/                 # Test data and fixtures
│   │   └── test-data.js         # Mock data and selectors
│   ├── helpers/                  # Test utilities
│   │   └── test-helpers.js      # Common helper functions
│   └── tests/                    # E2E test suites
│       └── prompt-builder.spec.js
├── src/
│   ├── clients/__tests__/        # API client tests
│   ├── components/__tests__/     # React component tests
│   ├── hooks/__tests__/          # React hooks tests
│   ├── infrastructure/__tests__/ # Infrastructure tests
│   ├── middleware/__tests__/     # Middleware tests
│   ├── routes/__tests__/         # Route handler tests
│   ├── services/__tests__/       # Service layer tests
│   └── utils/__tests__/          # Utility function tests
└── utils/__tests__/              # Shared utility tests
```

## Running Tests

### Unit & Integration Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run tests with UI
npm run test:ui

# Run specific test file
npm test src/clients/__tests__/ClaudeAPIClient.test.js

# Run tests matching pattern
npm test -- --grep "API"
```

### E2E Tests

```bash
# Run E2E tests
npm run test:e2e

# Run E2E tests in UI mode
npm run test:e2e:ui

# Run E2E tests in debug mode
npm run test:e2e:debug

# Run specific E2E test
npx playwright test e2e/tests/prompt-builder.spec.js

# Run on specific browser
npx playwright test --project=chromium
```

### All Tests

```bash
# Run both unit and E2E tests
npm run test:all
```

## Test Configuration

### Vitest Configuration

Located in `vitest.config.js`:
- **Environment:** jsdom (simulates browser environment)
- **Globals:** Enabled
- **Setup Files:** vitest.setup.js
- **Coverage Provider:** v8
- **Timeout:** 10 seconds

### Playwright Configuration

Located in `playwright.config.js`:
- **Test Directory:** ./e2e
- **Parallel Execution:** Enabled
- **Retries:** 2 (in CI), 0 (local)
- **Browsers:** Chrome, Firefox, Safari, Mobile browsers
- **Base URL:** http://localhost:3000
- **Screenshots:** On failure
- **Video:** Retained on failure
- **Trace:** On first retry

## Writing Tests

### Test Structure (AAA Pattern)

```javascript
describe('FeatureName', () => {
  // Arrange
  beforeEach(() => {
    // Setup
  });

  it('should do something', () => {
    // Arrange - Set up test data
    const input = 'test';

    // Act - Execute the function
    const result = functionUnderTest(input);

    // Assert - Verify the result
    expect(result).toBe('expected');
  });

  afterEach(() => {
    // Cleanup
  });
});
```

### Unit Test Example

```javascript
import { describe, it, expect, vi } from 'vitest';
import { functionToTest } from '../module';

describe('functionToTest', () => {
  it('should return correct result for valid input', () => {
    const result = functionToTest('input');
    expect(result).toBe('output');
  });

  it('should throw error for invalid input', () => {
    expect(() => functionToTest(null)).toThrow('Invalid input');
  });
});
```

### Component Test Example

```javascript
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MyComponent from '../MyComponent';

describe('MyComponent', () => {
  it('should render with default props', () => {
    render(<MyComponent />);
    expect(screen.getByText('Expected Text')).toBeInTheDocument();
  });

  it('should handle user interaction', async () => {
    const user = userEvent.setup();
    const handleClick = vi.fn();

    render(<MyComponent onClick={handleClick} />);

    await user.click(screen.getByRole('button'));

    expect(handleClick).toHaveBeenCalledTimes(1);
  });
});
```

### E2E Test Example

```javascript
import { test, expect } from '@playwright/test';

test('user can submit prompt', async ({ page }) => {
  await page.goto('/');

  await page.fill('textarea[name="prompt"]', 'Test prompt');
  await page.click('button[type="submit"]');

  await expect(page.locator('[data-testid="result"]')).toBeVisible();
});
```

## Mocking

### Mocking Modules

```javascript
vi.mock('../api-client', () => ({
  apiClient: {
    post: vi.fn().mockResolvedValue({ data: 'mock data' }),
  },
}));
```

### Mocking API Responses

```javascript
// Using nock
import nock from 'nock';

nock('https://api.example.com')
  .post('/endpoint')
  .reply(200, { result: 'success' });

// Playwright route mocking
await page.route('**/api/**', (route) => {
  route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ result: 'mocked' }),
  });
});
```

### Mocking Time

```javascript
import { vi } from 'vitest';

vi.useFakeTimers();
vi.setSystemTime(new Date('2024-01-01'));

// Run tests...

vi.useRealTimers();
```

## Best Practices

### General

1. **Test Behavior, Not Implementation**
   - Focus on what the code does, not how it does it
   - Test public APIs, not internal details

2. **Keep Tests Simple**
   - One assertion per test when possible
   - Clear test names describing expected behavior

3. **Use Descriptive Names**
   - Test names should describe the expected behavior
   - Format: `should [expected behavior] when [condition]`

4. **Arrange, Act, Assert**
   - Always follow the AAA pattern
   - Separate setup, execution, and verification

5. **Test Edge Cases**
   - Empty inputs
   - Null/undefined values
   - Very large inputs
   - Error conditions

### React Component Testing

1. **Query by Accessibility Attributes**
   ```javascript
   screen.getByRole('button', { name: 'Submit' })
   screen.getByLabelText('Email')
   screen.getByText('Welcome')
   ```

2. **Use User Event for Interactions**
   ```javascript
   const user = userEvent.setup();
   await user.click(button);
   await user.type(input, 'text');
   ```

3. **Wait for Async Updates**
   ```javascript
   await waitFor(() => {
     expect(screen.getByText('Loaded')).toBeInTheDocument();
   });
   ```

### E2E Testing

1. **Start with Critical Paths**
   - Test the most important user journeys first
   - Focus on business-critical functionality

2. **Use Page Object Pattern**
   - Encapsulate page interactions in reusable functions
   - Keep tests focused on behavior, not selectors

3. **Handle Flaky Tests**
   - Use proper waits (`waitFor`, `waitForSelector`)
   - Avoid hard-coded delays (`setTimeout`)
   - Use auto-waiting features

4. **Test in Isolation**
   - Each test should be independent
   - Clean up state between tests
   - Don't rely on test execution order

## Coverage Reports

### Viewing Coverage

```bash
# Generate coverage report
npm run test:coverage

# Open HTML report
open coverage/index.html

# View coverage in terminal
npm run test:coverage -- --reporter=text
```

### Coverage Thresholds

Current thresholds (vitest.config.js):
- Lines: 85%
- Functions: 80%
- Branches: 75%
- Statements: 85%

## Continuous Integration

### GitHub Actions Example

```yaml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run test:coverage
      - run: npx playwright install --with-deps
      - run: npm run test:e2e
```

## Debugging Tests

### Debugging Unit Tests

```bash
# Run in watch mode with UI
npm run test:ui

# Run specific test with verbose output
npm test -- --reporter=verbose src/path/to/test.js

# Use debugger
# Add 'debugger' statement in test, then:
node --inspect-brk node_modules/.bin/vitest run
```

### Debugging E2E Tests

```bash
# Debug mode (opens browser)
npm run test:e2e:debug

# UI mode
npm run test:e2e:ui

# Headed mode
npx playwright test --headed

# Slow motion
npx playwright test --slow-mo=1000
```

## Common Issues

### Issue: Tests timing out

**Solution:** Increase timeout in test or config
```javascript
it('slow test', { timeout: 30000 }, async () => {
  // test code
});
```

### Issue: Module not found errors

**Solution:** Check import paths are correct and modules are installed
```bash
npm install
```

### Issue: Flaky E2E tests

**Solution:** Use proper waits and avoid race conditions
```javascript
// Bad
await page.click('button');
await page.waitForTimeout(1000);

// Good
await page.click('button');
await page.waitForSelector('[data-testid="result"]');
```

### Issue: React component not rendering

**Solution:** Ensure proper test setup and mocks
```javascript
// Check vitest.setup.js for required configuration
// Mock any external dependencies
vi.mock('../api');
```

## Performance Testing

Load tests are located in `load-tests/` and use k6:

```bash
# Run basic load test
npm run test:load

# Run stress test
npm run test:load:stress

# Run quick test
npm run test:load:quick
```

## Additional Resources

- [Vitest Documentation](https://vitest.dev/)
- [Testing Library](https://testing-library.com/)
- [Playwright Documentation](https://playwright.dev/)
- [Testing Best Practices](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)

## Contributing

When adding new features:

1. Write tests first (TDD approach)
2. Ensure all tests pass
3. Maintain >85% coverage
4. Add E2E tests for user-facing features
5. Update this documentation if needed

## Contact

For questions about testing:
- Review existing tests for examples
- Check this documentation
- Consult the team's testing guidelines
