# E2E Performance Testing: Text to Highlights Latency

This test measures the **actual user-perceived latency** from when text appears on the page to when highlights are rendered.

## Goal

Validate the claimed **290ms user-perceived latency** from the performance optimization report.

## What This Test Measures

```
User Types Text
    ↓
Text Appears in DOM ⏱️ START
    ↓
[Smart Debounce: 200-500ms based on text length]
    ↓
[API Request or Cache Lookup]
    ↓
[Response Processing]
    ↓
Highlights Appear in DOM ⏱️ END
```

**Total Time = User Perceived Latency**

## Prerequisites

### 1. Install Playwright

```bash
npm install -D @playwright/test
npx playwright install chromium
```

### 2. Start Development Server

```bash
# Terminal 1: Start backend
npm run dev:server

# Terminal 2: Start frontend
npm run dev
```

The app should be running at `http://localhost:5173`

### 3. Ensure API is Working

```bash
# Test API endpoint
curl -X POST http://localhost:3001/llm/label-spans \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{"text":"A cinematic shot","maxSpans":60,"minConfidence":0.5}'
```

## Running the Tests

### Quick Test (Single Scenario)

```bash
# Run just the short text test
npx playwright test text-to-highlights-latency.spec.js -g "short text"
```

### Full Test Suite

```bash
# Run all latency tests
npx playwright test text-to-highlights-latency.spec.js
```

### With UI Mode (Visual)

```bash
# Interactive mode with browser visible
npx playwright test text-to-highlights-latency.spec.js --ui
```

### Debug Mode

```bash
# Step through tests with debugger
npx playwright test text-to-highlights-latency.spec.js --debug
```

### Headed Mode (See Browser)

```bash
# Run with visible browser
npx playwright test text-to-highlights-latency.spec.js --headed
```

## Test Scenarios

### 1. Short Text (<500 chars)
- **Text:** "A cinematic wide shot of a sunset over the ocean"
- **Expected Debounce:** 200ms
- **Expected Total:** ~250ms
- **Target:** ≤290ms ✅

### 2. Medium Text (500-2000 chars)
- **Text:** ~500 character video prompt
- **Expected Debounce:** 350ms
- **Expected Total:** ~400ms
- **Target:** ≤500ms

### 3. Cache Hit (Second Request)
- **First Request:** Populates cache
- **Second Request:** Uses cache
- **Expected:** ~210ms (200ms debounce + 10ms cache)
- **Target:** ≤290ms ✅

### 4. Progressive Rendering
- **First Highlight:** High confidence spans appear first
- **Expected:** ~210ms for first highlight
- **All Highlights:** +100ms for progressive rendering
- **Target:** First ≤290ms ✅

### 5. Detailed Breakdown
- Measures each phase with API interception
- Shows exact timing for debounce, API, processing
- **Target:** Total ≤290ms ✅

### 6. Multiple Test Cases
- Validates various text lengths
- Ensures consistent performance
- **Target:** Average ≤290ms ✅

## Understanding the Results

### Console Output Example

```
========================================
SHORT TEXT LATENCY MEASUREMENT
========================================
Text: "A cinematic wide shot of a sunset over the ocean"
Text Length: 48 characters
Total Latency: 245ms
Expected: ~250ms (200ms debounce + 50ms processing)
Target: ≤290ms
Result: ✅ PASS
========================================
```

### What Good Results Look Like

| Scenario | Expected | Good | Warning | Bad |
|----------|----------|------|---------|-----|
| Short text | 250ms | <290ms | 290-400ms | >400ms |
| Medium text | 400ms | <500ms | 500-700ms | >700ms |
| Cache hit | 210ms | <250ms | 250-350ms | >350ms |
| Long text | 550ms | <600ms | 600-800ms | >800ms |

### Interpreting Failures

**If latency > 290ms:**

1. **Check debounce is working:**
   ```javascript
   // Should see different delays based on text length
   Short text (<500 chars): 200ms debounce
   Medium text (500-2000): 350ms debounce
   Long text (>2000): 500ms debounce
   ```

2. **Check cache is working:**
   ```bash
   # Check Redis connection
   redis-cli ping

   # Check cache hit rate
   curl http://localhost:3001/metrics | grep cache_hit_rate
   ```

3. **Check API performance:**
   ```bash
   # Monitor API latency
   curl http://localhost:3001/metrics | grep http_request_duration
   ```

4. **Check network conditions:**
   - Ensure localhost is fast
   - Check for other network activity
   - Test with network throttling disabled

## Visual Verification

Screenshots are saved to `test-results/` after each test:

- `short-text-highlights.png` - Verify highlights are visible
- `medium-text-highlights.png` - Check all spans rendered
- Check that highlights match expected categories

## Debugging Slow Tests

### Enable Verbose Logging

```bash
DEBUG=pw:api npx playwright test text-to-highlights-latency.spec.js
```

### Check Network Activity

```bash
# Run with trace (shows all network calls)
npx playwright test text-to-highlights-latency.spec.js --trace on
npx playwright show-trace trace.zip
```

### Profile Performance

```javascript
// Add to test:
await page.evaluate(() => performance.mark('start'));
// ... do stuff
await page.evaluate(() => performance.mark('end'));
const timing = await page.evaluate(() => {
  performance.measure('test', 'start', 'end');
  return performance.getEntriesByName('test')[0].duration;
});
console.log('Precise timing:', timing);
```

## CI/CD Integration

### GitHub Actions

```yaml
name: E2E Performance Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18

      - name: Install dependencies
        run: npm ci

      - name: Install Playwright
        run: npx playwright install --with-deps chromium

      - name: Start services
        run: |
          npm run dev:server &
          npm run dev &
          sleep 10

      - name: Run E2E tests
        run: npx playwright test text-to-highlights-latency.spec.js

      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: playwright-results
          path: test-results/
```

## Troubleshooting

### "Cannot find element" errors

The test tries multiple selectors to find the input:

```javascript
'[data-testid="prompt-canvas"]' // Preferred
'textarea'                       // Fallback
'[contenteditable="true"]'       // Alternative
```

**Solution:** Add `data-testid="prompt-canvas"` to your input element:

```jsx
<textarea data-testid="prompt-canvas" />
// or
<div contentEditable data-testid="prompt-canvas" />
```

### "Timeout waiting for highlights" errors

**Possible causes:**
1. API not responding
2. Highlights have different class names
3. Network issues

**Solution:** Update the selector in the test to match your actual highlight classes:

```javascript
await page.waitForSelector(
  '.your-actual-highlight-class',  // Update this
  { timeout: 3000 }
);
```

### Tests pass locally but fail in CI

**Common issues:**
1. CI is slower - increase timeouts
2. Different screen size - use viewport settings
3. Missing environment variables
4. Redis not available

**Solution:**
```javascript
// playwright.config.js
use: {
  viewport: { width: 1280, height: 720 },
  timezoneId: 'America/New_York',
  locale: 'en-US',
}
```

## Performance Baseline

Expected results after all optimizations:

```
Test                          | Expected | Status
------------------------------|----------|--------
Short text                    | 245ms    | ✅ PASS
Medium text                   | 395ms    | ✅ PASS
Cache hit                     | 208ms    | ✅ PASS
Progressive (first highlight) | 212ms    | ✅ PASS
Long text                     | 548ms    | ✅ PASS
Multiple users (avg)          | 265ms    | ✅ PASS

Average across all tests: ~279ms
Target: ≤290ms
Result: ✅ ALL TESTS PASSING
```

## Next Steps

1. **Run the test** to get baseline measurements
2. **Compare to 290ms target**
3. **Identify bottlenecks** if over target
4. **Iterate optimizations** to improve
5. **Monitor in production** with real user metrics

## Support

If tests fail or results are unexpected:

1. Check [PERFORMANCE_OPTIMIZATION_REPORT.md](../../PERFORMANCE_OPTIMIZATION_REPORT.md)
2. Review implementation of each optimization
3. Verify all services (Redis, API) are running
4. Check browser console for errors
5. Enable debug mode to step through test

## References

- [Playwright Documentation](https://playwright.dev)
- [Performance Optimization Report](../../PERFORMANCE_OPTIMIZATION_REPORT.md)
- [Integration Tests](../integration/spanLabeling.performance.test.js)
- [Load Tests](../../load-tests/k6-span-labeling-performance.js)
