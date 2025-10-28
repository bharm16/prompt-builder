import { test, expect } from '@playwright/test';

/**
 * E2E Test: Span Labeling During Optimized Prompt Editing
 *
 * This test validates the ACTUAL UI flow for span labeling based on
 * the investigation documented in SPAN_LABELING_INVESTIGATION.md
 *
 * Correct Flow:
 * 1. User enters Video Prompt mode
 * 2. User types initial text
 * 3. User clicks "Optimize" button (~8.5s wait)
 * 4. Optimized prompt displays with automatic highlights
 * 5. User edits optimized prompt → Highlights update (~290ms)
 *
 * Target: ≤290ms for step 5 (editing optimized prompts)
 */

const APP_URL = process.env.APP_URL || 'http://localhost:5173';

test.describe('Span Labeling: Editing Optimized Prompts', () => {
  test.beforeEach(async ({ page }) => {
    // Set up API authentication for backend requests
    await page.route('**/llm/**', async (route) => {
      await route.continue({
        headers: {
          ...route.request().headers(),
          'X-API-Key': 'dev-key-12345',
        },
      });
    });

    await page.route('**/api/**', async (route) => {
      await route.continue({
        headers: {
          ...route.request().headers(),
          'X-API-Key': 'dev-key-12345',
        },
      });
    });

    await page.goto(APP_URL);
    await page.waitForLoadState('networkidle');

    // Enter Video Prompt mode (where span labeling is enabled)
    await page.waitForSelector('button:has-text("Video Prompt")', { timeout: 10000 });
    await page.click('button:has-text("Video Prompt")');
    await page.waitForSelector('textarea', { state: 'visible', timeout: 10000 });
  });

  test('should show highlights when editing optimized prompts within 290ms', async ({ page }) => {
    // STEP 1: Create and optimize initial prompt
    const initialText = 'A cinematic wide shot of a sunset';
    const textarea = page.locator('textarea').first();
    await textarea.fill(initialText);

    // Click optimize and wait for completion
    await page.click('button:has-text("Optimize")');
    const contenteditable = page.locator('[contenteditable="true"][role="textbox"]').first();
    await contenteditable.waitFor({ state: 'visible', timeout: 30000 });

    // Wait for optimization to complete
    await page.waitForTimeout(3000);

    // STEP 2: Edit the optimized text to trigger span labeling
    // This is where the 290ms performance claim applies

    // Set up API interception to measure timing
    const apiResponsePromise = page.waitForResponse(
      response => response.url().includes('/llm/label-spans'),
      { timeout: 10000 }
    );

    // Click and edit the optimized text
    await contenteditable.click();
    await page.keyboard.press('End'); // Go to end of text

    const startTime = Date.now();
    await page.keyboard.type(' with golden lighting');

    // Wait for API response
    try {
      const response = await apiResponsePromise;
      const apiLatency = Date.now() - startTime;

      // Verify API call succeeded
      expect(response.status()).toBe(200);

      const responseData = await response.json();
      expect(responseData.spans).toBeDefined();
      expect(Array.isArray(responseData.spans)).toBe(true);

      // Wait for highlights to render in DOM
      await page.waitForSelector('.value-word', { timeout: 3000, state: 'visible' });

      const totalLatency = Date.now() - startTime;

      // Validate against 290ms target
      expect(totalLatency).toBeLessThanOrEqual(290);

      // Take screenshot for visual verification
      await page.screenshot({
        path: 'test-results/span-labeling-editing-flow.png',
        fullPage: true,
      });
    } catch (error) {
      throw new Error(`Span labeling failed: ${error.message}`);
    }
  });

  test('should show highlights automatically after optimization completes', async ({ page }) => {
    // Type initial prompt
    const initialText = 'Close-up shot with dramatic lighting';
    const textarea = page.locator('textarea').first();
    await textarea.fill(initialText);

    // Click optimize
    await page.click('button:has-text("Optimize")');

    // Wait for optimized prompt to display
    const contenteditable = page.locator('[contenteditable="true"][role="textbox"]').first();
    await contenteditable.waitFor({ state: 'visible', timeout: 30000 });

    // Wait additional time for span labeling to complete automatically
    await page.waitForTimeout(2000);

    // Highlights should appear automatically on the optimized text
    const highlightCount = await page.locator('.value-word').count();

    // Verify highlights are present
    expect(highlightCount).toBeGreaterThan(0);

    await page.screenshot({
      path: 'test-results/automatic-highlights-after-optimization.png',
      fullPage: true,
    });
  });

  test('should handle cache hits when editing with same text', async ({ page }) => {
    // Initial prompt and optimization
    const initialText = 'A sunset scene';
    const textarea = page.locator('textarea').first();
    await textarea.fill(initialText);

    await page.click('button:has-text("Optimize")');
    const contenteditable = page.locator('[contenteditable="true"][role="textbox"]').first();
    await contenteditable.waitFor({ state: 'visible', timeout: 30000 });

    await page.waitForTimeout(2000);

    // First edit - populate cache
    await contenteditable.click();
    await page.keyboard.press('End');
    await page.keyboard.type(' with colors');

    await page.waitForTimeout(1000); // Allow cache to populate

    // Second edit - should hit cache
    await page.keyboard.selectAll();
    await page.keyboard.press('Backspace');
    await page.keyboard.type('A sunset scene with colors'); // Same text

    const startTime = Date.now();

    await page.waitForSelector('.value-word', { timeout: 2000, state: 'visible' });

    const cacheHitLatency = Date.now() - startTime;

    // Cache hit should be very fast (mostly just debounce time)
    expect(cacheHitLatency).toBeLessThanOrEqual(250);
  });

  test('should update highlights when user continues typing', async ({ page }) => {
    // Setup: Optimize a prompt first
    const textarea = page.locator('textarea').first();
    await textarea.fill('Wide shot of ocean');
    await page.click('button:has-text("Optimize")');

    const contenteditable = page.locator('[contenteditable="true"][role="textbox"]').first();
    await contenteditable.waitFor({ state: 'visible', timeout: 30000 });
    await page.waitForTimeout(2000);

    // Edit multiple times - highlights should update each time
    await contenteditable.click();
    await page.keyboard.press('End');

    // First edit
    await page.keyboard.type(' at sunset');
    await page.waitForSelector('.value-word', { timeout: 3000 });
    const highlightCount1 = await page.locator('.value-word').count();

    // Second edit (add more text)
    await page.waitForTimeout(500); // Wait for debounce
    await page.keyboard.type(' with dramatic colors');
    await page.waitForTimeout(1000);

    const highlightCount2 = await page.locator('.value-word').count();

    // Both edits should produce highlights
    expect(highlightCount1).toBeGreaterThan(0);
    expect(highlightCount2).toBeGreaterThan(0);
  });
});

test.describe('Span Labeling: Error Handling', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(APP_URL);
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('button:has-text("Video Prompt")');
    await page.click('button:has-text("Video Prompt")');
  });

  test('should handle empty edits gracefully', async ({ page }) => {
    const textarea = page.locator('textarea').first();
    await textarea.fill('Test prompt');
    await page.click('button:has-text("Optimize")');

    const contenteditable = page.locator('[contenteditable="true"][role="textbox"]').first();
    await contenteditable.waitFor({ state: 'visible', timeout: 30000 });

    // Clear all text
    await contenteditable.click();
    await page.keyboard.selectAll();
    await page.keyboard.press('Backspace');

    await page.waitForTimeout(1000);

    // Should not crash, no highlights should appear for empty text
    const highlightCount = await page.locator('.value-word').count();
    expect(highlightCount).toBe(0);
  });

  test('should handle rapid edits with debouncing', async ({ page }) => {
    const textarea = page.locator('textarea').first();
    await textarea.fill('Quick edit test');
    await page.click('button:has-text("Optimize")');

    const contenteditable = page.locator('[contenteditable="true"][role="textbox"]').first();
    await contenteditable.waitFor({ state: 'visible', timeout: 30000 });
    await page.waitForTimeout(2000);

    await contenteditable.click();
    await page.keyboard.press('End');

    // Type rapidly - should debounce and only process final state
    await page.keyboard.type('a');
    await page.waitForTimeout(50);
    await page.keyboard.type('b');
    await page.waitForTimeout(50);
    await page.keyboard.type('c test');

    // Only final text should trigger one API call
    await page.waitForTimeout(1000);

    const highlightCount = await page.locator('.value-word').count();
    expect(highlightCount).toBeGreaterThan(0);
  });
});
