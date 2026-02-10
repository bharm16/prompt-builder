import { expect, test } from '@playwright/test';

test('text input latency remains under baseline threshold', async ({ page }) => {
  await page.goto('/');

  const promptInput = page.getByLabel('Text Prompt Input');
  await expect(promptInput).toBeVisible();

  const start = Date.now();
  await promptInput.fill('Close-up of a pianist playing under warm stage lighting with shallow depth of field.');
  await expect(promptInput).toHaveValue(/pianist playing/i);
  const elapsedMs = Date.now() - start;

  expect(elapsedMs).toBeLessThan(2000);
  await expect(page.getByRole('button', { name: 'AI Enhance' })).toBeVisible();
});
