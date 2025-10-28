import { test, expect } from '@playwright/test';

/**
 * E2E Test: Reasoning Mode with Context Integration
 *
 * Tests the complete user flow from entering a prompt, adding context,
 * and verifying that the context is properly integrated into the optimized output.
 */

test.describe('Reasoning Mode with Context', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Wait for app to be ready
    await page.waitForLoadState('networkidle');
  });

  test('should integrate context into reasoning mode optimization', async ({ page }) => {
    // Step 1: Select reasoning mode
    const reasoningMode = page.locator('button:has-text("Reasoning")');
    if (await reasoningMode.isVisible()) {
      await reasoningMode.click();
    }

    // Step 2: Enter prompt
    const promptText =
      'Analyze database indexing strategies for high-traffic applications';
    await page.fill('textarea[placeholder*="Describe"]', promptText);

    // Step 3: Open context form if available
    const addContextButton = page.locator('button:has-text("Add Context")');
    if (await addContextButton.isVisible()) {
      await addContextButton.click();

      // Step 4: Fill in context fields
      const specificAspectsField = page.locator(
        'input[name="specificAspects"], textarea[name="specificAspects"], [data-testid="specific-aspects"]'
      );
      if (await specificAspectsField.isVisible()) {
        await specificAspectsField.fill(
          'Focus on PostgreSQL B-tree vs GiST indexes, query performance optimization'
        );
      }

      const backgroundLevelField = page.locator(
        'select[name="backgroundLevel"], [data-testid="background-level"]'
      );
      if (await backgroundLevelField.isVisible()) {
        await backgroundLevelField.selectOption('expert');
      }

      const intendedUseField = page.locator(
        'input[name="intendedUse"], textarea[name="intendedUse"], [data-testid="intended-use"]'
      );
      if (await intendedUseField.isVisible()) {
        await intendedUseField.fill(
          'Production database optimization for e-commerce platform'
        );
      }
    }

    // Step 5: Submit optimization
    await page.click('button:has-text("Optimize")');

    // Step 6: Wait for optimization to complete
    const outputSelector =
      '[data-testid="optimized-output"], .optimized-output, textarea[readonly]';
    await page.waitForSelector(outputSelector, { timeout: 30000 });

    // Step 7: Get optimized output
    const output = await page.textContent(outputSelector);

    // Verify context integration
    expect(output).toBeTruthy();
    expect(output.length).toBeGreaterThan(200);

    // Check for specific aspects integration
    const lowerOutput = output.toLowerCase();
    expect(lowerOutput).toContain('postgresql');
    expect(lowerOutput).toMatch(/index|performance|optimiz/);

    // Verify proper reasoning structure
    expect(output).toMatch(/\*\*Goal\*\*|\*\*Objective\*\*/i);
    expect(output).toMatch(/\*\*Return Format\*\*|\*\*Deliverable/i);
  });

  test('should work with partial context (only specific aspects)', async ({ page }) => {
    const reasoningMode = page.locator('button:has-text("Reasoning")');
    if (await reasoningMode.isVisible()) {
      await reasoningMode.click();
    }

    await page.fill(
      'textarea[placeholder*="Describe"]',
      'Create a testing strategy for microservices'
    );

    // Open context if available
    const addContextButton = page.locator('button:has-text("Add Context")');
    if (await addContextButton.isVisible()) {
      await addContextButton.click();

      // Fill only specific aspects
      const specificAspectsField = page.locator(
        'input[name="specificAspects"], textarea[name="specificAspects"], [data-testid="specific-aspects"]'
      );
      if (await specificAspectsField.isVisible()) {
        await specificAspectsField.fill(
          'Emphasize integration testing and contract testing'
        );
      }
    }

    await page.click('button:has-text("Optimize")');
    const outputSelector =
      '[data-testid="optimized-output"], .optimized-output, textarea[readonly]';
    await page.waitForSelector(outputSelector, { timeout: 30000 });

    const output = await page.textContent(outputSelector);

    // Verify specific aspects are included
    const lowerOutput = output.toLowerCase();
    expect(lowerOutput).toMatch(/integration|contract/);
  });

  test('should handle context with special characters', async ({ page }) => {
    const reasoningMode = page.locator('button:has-text("Reasoning")');
    if (await reasoningMode.isVisible()) {
      await reasoningMode.click();
    }

    await page.fill('textarea[placeholder*="Describe"]', 'API design');

    const addContextButton = page.locator('button:has-text("Add Context")');
    if (await addContextButton.isVisible()) {
      await addContextButton.click();

      // Enter context with special characters
      const specificAspectsField = page.locator(
        'input[name="specificAspects"], textarea[name="specificAspects"], [data-testid="specific-aspects"]'
      );
      if (await specificAspectsField.isVisible()) {
        await specificAspectsField.fill(
          'Focus on REST (v2.0), GraphQL & "best practices"'
        );
      }

      const intendedUseField = page.locator(
        'input[name="intendedUse"], textarea[name="intendedUse"], [data-testid="intended-use"]'
      );
      if (await intendedUseField.isVisible()) {
        await intendedUseField.fill('Enterprise API <production> deployment');
      }
    }

    await page.click('button:has-text("Optimize")');
    const outputSelector =
      '[data-testid="optimized-output"], .optimized-output, textarea[readonly]';
    await page.waitForSelector(outputSelector, { timeout: 30000 });

    const output = await page.textContent(outputSelector);

    // Should handle special characters correctly
    expect(output).toBeTruthy();
    const lowerOutput = output.toLowerCase();
    expect(lowerOutput).toMatch(/rest|graphql/);
  });

  test('should display optimization output successfully', async ({ page }) => {
    const reasoningMode = page.locator('button:has-text("Reasoning")');
    if (await reasoningMode.isVisible()) {
      await reasoningMode.click();
    }

    await page.fill(
      'textarea[placeholder*="Describe"]',
      'Implement rate limiting for API endpoints'
    );

    await page.click('button:has-text("Optimize")');
    const outputSelector =
      '[data-testid="optimized-output"], .optimized-output, textarea[readonly]';
    await page.waitForSelector(outputSelector, { timeout: 30000 });

    const output = await page.textContent(outputSelector);

    // Verify output exists and has reasonable content
    expect(output).toBeTruthy();
    expect(output.length).toBeGreaterThan(100);
  });
});

test.describe('Reasoning Mode Context - Error Handling', () => {
  test('should handle network errors gracefully', async ({ page }) => {
    // Simulate offline scenario
    await page.route('**/api/optimize', (route) => {
      route.abort('failed');
    });

    await page.goto('/');

    const reasoningMode = page.locator('button:has-text("Reasoning")');
    if (await reasoningMode.isVisible()) {
      await reasoningMode.click();
    }

    await page.fill('textarea[placeholder*="Describe"]', 'test prompt');
    await page.click('button:has-text("Optimize")');

    // Should show error indication or remain interactive
    await page.waitForTimeout(2000);

    // Verify app doesn't crash
    const body = await page.textContent('body');
    expect(body).toBeTruthy();
  });

  test('should handle empty prompt gracefully', async ({ page }) => {
    await page.goto('/');

    const reasoningMode = page.locator('button:has-text("Reasoning")');
    if (await reasoningMode.isVisible()) {
      await reasoningMode.click();
    }

    // Try to optimize with empty prompt
    const optimizeButton = page.locator('button:has-text("Optimize")');

    // Button should be disabled or do nothing with empty prompt
    const isDisabled = await optimizeButton.isDisabled();
    if (!isDisabled) {
      await optimizeButton.click();
      // Should not proceed or show validation error
      await page.waitForTimeout(1000);
    }

    // Verify no crash
    const body = await page.textContent('body');
    expect(body).toBeTruthy();
  });
});
