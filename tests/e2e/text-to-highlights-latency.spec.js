import { test, expect } from '@playwright/test';

/**
 * E2E Test: Text Rendering to Highlights Appearance Latency
 *
 * This test measures the ACTUAL user-perceived latency from when text
 * appears on the page to when highlights are rendered in the DOM.
 *
 * Target: ≤290ms (as claimed in performance report)
 *
 * Measurement includes:
 * - Smart debounce delay (200-500ms based on text length)
 * - Network request time (API or cache)
 * - Response processing
 * - DOM rendering of highlights
 *
 * Test Scenarios:
 * 1. Short text (<500 chars) - Expected: ~250ms (200ms debounce + 50ms processing)
 * 2. Medium text (500-2000 chars) - Expected: ~400ms (350ms debounce + 50ms processing)
 * 3. Cache hit - Expected: ~210ms (200ms debounce + 10ms cache)
 * 4. Multiple users (same text) - Tests request coalescing
 */

// Configuration
const APP_URL = process.env.APP_URL || 'http://localhost:5173';
const TEST_TIMEOUT = 30000; // 30 seconds

test.describe('Text to Highlights Latency Measurement', () => {
  test.beforeEach(async ({ page }) => {
    // Capture console logs for debugging
    page.on('console', msg => {
      if (msg.type() === 'error' || msg.text().includes('span') || msg.text().includes('API') || msg.text().includes('label')) {
        console.log(`[BROWSER ${msg.type()}]:`, msg.text());
      }
    });

    // Add API key header to backend API requests only
    await page.route('**/llm/**', async (route) => {
      console.log('Intercepting LLM request:', route.request().url());
      const headers = {
        ...route.request().headers(),
        'X-API-Key': 'dev-key-12345', // Dev fallback key from apiAuth middleware
      };
      await route.continue({ headers });
    });

    await page.route('**/api/**', async (route) => {
      console.log('Intercepting API request:', route.request().url());
      const headers = {
        ...route.request().headers(),
        'X-API-Key': 'dev-key-12345', // Dev fallback key from apiAuth middleware
      };
      await route.continue({ headers });
    });

    // Navigate to the app
    await page.goto(APP_URL);

    // Wait for the app to be fully loaded
    await page.waitForLoadState('networkidle');

    // Wait for the Video Prompt button to be visible
    await page.waitForSelector('button:has-text("Video Prompt")', { timeout: 10000 });

    // Click "Video Prompt" button to enter Video Prompt mode (where span labeling happens)
    await page.click('button:has-text("Video Prompt")');

    // Wait for the initial textarea input to appear
    await page.waitForSelector('textarea, [contenteditable="true"]', {
      state: 'visible',
      timeout: 10000,
    });
  });

  test('should measure latency for short text (<500 chars) - target ~250ms', async ({ page }) => {
    const shortText = 'A cinematic wide shot of a sunset over the ocean';

    // Step 1: Enter initial text and click Optimize
    const textarea = page.locator('textarea').first();
    await textarea.fill(shortText);
    await page.click('button:has-text("Optimize")');

    console.log('Waiting for optimization to complete...');

    // Wait for the contenteditable div (optimized prompt) to appear with content
    const contenteditable = page.locator('[contenteditable="true"][role="textbox"]').first();
    await contenteditable.waitFor({ state: 'visible', timeout: 30000 });

    // Wait for optimized content to load and for rate limits to reset
    await page.waitForTimeout(5000);

    console.log('Optimization complete. Now editing text to trigger span labeling...');

    // Step 2: Edit the optimized text to trigger span labeling with debouncing
    // This is the actual 290ms flow we want to measure

    // Set up request/response interception BEFORE editing
    const apiResponsePromise = page.waitForResponse(
      response => response.url().includes('/llm/label-spans') && response.request().method() === 'POST',
      { timeout: 10000 }
    );

    // Click at the end of the contenteditable
    await contenteditable.click();

    // Add some text to trigger span labeling
    const additionalText = ' with golden lighting';
    await page.keyboard.type(additionalText);

    // Start timing from when text is entered (debouncing starts)
    const startTime = Date.now();

    console.log('Text edit at:', 0, 'ms - debouncing begins');

    // Wait for the API response (indicates debounce + API call completed)
    try {
      const response = await apiResponsePromise;
      const responseTime = Date.now() - startTime;
      console.log('API response received at:', responseTime, 'ms');

      const responseData = await response.json();
      console.log('API response status:', response.status());
      console.log('API response spans count:', responseData.spans?.length || 0);

      if (response.status() !== 200) {
        console.error('API call failed:', await response.text());
      }
    } catch (e) {
      console.log('No API response detected within timeout:', e.message);
    }

    // Wait a moment for React to apply highlights
    await page.waitForTimeout(2000);

    // Check if highlights exist in the DOM
    const highlightCount = await page.locator('.value-word').count();
    console.log('Highlight count in DOM:', highlightCount);

    if (highlightCount === 0) {
      // Debug: Get the actual HTML content
      const htmlContent = await contenteditable.innerHTML();
      console.log('Contenteditable HTML (first 500 chars):', htmlContent.substring(0, 500));

      // Check console errors
      const errors = [];
      page.on('console', msg => {
        if (msg.type() === 'error') {
          errors.push(msg.text());
        }
      });

      throw new Error('No highlights found in DOM after API call succeeded');
    }

    // Wait for highlights to be visible
    await page.waitForSelector('.value-word', {
      timeout: 5000,
      state: 'visible',
    });

    const endTime = Date.now();
    const latency = endTime - startTime;

    console.log('\n========================================');
    console.log('SHORT TEXT LATENCY MEASUREMENT');
    console.log('========================================');
    console.log(`Text: "${shortText}"`);
    console.log(`Text Length: ${shortText.length} characters`);
    console.log(`Total Latency: ${latency}ms`);
    console.log(`Expected: ~250ms (200ms debounce + 50ms processing)`);
    console.log(`Target: ≤290ms`);
    console.log(`Result: ${latency <= 290 ? '✅ PASS' : '❌ FAIL'}`);
    console.log('========================================\n');

    // Validate against target
    expect(latency).toBeLessThanOrEqual(290);

    // Take screenshot for visual verification
    await page.screenshot({
      path: 'test-results/short-text-highlights.png',
      fullPage: true,
    });
  });

  test('should measure latency for medium text (500-2000 chars) - target ~400ms', async ({ page }) => {
    const mediumText = `
A cinematic wide shot capturing a breathtaking sunset over the vast ocean.
The camera slowly pans right, revealing a silhouette of a person standing alone
on the beach. Golden hour lighting bathes the entire scene in warm, amber tones.
Soft focus on foreground elements creates depth. Shot at 24fps with a duration
of 4-8 seconds. Color grading emphasizes orange and teal contrasts. Framing
follows the rule of thirds for balanced composition. Shallow depth of field
keeps the subject sharp while the background gently blurs.
    `.trim();

    const input = await page.locator('[data-testid="prompt-canvas"], textarea, [contenteditable="true"]').first();
    await input.clear();
    await input.fill(mediumText);

    const startTime = Date.now();

    await expect(input).toContainText(mediumText.slice(0, 50), { timeout: 1000 });

    await page.waitForSelector('.value-word', {
      timeout: 5000,
      state: 'visible',
    });

    const endTime = Date.now();
    const latency = endTime - startTime;

    console.log('\n========================================');
    console.log('MEDIUM TEXT LATENCY MEASUREMENT');
    console.log('========================================');
    console.log(`Text Length: ${mediumText.length} characters`);
    console.log(`Total Latency: ${latency}ms`);
    console.log(`Expected: ~400ms (350ms debounce + 50ms processing)`);
    console.log(`Target: ≤500ms`);
    console.log(`Result: ${latency <= 500 ? '✅ PASS' : '❌ FAIL'}`);
    console.log('========================================\n');

    expect(latency).toBeLessThanOrEqual(500);

    await page.screenshot({
      path: 'test-results/medium-text-highlights.png',
      fullPage: true,
    });
  });

  test('should measure cache hit latency (second request) - target ~210ms', async ({ page }) => {
    const testText = `Cache test ${Date.now()} - A cinematic shot with dramatic lighting`;

    const input = await page.locator('[data-testid="prompt-canvas"], textarea, [contenteditable="true"]').first();

    // First request - populate cache
    console.log('\n========================================');
    console.log('CACHE WARMING (First Request)');
    console.log('========================================');

    await input.clear();
    await input.fill(testText);

    let startTime = Date.now();
    await page.waitForSelector('.value-word', {
      timeout: 3000,
      state: 'visible',
    });
    const firstRequestLatency = Date.now() - startTime;

    console.log(`First Request Latency: ${firstRequestLatency}ms`);
    console.log('Cache should now be populated\n');

    // Clear highlights by changing text briefly
    await input.clear();
    await page.waitForTimeout(100);

    // Second request - cache hit
    console.log('========================================');
    console.log('CACHE HIT LATENCY MEASUREMENT');
    console.log('========================================');

    await input.fill(testText);

    startTime = Date.now();
    await page.waitForSelector('.value-word', {
      timeout: 2000,
      state: 'visible',
    });
    const cacheHitLatency = Date.now() - startTime;

    console.log(`Cache Hit Latency: ${cacheHitLatency}ms`);
    console.log(`First Request: ${firstRequestLatency}ms`);
    console.log(`Improvement: ${((1 - cacheHitLatency / firstRequestLatency) * 100).toFixed(1)}%`);
    console.log(`Expected: ~210ms (200ms debounce + 10ms cache)`);
    console.log(`Target: ≤290ms`);
    console.log(`Result: ${cacheHitLatency <= 290 ? '✅ PASS' : '❌ FAIL'}`);
    console.log('========================================\n');

    // Cache hit should be faster than first request
    expect(cacheHitLatency).toBeLessThan(firstRequestLatency);
    expect(cacheHitLatency).toBeLessThanOrEqual(290);
  });

  test('should measure progressive rendering latency - high confidence spans appear first', async ({ page }) => {
    const text = 'A cinematic wide shot of a sunset with dramatic lighting and shallow depth of field';

    const input = await page.locator('[data-testid="prompt-canvas"], textarea, [contenteditable="true"]').first();
    await input.clear();
    await input.fill(text);

    const startTime = Date.now();

    // Wait for first highlight to appear (high confidence)
    await page.waitForSelector('.value-word', {
      timeout: 2000,
      state: 'visible',
    });

    const firstHighlightTime = Date.now() - startTime;

    // Wait for all highlights (including low confidence)
    await page.waitForTimeout(150); // Wait for progressive rendering to complete

    const allHighlightsTime = Date.now() - startTime;

    console.log('\n========================================');
    console.log('PROGRESSIVE RENDERING MEASUREMENT');
    console.log('========================================');
    console.log(`First Highlight (High Confidence): ${firstHighlightTime}ms`);
    console.log(`All Highlights: ${allHighlightsTime}ms`);
    console.log(`Progressive Delay: ${allHighlightsTime - firstHighlightTime}ms`);
    console.log(`Expected First: ~210ms (200ms debounce + instant render)`);
    console.log(`Expected All: ~310ms (200ms debounce + 100ms progressive)`);
    console.log(`Result: ${firstHighlightTime <= 290 ? '✅ PASS' : '❌ FAIL'}`);
    console.log('========================================\n');

    // First highlight should appear quickly
    expect(firstHighlightTime).toBeLessThanOrEqual(290);

    // Progressive rendering should take <150ms total
    expect(allHighlightsTime - firstHighlightTime).toBeLessThanOrEqual(150);
  });

  test('should measure latency breakdown with detailed timing', async ({ page }) => {
    const text = 'A cinematic shot with dramatic lighting';

    // Intercept API calls to measure network time
    let apiCallTime = null;
    let apiResponseTime = null;

    page.on('request', request => {
      if (request.url().includes('/llm/label-spans')) {
        apiCallTime = Date.now();
        console.log('API request sent at:', apiCallTime);
      }
    });

    page.on('response', async response => {
      if (response.url().includes('/llm/label-spans')) {
        apiResponseTime = Date.now();
        const cacheStatus = response.headers()['x-cache'];
        const apiDuration = apiResponseTime - apiCallTime;

        console.log('API response received at:', apiResponseTime);
        console.log('API duration:', apiDuration, 'ms');
        console.log('Cache status:', cacheStatus || 'N/A');
      }
    });

    const input = await page.locator('[data-testid="prompt-canvas"], textarea, [contenteditable="true"]').first();
    await input.clear();

    // Start timing
    const textInputStart = Date.now();
    await input.fill(text);
    const textInputEnd = Date.now();

    // Wait for highlights
    await page.waitForSelector('.value-word', {
      timeout: 3000,
      state: 'visible',
    });
    const highlightsAppearEnd = Date.now();

    const totalLatency = highlightsAppearEnd - textInputStart;
    const textInputLatency = textInputEnd - textInputStart;
    const highlightLatency = highlightsAppearEnd - textInputEnd;

    console.log('\n========================================');
    console.log('DETAILED LATENCY BREAKDOWN');
    console.log('========================================');
    console.log(`1. Text Input: ${textInputLatency}ms`);
    console.log(`2. Debounce + API + Processing: ${highlightLatency}ms`);
    if (apiCallTime && apiResponseTime) {
      console.log(`   └─ API Call: ${apiResponseTime - apiCallTime}ms`);
    }
    console.log(`\nTotal Latency: ${totalLatency}ms`);
    console.log(`Target: ≤290ms`);
    console.log(`Result: ${totalLatency <= 290 ? '✅ PASS' : '❌ FAIL'}`);
    console.log('========================================\n');

    expect(totalLatency).toBeLessThanOrEqual(290);
  });

  test('should validate all performance claims from report', async ({ page }) => {
    const testCases = [
      { text: 'Wide shot', length: 9, expectedMax: 290 },
      { text: 'A cinematic wide shot of a sunset', length: 34, expectedMax: 290 },
      { text: 'Close-up with dramatic lighting and shallow depth of field effect', length: 66, expectedMax: 290 },
    ];

    const results = [];

    for (const testCase of testCases) {
      const input = await page.locator('[data-testid="prompt-canvas"], textarea, [contenteditable="true"]').first();
      await input.clear();

      const startTime = Date.now();
      await input.fill(testCase.text);

      await page.waitForSelector('.value-word', {
        timeout: 3000,
        state: 'visible',
      });

      const latency = Date.now() - startTime;

      results.push({
        text: testCase.text,
        length: testCase.length,
        latency,
        target: testCase.expectedMax,
        pass: latency <= testCase.expectedMax,
      });

      // Brief pause between tests
      await page.waitForTimeout(500);
    }

    console.log('\n========================================');
    console.log('PERFORMANCE VALIDATION SUMMARY');
    console.log('========================================');
    results.forEach((result, i) => {
      console.log(`\nTest ${i + 1}:`);
      console.log(`  Text: "${result.text.slice(0, 40)}${result.text.length > 40 ? '...' : ''}"`);
      console.log(`  Length: ${result.length} chars`);
      console.log(`  Latency: ${result.latency}ms`);
      console.log(`  Target: ≤${result.target}ms`);
      console.log(`  Result: ${result.pass ? '✅ PASS' : '❌ FAIL'}`);
    });

    const avgLatency = results.reduce((sum, r) => sum + r.latency, 0) / results.length;
    const passRate = (results.filter(r => r.pass).length / results.length) * 100;

    console.log('\n----------------------------------------');
    console.log(`Average Latency: ${avgLatency.toFixed(0)}ms`);
    console.log(`Pass Rate: ${passRate.toFixed(0)}%`);
    console.log(`Overall: ${passRate === 100 ? '✅ ALL TESTS PASSED' : '⚠️  SOME TESTS FAILED'}`);
    console.log('========================================\n');

    // All tests should pass
    expect(results.every(r => r.pass)).toBe(true);
    expect(avgLatency).toBeLessThanOrEqual(290);
  });
});

test.describe('Error Handling & Edge Cases', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(APP_URL);
    await page.waitForLoadState('networkidle');
  });

  test('should handle empty text gracefully', async ({ page }) => {
    const input = await page.locator('[data-testid="prompt-canvas"], textarea, [contenteditable="true"]').first();
    await input.clear();
    await input.fill('');

    // Should not crash or hang
    await page.waitForTimeout(1000);

    // No highlights should appear for empty text
    const highlights = await page.locator('.value-word').count();
    expect(highlights).toBe(0);
  });

  test('should handle very long text efficiently', async ({ page }) => {
    const longText = 'A cinematic shot with dramatic lighting. '.repeat(100); // ~4200 chars

    const input = await page.locator('[data-testid="prompt-canvas"], textarea, [contenteditable="true"]').first();
    await input.clear();

    const startTime = Date.now();
    await input.fill(longText);

    await page.waitForSelector('.value-word', {
      timeout: 5000,
      state: 'visible',
    });

    const latency = Date.now() - startTime;

    console.log('\n========================================');
    console.log('LONG TEXT LATENCY');
    console.log('========================================');
    console.log(`Text Length: ${longText.length} characters`);
    console.log(`Latency: ${latency}ms`);
    console.log(`Expected: ~550ms (500ms debounce + 50ms processing)`);
    console.log(`Target: ≤600ms`);
    console.log(`Result: ${latency <= 600 ? '✅ PASS' : '❌ FAIL'}`);
    console.log('========================================\n');

    expect(latency).toBeLessThanOrEqual(600);
  });

  test('should handle rapid text changes (debouncing)', async ({ page }) => {
    const input = await page.locator('[data-testid="prompt-canvas"], textarea, [contenteditable="true"]').first();
    await input.clear();

    // Type rapidly changing text
    await input.fill('A');
    await page.waitForTimeout(50);
    await input.fill('A cine');
    await page.waitForTimeout(50);
    await input.fill('A cinematic shot');

    // Only final text should trigger highlight
    const startTime = Date.now();

    await page.waitForSelector('.value-word', {
      timeout: 3000,
      state: 'visible',
    });

    const latency = Date.now() - startTime;

    console.log('Debouncing test latency:', latency, 'ms');

    // Should still be fast due to debouncing canceling previous requests
    expect(latency).toBeLessThanOrEqual(290);
  });
});

test.describe('Concurrent Users Simulation', () => {
  test('should handle multiple users requesting same text (request coalescing)', async ({ browser }) => {
    // Create 5 parallel contexts (simulating 5 users)
    const contexts = await Promise.all(
      Array.from({ length: 5 }, () => browser.newContext())
    );

    const sameText = `Coalescing test ${Date.now()} - A cinematic wide shot`;

    const latencies = await Promise.all(
      contexts.map(async (context, i) => {
        const page = await context.newPage();
        await page.goto(APP_URL);
        await page.waitForLoadState('networkidle');

        const input = await page.locator('[data-testid="prompt-canvas"], textarea, [contenteditable="true"]').first();
        await input.clear();

        const startTime = Date.now();
        await input.fill(sameText);

        await page.waitForSelector('.value-word', {
          timeout: 3000,
          state: 'visible',
        });

        const latency = Date.now() - startTime;
        await page.close();
        await context.close();

        return { user: i + 1, latency };
      })
    );

    console.log('\n========================================');
    console.log('CONCURRENT USERS (REQUEST COALESCING)');
    console.log('========================================');
    latencies.forEach(result => {
      console.log(`User ${result.user}: ${result.latency}ms`);
    });

    const avgLatency = latencies.reduce((sum, r) => sum + r.latency, 0) / latencies.length;
    const maxLatency = Math.max(...latencies.map(r => r.latency));

    console.log(`\nAverage: ${avgLatency.toFixed(0)}ms`);
    console.log(`Max: ${maxLatency}ms`);
    console.log(`Result: ${maxLatency <= 290 ? '✅ PASS' : '❌ FAIL'}`);
    console.log('========================================\n');

    // All users should experience good performance
    expect(avgLatency).toBeLessThanOrEqual(290);
    expect(maxLatency).toBeLessThanOrEqual(400); // Some tolerance for concurrent load
  });
});
