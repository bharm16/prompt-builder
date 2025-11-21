# Manual Tests

This directory contains manual test scripts and HTML pages for debugging, verification, and ad-hoc testing. These are not part of the automated test suite and are meant to be run manually by developers.

## Purpose

Manual tests are useful for:
- Debugging specific features or issues
- Verifying integrations with external services (e.g., Sentry)
- Ad-hoc testing during development
- Testing scenarios that are difficult to automate
- Quick validation of new functionality

## Directory Structure

```
tests/manual/
├── prompt-optimization/    # Tests for prompt optimization features
│   ├── test-phase1-modes.js
│   └── test-two-stage.js
└── monitoring/             # Tests for monitoring and error tracking
    ├── test-sentry-backend.js
    ├── test-sentry.html
    └── test-react-error.html
```

## Prompt Optimization Tests

### test-phase1-modes.js

Tests the two-stage domain-specific content generation for different optimization modes.

**What it tests:**
- Research mode with domain-specific source types, methodologies, and quality criteria
- Socratic mode with prerequisites, misconceptions, and teaching milestones
- Default/Optimize mode with technical specs, anti-patterns, and success metrics

**How to run:**
```bash
node tests/manual/prompt-optimization/test-phase1-modes.js
```

**Requirements:**
- `OPENAI_API_KEY` environment variable must be set
- Optional: `OPENAI_MODEL` (defaults to 'gpt-4o-mini')

**Expected output:**
- Console output showing optimized prompts for each mode
- Validation that domain-specific content is present

### test-two-stage.js

Tests the two-stage domain-specific content generation flow with a single test prompt.

**What it tests:**
- Domain-specific context inference from user prompts
- Two-stage prompt chaining for reasoning mode
- Generation of technical deliverables and constraints

**How to run:**
```bash
node tests/manual/prompt-optimization/test-two-stage.js
```

**Requirements:**
- `OPENAI_API_KEY` environment variable must be set
- Optional: `OPENAI_MODEL` (defaults to 'gpt-4o-mini')

**Expected output:**
- Optimized output with domain-specific warnings, technical deliverables, and constraints

## Monitoring Tests

### test-sentry-backend.js

Node.js script to test Sentry error tracking for the Express backend.

**What it tests:**
- 404 errors for non-existent endpoints
- Authentication errors (missing API keys)
- Validation errors (empty input, invalid mode)
- Error details and request IDs in Sentry

**How to run:**
```bash
# Make sure the backend server is running on localhost:3001
npm run server

# In another terminal:
node tests/manual/monitoring/test-sentry-backend.js
```

**Expected output:**
- Console output showing test results
- Errors appearing in your Sentry dashboard within 5-10 seconds

### test-sentry.html

Interactive HTML page for testing Sentry error tracking for both frontend and backend.

**What it tests:**
- Frontend error capture (React errors)
- Async error handling
- Warning messages
- Performance tracking
- Backend 404, API, and server errors

**How to run:**
1. Make sure the backend server is running on localhost:3001
2. Open the file in a browser:
   ```bash
   open tests/manual/monitoring/test-sentry.html
   # or navigate to file:///path/to/tests/manual/monitoring/test-sentry.html
   ```
3. Click the buttons to trigger different types of errors
4. Check your Sentry dashboard at https://sentry.io

**Expected output:**
- Interactive UI with buttons to trigger errors
- Log output showing test results
- Errors appearing in Sentry dashboard

### test-react-error.html

Simplified HTML page specifically for testing React error capture with Sentry.

**What it tests:**
- Basic React error throwing
- Sentry error capture
- User context and breadcrumbs
- Error details in Sentry dashboard

**How to run:**
```bash
open tests/manual/monitoring/test-react-error.html
# or navigate to file:///path/to/tests/manual/monitoring/test-react-error.html
```

**Expected output:**
- Simple UI with a button to throw an error
- Success message after error is thrown
- Error appearing in Sentry dashboard within 5-10 seconds

## When to Use Manual Tests vs Automated Tests

### Use Manual Tests When:
- You need to test integration with external services (Sentry, OpenAI)
- You're debugging a specific issue and need quick feedback
- You want to verify behavior interactively
- The test requires human judgment or visual inspection
- You're experimenting with new features

### Use Automated Tests When:
- Testing core business logic
- Verifying API contracts
- Regression testing
- CI/CD pipeline validation
- Performance benchmarking

## Tips

- **Environment Variables**: Most tests require environment variables. Make sure to load them from `.env` or set them explicitly.
- **API Keys**: Manual tests that call external APIs will consume credits. Use development/test API keys when possible.
- **Backend Server**: Monitoring tests require the backend server to be running. Start it with `npm run server`.
- **Browser Console**: For HTML tests, open the browser developer console to see additional debug information.
- **Sentry Dashboard**: Errors may take 5-10 seconds to appear in Sentry. Be patient and refresh the dashboard.

## Adding New Manual Tests

When adding new manual tests:

1. Place them in the appropriate subdirectory (`prompt-optimization/`, `monitoring/`, or create a new category)
2. Use descriptive filenames with a `test-` prefix
3. Add documentation to this README explaining what the test does and how to run it
4. Include comments in the test file explaining the purpose and expected behavior
5. Consider whether the test should eventually be automated

## Related Documentation

- [Testing Quick Reference](../../docs/architecture/TESTING_QUICK_REFERENCE.md)
- [E2E Tests](../e2e/README.md)
- [Unit Tests](../unit/)

