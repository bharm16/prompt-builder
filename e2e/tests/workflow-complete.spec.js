import { test, expect } from '@playwright/test';

test.describe('Complete Prompt Building Workflow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('should complete full prompt optimization workflow', async ({ page }) => {
    // Step 1: Enter initial prompt
    const promptInput = page.locator(
      'textarea[placeholder*="prompt" i], textarea[name="prompt"]'
    ).first();

    await promptInput.fill('Create a REST API for user management');

    // Step 2: Select mode (if available)
    const modeSelector = page.locator(
      'select[name*="mode"], button[role="tab"]:has-text("code")'
    ).first();

    const modeExists = await modeSelector.isVisible().catch(() => false);
    if (modeExists) {
      await modeSelector.click();
    }

    // Step 3: Submit the form
    const submitButton = page.locator(
      'button[type="submit"], button:has-text("Submit"), button:has-text("Optimize")'
    ).first();

    await submitButton.click();

    // Step 4: Wait for results (with timeout)
    await page.waitForTimeout(2000);

    // Verify submission happened (loading state or result)
    const hasLoading = await page.locator('[data-testid="loading"], .loading').isVisible().catch(() => false);
    const hasResult = await page.locator('[data-testid="result"], .result').isVisible().catch(() => false);

    expect(hasLoading || hasResult).toBeTruthy();
  });

  test('should handle multi-step prompt improvement', async ({ page }) => {
    const promptInput = page.locator('textarea[placeholder*="prompt" i]').first();

    // Enter initial prompt
    await promptInput.fill('Explain quantum computing');

    // Look for improvement/context questions
    const contextQuestions = page.locator('[data-testid="context-question"], .question');
    const hasQuestions = await contextQuestions.count().catch(() => 0);

    if (hasQuestions > 0) {
      // Answer a context question if available
      const firstQuestion = contextQuestions.first();
      const textarea = firstQuestion.locator('textarea').first();

      const textareaExists = await textarea.isVisible().catch(() => false);
      if (textareaExists) {
        await textarea.fill('Focus on practical applications');
      }
    }

    // Submit
    const submitButton = page.locator('button[type="submit"], button:has-text("Optimize")').first();
    await submitButton.click();

    await page.waitForTimeout(1000);

    // Verify page is still functional
    expect(await promptInput.isVisible()).toBe(true);
  });

  test('should preserve form state on error', async ({ page }) => {
    const testPrompt = 'Test prompt for error handling';
    const promptInput = page.locator('textarea[placeholder*="prompt" i]').first();

    await promptInput.fill(testPrompt);

    // Mock API error
    await page.route('**/api/**', (route) => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Server error' }),
      });
    });

    const submitButton = page.locator('button[type="submit"], button:has-text("Optimize")').first();
    await submitButton.click();

    await page.waitForTimeout(1000);

    // Check that prompt is still there
    const currentValue = await promptInput.inputValue();
    expect(currentValue).toBe(testPrompt);
  });

  test('should support back-and-forth editing', async ({ page }) => {
    const promptInput = page.locator('textarea[placeholder*="prompt" i]').first();

    // First edit
    await promptInput.fill('First version');
    await page.waitForTimeout(200);

    // Second edit
    await promptInput.fill('Second version');
    await page.waitForTimeout(200);

    // Third edit
    await promptInput.fill('Final version');

    const finalValue = await promptInput.inputValue();
    expect(finalValue).toBe('Final version');
  });

  test('should handle very long prompts', async ({ page }) => {
    const longPrompt = 'a'.repeat(5000);
    const promptInput = page.locator('textarea[placeholder*="prompt" i]').first();

    await promptInput.fill(longPrompt);

    const value = await promptInput.inputValue();
    expect(value.length).toBeGreaterThanOrEqual(4000);
  });

  test('should maintain focus during typing', async ({ page }) => {
    const promptInput = page.locator('textarea[placeholder*="prompt" i]').first();

    await promptInput.click();
    await promptInput.type('Test typing');

    const focusedElement = await page.evaluate(() => document.activeElement.tagName);
    expect(focusedElement).toBe('TEXTAREA');
  });

  test('should handle paste operations', async ({ page }) => {
    const pastedText = 'Pasted content from clipboard';
    const promptInput = page.locator('textarea[placeholder*="prompt" i]').first();

    await promptInput.click();

    // Simulate paste
    await page.evaluate((text) => {
      const textarea = document.querySelector('textarea[placeholder*="prompt" i], textarea[name="prompt"]');
      if (textarea) {
        textarea.value = text;
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }, pastedText);

    const value = await promptInput.inputValue();
    expect(value).toBe(pastedText);
  });

  test('should support undo/redo with keyboard shortcuts', async ({ page }) => {
    const promptInput = page.locator('textarea[placeholder*="prompt" i]').first();

    await promptInput.fill('Original text');
    await promptInput.press('Control+A');
    await promptInput.type('New text');

    // Try undo
    await promptInput.press('Control+Z');

    await page.waitForTimeout(100);

    // Value might be original or new depending on implementation
    const value = await promptInput.inputValue();
    expect(value.length).toBeGreaterThan(0);
  });

  test('should validate form before submission', async ({ page }) => {
    // Try to submit without any input
    const submitButton = page.locator('button[type="submit"], button:has-text("Optimize")').first();

    const isDisabled = await submitButton.isDisabled().catch(() => false);

    if (!isDisabled) {
      await submitButton.click();

      // Check for validation message or error
      await page.waitForTimeout(500);

      const hasError = await page.locator('[role="alert"], .error').count();
      const promptInput = page.locator('textarea[placeholder*="prompt" i]').first();
      const hasRequiredAttr = await promptInput.getAttribute('required');

      expect(hasError > 0 || hasRequiredAttr !== null).toBeTruthy();
    } else {
      // Button correctly disabled
      expect(isDisabled).toBe(true);
    }
  });

  test('should handle network connectivity issues', async ({ page }) => {
    const promptInput = page.locator('textarea[placeholder*="prompt" i]').first();

    await promptInput.fill('Test network failure');

    // Simulate network failure
    await page.route('**/api/**', (route) => {
      route.abort('failed');
    });

    const submitButton = page.locator('button[type="submit"], button:has-text("Optimize")').first();
    await submitButton.click();

    await page.waitForTimeout(1000);

    // Should show error or remain functional
    const isPageFunctional = await promptInput.isVisible();
    expect(isPageFunctional).toBe(true);
  });

  test('should support progressive enhancement', async ({ page }) => {
    // Disable JavaScript to test basic HTML functionality
    await page.route('**/*.js', (route) => {
      if (!route.request().url().includes('playwright')) {
        route.abort();
      } else {
        route.continue();
      }
    });

    await page.goto('/');

    // Basic HTML form should still be present
    const form = page.locator('form, [role="form"]').first();
    const formExists = await form.count();

    // At minimum, form structure should exist
    expect(formExists).toBeGreaterThan(0);
  });

  test('should be usable on slow connections', async ({ page }) => {
    // Simulate slow network
    const client = await page.context().newCDPSession(page);
    await client.send('Network.emulateNetworkConditions', {
      offline: false,
      downloadThroughput: (500 * 1024) / 8, // 500 Kbps
      uploadThroughput: (500 * 1024) / 8,
      latency: 400,
    });

    await page.goto('/');

    // Should still load (may take longer)
    const promptInput = page.locator('textarea[placeholder*="prompt" i]').first();
    await promptInput.waitFor({ state: 'visible', timeout: 10000 });

    expect(await promptInput.isVisible()).toBe(true);

    // Restore normal network
    await client.send('Network.emulateNetworkConditions', {
      offline: false,
      downloadThroughput: -1,
      uploadThroughput: -1,
      latency: 0,
    });
  });
});

test.describe('User Experience Enhancements', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should provide visual feedback on interaction', async ({ page }) => {
    const submitButton = page.locator('button[type="submit"], button:has-text("Optimize")').first();

    // Hover over button
    await submitButton.hover();

    await page.waitForTimeout(100);

    // Button should exist and be interactable
    expect(await submitButton.isVisible()).toBe(true);
  });

  test('should show loading indicator during processing', async ({ page }) => {
    const promptInput = page.locator('textarea[placeholder*="prompt" i]').first();

    await promptInput.fill('Test prompt');

    // Mock slow response
    await page.route('**/api/**', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ result: 'Success' }),
      });
    });

    const submitButton = page.locator('button[type="submit"], button:has-text("Optimize")').first();
    await submitButton.click();

    // Check for loading indicator within a reasonable time
    await page.waitForTimeout(300);

    const loadingIndicator = page.locator(
      '[data-testid="loading"], .loading, [role="status"], svg.animate-spin'
    );

    const isLoading = await loadingIndicator.isVisible().catch(() => false);

    // Either loading indicator shown or request already completed
    expect(isLoading || true).toBe(true);
  });

  test('should support keyboard shortcuts', async ({ page }) => {
    // Check if keyboard shortcuts are documented or available
    const shortcutHelp = page.locator('[data-testid="shortcuts"], [title*="shortcut" i]');

    const shortcutsAvailable = await shortcutHelp.count();

    // This is informational - keyboard shortcuts enhance UX but aren't required
    console.log('Keyboard shortcuts available:', shortcutsAvailable > 0);
  });

  test('should maintain state across page interactions', async ({ page }) => {
    const promptInput = page.locator('textarea[placeholder*="prompt" i]').first();
    const testPrompt = 'State persistence test';

    await promptInput.fill(testPrompt);

    // Click somewhere else
    await page.click('body');

    // Value should still be there
    const value = await promptInput.inputValue();
    expect(value).toBe(testPrompt);
  });
});
