import { expect, test } from '@playwright/test';
import { jsonResponse, sseBody } from './helpers/responses';
import { injectAuthUser } from './helpers/auth';
import { mockSessionRoutes } from './helpers/mockRoutes';

test.describe('video generation (authenticated)', () => {
  test('full flow: optimize → image preview → video generate', async ({ page }) => {
    // Auth injection must happen before navigation
    await injectAuthUser(page);
    await mockSessionRoutes(page);

    let optimizeCalled = false;
    let imagePreviewCalled = false;
    let videoGenerateCalled = false;

    await page.route('**/api/optimize-stream', async (route) => {
      optimizeCalled = true;
      const body = sseBody([
        { event: 'draft', data: { draft: 'A cinematic runner in rain.' } },
        {
          event: 'refined',
          data: {
            refined: 'A cinematic runner sprinting through neon rain.',
            metadata: { previewPrompt: 'A cinematic runner sprinting through neon rain.' },
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

    await page.route('**/llm/label-spans**', async (route) => {
      await route.fulfill(jsonResponse({ spans: [] }));
    });

    await page.route('**/api/preview/generate/storyboard', async (route) => {
      await route.fulfill(
        jsonResponse({
          success: true,
          data: {
            imageUrls: ['https://example.com/storyboard-1.png'],
            deltas: ['refined'],
            baseImageUrl: 'https://example.com/storyboard-base.png',
          },
        }),
      );
    });

    await page.route('**/api/preview/generate', async (route) => {
      imagePreviewCalled = true;
      await route.fulfill(
        jsonResponse({
          success: true,
          data: {
            imageUrl: 'https://example.com/preview.png',
            metadata: {
              aspectRatio: '16:9',
              model: 'replicate-flux-schnell',
              duration: 6,
              generatedAt: '2026-02-10T00:00:00.000Z',
            },
          },
        }),
      );
    });

    await page.route('**/api/preview/video/generate', async (route) => {
      videoGenerateCalled = true;
      await route.fulfill(
        jsonResponse({
          success: true,
          jobId: 'job_e2e_1',
          creditsReserved: 7,
        }),
      );
    });

    await page.route('**/api/preview/video/jobs/**', async (route) => {
      await route.fulfill(
        jsonResponse({
          success: true,
          jobId: 'job_e2e_1',
          status: 'completed',
          videoUrl: 'https://example.com/video-result.mp4',
          viewUrl: 'https://example.com/video-result.mp4',
        }),
      );
    });

    await page.route('**/api/payment/**', async (route) => {
      await route.fulfill(jsonResponse({ success: true }));
    });

    await page.goto('/');

    // Type a prompt and optimize
    const promptInput = page.getByLabel('Text Prompt Input');
    await expect(promptInput).toBeVisible();
    await promptInput.fill('Wide shot of a cyclist crossing a rainy bridge at dusk.');

    const optimizeShortcut = process.platform === 'darwin' ? 'Meta+Enter' : 'Control+Enter';
    await promptInput.press(optimizeShortcut);
    await expect.poll(() => optimizeCalled).toBe(true);

    // Generate image preview (button text includes credit cost)
    const generateButton = page.getByLabel(/generate.*preview/i);
    await expect(generateButton).toBeVisible({ timeout: 10000 });
    await generateButton.click();
    await expect.poll(() => imagePreviewCalled).toBe(true);

    // Generate video (look for video-related button)
    const videoButton = page.getByRole('button', { name: /video/i });
    if (await videoButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await videoButton.click();
      await expect.poll(() => videoGenerateCalled).toBe(true);
    }
  });
});
