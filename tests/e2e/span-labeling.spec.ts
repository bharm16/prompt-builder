import { expect, test } from '@playwright/test';
import { jsonResponse, sseBody } from './helpers/responses';
import { mockSessionRoutes } from './helpers/mockRoutes';

test.describe('span labeling and suggestions', () => {
  test('span labels render after prompt optimization', async ({ page }) => {
    await mockSessionRoutes(page);

    await page.route('**/api/optimize-stream', async (route) => {
      const body = sseBody([
        { event: 'draft', data: { draft: 'A cinematic runner in rain.' } },
        {
          event: 'refined',
          data: {
            refined: 'A cinematic runner sprinting through neon rain.',
            metadata: {
              previewPrompt: 'A cinematic runner sprinting through neon rain.',
            },
          },
        },
        { event: 'done', data: { usedFallback: false } },
      ]);
      await route.fulfill({
        status: 200,
        headers: { 'content-type': 'text/event-stream' },
        body,
      });
    });

    await page.route('**/llm/label-spans', async (route) => {
      await route.fulfill(
        jsonResponse({
          spans: [
            { text: 'A cinematic', category: 'style', start: 0, end: 11 },
            { text: 'runner', category: 'subject', start: 12, end: 18 },
            { text: 'sprinting', category: 'action', start: 19, end: 28 },
            { text: 'through neon rain', category: 'environment', start: 29, end: 46 },
          ],
        }),
      );
    });

    await page.goto('/');
    const promptInput = page.getByLabel('Text Prompt Input');
    await expect(promptInput).toBeVisible();
    await promptInput.fill('Wide shot of a cyclist crossing a bridge at dusk.');

    const optimizeShortcut = process.platform === 'darwin' ? 'Meta+Enter' : 'Control+Enter';
    await promptInput.press(optimizeShortcut);

    // Wait for the optimized output to appear then check for labeled spans
    await expect(page.locator('[data-category]').first()).toBeVisible({ timeout: 10000 });

    const spanCategories = await page.locator('[data-category]').evaluateAll((els) =>
      els.map((el) => el.getAttribute('data-category')),
    );
    expect(spanCategories.length).toBeGreaterThan(0);
  });

  test('clicking a labeled span shows suggestions popover', async ({ page }) => {
    await mockSessionRoutes(page);

    await page.route('**/api/optimize-stream', async (route) => {
      const body = sseBody([
        { event: 'draft', data: { draft: 'A cinematic drone shot.' } },
        {
          event: 'refined',
          data: {
            refined: 'A cinematic drone shot over misty mountains.',
            metadata: { previewPrompt: 'A cinematic drone shot over misty mountains.' },
          },
        },
        { event: 'done', data: { usedFallback: false } },
      ]);
      await route.fulfill({
        status: 200,
        headers: { 'content-type': 'text/event-stream' },
        body,
      });
    });

    await page.route('**/llm/label-spans', async (route) => {
      await route.fulfill(
        jsonResponse({
          spans: [
            { text: 'A cinematic', category: 'style', start: 0, end: 11 },
            { text: 'drone shot', category: 'camera', start: 12, end: 22 },
            { text: 'over misty mountains', category: 'environment', start: 23, end: 43 },
          ],
        }),
      );
    });

    let suggestionsCalled = false;
    await page.route('**/api/suggestions', async (route) => {
      suggestionsCalled = true;
      await route.fulfill(
        jsonResponse({
          suggestions: [
            'sweeping aerial shot',
            'tracking crane shot',
            'overhead establishing shot',
          ],
        }),
      );
    });

    await page.goto('/');
    const promptInput = page.getByLabel('Text Prompt Input');
    await expect(promptInput).toBeVisible();
    await promptInput.fill('Drone shot of mountains.');

    const optimizeShortcut = process.platform === 'darwin' ? 'Meta+Enter' : 'Control+Enter';
    await promptInput.press(optimizeShortcut);

    // Wait for spans to render
    await expect(page.locator('[data-category]').first()).toBeVisible({ timeout: 10000 });

    // Click the first span to trigger suggestions
    await page.locator('[data-category]').first().click();

    // Verify suggestions API was called
    await expect.poll(() => suggestionsCalled).toBe(true);
  });
});
