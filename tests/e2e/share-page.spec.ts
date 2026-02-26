import { expect, test } from '@playwright/test';
import { jsonResponse } from './helpers/responses';

test.describe('share page', () => {
  test('displays shared prompt content when API returns data', async ({ page }) => {
    const testUuid = 'e2e-share-uuid-123';

    await page.route(`**/api/v2/sessions/by-prompt/${testUuid}`, async (route) => {
      await route.fulfill(
        jsonResponse({
          success: true,
          data: {
            id: 'session_shared',
            prompt: {
              uuid: testUuid,
              input: 'Original user prompt about a sunset.',
              output: 'A breathtaking golden sunset over a calm ocean, cinematic wide shot.',
              mode: 'enhanced',
              timestamp: '2026-02-01T12:00:00.000Z',
              score: 85,
            },
          },
        }),
      );
    });

    await page.goto(`/share/${testUuid}`);

    await expect(page.getByText('Shared Prompt')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Original Input')).toBeVisible();
    await expect(page.getByText('Optimized Output')).toBeVisible();
    await expect(page.getByText('Original user prompt about a sunset.')).toBeVisible();
  });

  test('displays error state when shared prompt is not found', async ({ page }) => {
    const badUuid = 'nonexistent-uuid';

    await page.route(`**/api/v2/sessions/by-prompt/${badUuid}`, async (route) => {
      await route.fulfill(jsonResponse({ success: true, data: null }));
    });

    await page.goto(`/share/${badUuid}`);

    // SharedPrompt component shows "Prompt Not Found" or error message
    await expect(
      page.getByText(/prompt not found|failed to load/i),
    ).toBeVisible({ timeout: 10000 });
  });
});
