# Testing Quick Start Guide

## Installation

If you haven't already, install dependencies:

```bash
npm install
```

Install Playwright browsers (for E2E tests):

```bash
npx playwright install chromium
```

## Running Tests

### Unit & Integration Tests

```bash
# Run all tests once
npm run test:unit

# Run in watch mode (great for TDD)
npm run test:watch

# Run with coverage report
npm run test:coverage

# Run with UI (visual test runner)
npm run test:ui

# Run specific test file
npm test src/clients/__tests__/ClaudeAPIClient.test.js
```

### E2E Tests

```bash
# Run all E2E tests
npm run test:e2e

# Run in UI mode (interactive)
npm run test:e2e:ui

# Run in debug mode
npm run test:e2e:debug

# Run on specific browser
npx playwright test --project=chromium

# Run specific test file
npx playwright test e2e/tests/prompt-builder.spec.js
```

### All Tests

```bash
# Run both unit and E2E tests
npm run test:all
```

## View Coverage Report

After running tests with coverage:

```bash
npm run test:coverage

# Open HTML report in browser
open coverage/index.html
```

## Writing Your First Test

### Unit Test Example

Create a file `src/myModule/__tests__/myFunction.test.js`:

```javascript
import { describe, it, expect } from 'vitest';
import { myFunction } from '../myFunction';

describe('myFunction', () => {
  it('should return correct result', () => {
    const result = myFunction('input');
    expect(result).toBe('expected output');
  });

  it('should handle edge cases', () => {
    expect(() => myFunction(null)).toThrow();
  });
});
```

Run it:
```bash
npm test src/myModule/__tests__/myFunction.test.js
```

### Component Test Example

Create a file `src/components/__tests__/MyComponent.test.js`:

```javascript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MyComponent from '../MyComponent';

describe('MyComponent', () => {
  it('should render correctly', () => {
    render(<MyComponent title="Test" />);
    expect(screen.getByText('Test')).toBeInTheDocument();
  });

  it('should handle click', async () => {
    const user = userEvent.setup();
    const handleClick = vi.fn();

    render(<MyComponent onClick={handleClick} />);

    await user.click(screen.getByRole('button'));

    expect(handleClick).toHaveBeenCalled();
  });
});
```

### E2E Test Example

Create a file `e2e/tests/myFeature.spec.js`:

```javascript
import { test, expect } from '@playwright/test';

test('user can complete task', async ({ page }) => {
  await page.goto('/');

  await page.fill('input[name="field"]', 'value');
  await page.click('button[type="submit"]');

  await expect(page.locator('[data-testid="result"]')).toBeVisible();
});
```

## TDD Workflow

1. **Write failing test first**
   ```bash
   npm run test:watch
   ```

2. **Write minimal code to pass**
   - Edit your source file
   - Watch tests auto-run and pass

3. **Refactor with confidence**
   - Tests ensure nothing breaks
   - Coverage shows what's tested

## Common Commands

```bash
# Development workflow
npm run test:watch          # TDD mode

# Before commit
npm run test:coverage       # Ensure coverage
npm run lint                # Check code style

# Debug failing test
npm run test:ui             # Visual debugger

# E2E debugging
npm run test:e2e:ui         # Interactive E2E
```

## Troubleshooting

### Tests failing unexpectedly?
```bash
# Clear cache and reinstall
rm -rf node_modules
npm install
```

### E2E tests timing out?
```bash
# Increase timeout in playwright.config.js
# or in specific test:
test('slow test', { timeout: 60000 }, async ({ page }) => {
  // ...
});
```

### Can't find element in test?
```javascript
// Use better queries:
screen.getByRole('button', { name: 'Submit' })  // Better
screen.getByTestId('submit-button')             // OK
screen.getByText('Submit')                      // OK
document.querySelector('.submit')               // Avoid
```

### Need to debug a test?
```javascript
// Add to test:
await page.pause();  // E2E: Opens inspector

// Or use debugger:
debugger;  // In any test
```

## Next Steps

1. **Read full documentation:** `TESTING.md`
2. **Check examples:** Explore `src/clients/__tests__/ClaudeAPIClient.test.js`
3. **Run coverage:** `npm run test:coverage` and open `coverage/index.html`
4. **Practice TDD:** Use `npm run test:watch` while developing

## Resources

- [Vitest Docs](https://vitest.dev/)
- [Testing Library](https://testing-library.com/)
- [Playwright Docs](https://playwright.dev/)
- [TDD Guide](https://kentcdodds.com/blog/write-tests-not-too-many-mostly-integration)

## Quick Reference

| Task | Command |
|------|---------|
| Run tests | `npm test` |
| TDD mode | `npm run test:watch` |
| Coverage | `npm run test:coverage` |
| E2E tests | `npm run test:e2e` |
| Debug tests | `npm run test:ui` |
| All tests | `npm run test:all` |

Happy Testing! 🧪
