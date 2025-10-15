import { test, expect } from '@playwright/test';

test.describe('Suggestions apply flow and health endpoints', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('video: selecting text surfaces suggestions and apply updates editor', async ({ page }) => {
    // Switch to video mode if visible
    const videoTab = page.locator('button:has-text("Video Prompt"), [role="tab"]:has-text("Video")').first();
    if (await videoTab.isVisible().catch(() => false)) {
      await videoTab.click();
    }

    // Fill prompt
    const promptInput = page.locator('textarea[aria-label="Prompt input"], textarea[placeholder*="Describe" i]').first();
    await promptInput.fill('Make a cinematic scene with golden hour lighting.');

    // Mock optimize API to return deterministic content that includes the phrase to select
    await page.route('**/api/optimize', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ optimizedPrompt: 'This is an optimized video prompt with golden hour lighting for testing.' }),
      });
    });

    // Click Optimize
    const optimizeButton = page.locator('button[aria-label="Optimize prompt"], button:has-text("Optimize")').first();
    await optimizeButton.click();

    // Wait for output to render in contentEditable editor
    const editor = page.locator('[contenteditable="true"][aria-label="Optimized prompt"]').first();
    await expect(editor).toBeVisible();
    await expect(editor).toContainText('golden hour lighting');

    // Mock enhancement suggestions API to return a simple replacement
    await page.route('**/api/get-enhancement-suggestions', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          isPlaceholder: false,
          suggestions: [
            { text: 'sunset lighting' },
            { text: 'twilight ambience' },
          ],
        }),
      });
    });

    // Click on a highlighted value word to trigger suggestions (force in case container intercepts)
    const valueWord = page.locator('.value-word').first();
    await valueWord.waitFor({ state: 'visible' });
    await valueWord.click({ force: true });

    // Wait for suggestions panel and click the first suggestion
    const firstSuggestion = page.locator('button[role="listitem"]').first();
    await firstSuggestion.waitFor({ state: 'visible', timeout: 15000 });
    const suggestionText = (await firstSuggestion.innerText()).trim();
    await firstSuggestion.click();

    // Verify the editor content was updated
    await expect(editor).toContainText(suggestionText);
    await expect(editor).not.toContainText('golden hour lighting');
  });

  test('health endpoints return expected payloads and metrics content type', async ({ request }) => {
    // Backend health is on API server port 3001
    const health = await request.get('http://localhost:3001/health');
    expect(health.ok()).toBeTruthy();
    const healthJson = await health.json();
    expect(healthJson.status).toBe('healthy');

    // /health/ready may call external dependencies; still assert it returns JSON with status field
    const ready = await request.get('http://localhost:3001/health/ready');
    expect([200, 503]).toContain(ready.status());
    const readyJson = await ready.json();
    expect(readyJson).toHaveProperty('status');

    // /metrics requires auth header; token comes from .env in dev config
    const metrics = await request.get('http://localhost:3001/metrics', {
      headers: { Authorization: 'Bearer dev-metrics-token-12345' },
    });
    expect(metrics.ok()).toBeTruthy();
    const contentType = metrics.headers()['content-type'] || metrics.headers().get?.('content-type');
    expect(String(contentType)).toMatch(/text\/plain/i);
  });
});
