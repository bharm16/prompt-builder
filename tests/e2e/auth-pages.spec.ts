import { expect, test } from '@playwright/test';

test.describe('auth pages', () => {
  test('sign-in page renders email and password fields', async ({ page }) => {
    await page.goto('/signin');
    await expect(page.getByText('Welcome back')).toBeVisible();
    await expect(page.getByPlaceholder('you@company.com')).toBeVisible();
    await expect(page.getByPlaceholder('••••••••')).toBeVisible();
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /continue with google/i })).toBeVisible();
  });

  test('sign-up page renders name, email, password, and confirm fields', async ({ page }) => {
    await page.goto('/signup');
    await expect(page.getByText('Get started')).toBeVisible();
    await expect(page.getByPlaceholder('Your name')).toBeVisible();
    await expect(page.getByPlaceholder('you@company.com')).toBeVisible();
    await expect(page.getByPlaceholder('At least 6 characters')).toBeVisible();
    await expect(page.getByPlaceholder('Repeat your password')).toBeVisible();
    await expect(page.getByRole('button', { name: /create account/i })).toBeVisible();
  });

  test('sign-in shows error when submitting empty form', async ({ page }) => {
    await page.goto('/signin');
    await page.getByRole('button', { name: /sign in/i }).click();
    // The form validation shows "Enter your email and password."
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page.getByText('Enter your email and password')).toBeVisible();
  });

  test('sign-in page has forgot password link to /forgot-password', async ({ page }) => {
    await page.goto('/signin');
    const forgotLink = page.getByRole('link', { name: /forgot password/i });
    await expect(forgotLink).toBeVisible();
    await expect(forgotLink).toHaveAttribute('href', /\/forgot-password/);
  });
});
