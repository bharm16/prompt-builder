import { expect, test } from '@playwright/test';

test.describe('marketing pages render correctly', () => {
  test('home page displays hero content', async ({ page }) => {
    await page.goto('/home');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });

  test('pricing page displays pricing content', async ({ page }) => {
    await page.goto('/pricing');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });

  test('docs page displays documentation sections', async ({ page }) => {
    await page.goto('/docs');
    await expect(page.getByRole('heading', { name: /documentation/i, level: 1 })).toBeVisible();
    await expect(page.getByText('Getting Started')).toBeVisible();
  });

  test('privacy policy page renders legal variant', async ({ page }) => {
    await page.goto('/privacy-policy');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });

  test('terms of service page renders legal variant', async ({ page }) => {
    await page.goto('/terms-of-service');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });

  test('contact/support page renders', async ({ page }) => {
    await page.goto('/contact');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });
});
