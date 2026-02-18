import { expect, test } from '@playwright/test';

test.describe('history page (unauthenticated, localStorage)', () => {
  test('renders history entries from localStorage', async ({ page }) => {
    // Seed localStorage with prompt history before navigating.
    // The LocalStoragePromptRepository stores entries under 'promptHistory'.
    await page.addInitScript(() => {
      const entries = [
        {
          id: 'local-1',
          uuid: 'uuid-local-1',
          input: 'A sunset over the ocean',
          output: 'A breathtaking golden sunset over a calm turquoise ocean, cinematic wide-angle shot.',
          timestamp: '2026-02-15T10:00:00.000Z',
          mode: 'enhanced',
          score: 88,
        },
        {
          id: 'local-2',
          uuid: 'uuid-local-2',
          input: 'Dog in a park',
          output: 'A playful golden retriever bounding through a sunlit park, shallow depth of field.',
          timestamp: '2026-02-14T08:30:00.000Z',
          mode: 'enhanced',
          score: 82,
        },
      ];
      localStorage.setItem('promptHistory', JSON.stringify(entries));
    });

    await page.goto('/history');

    // Page heading
    await expect(page.getByRole('heading', { name: /history/i })).toBeVisible();

    // Both prompt output texts should be visible
    await expect(page.getByText('A breathtaking golden sunset')).toBeVisible();
    await expect(page.getByText('A playful golden retriever')).toBeVisible();

    // The count indicator should show "2 prompts"
    await expect(page.getByText('2 prompts')).toBeVisible();
  });

  test('shows empty state when no history exists', async ({ page }) => {
    // Ensure localStorage is clean
    await page.addInitScript(() => {
      localStorage.removeItem('promptHistory');
    });

    await page.goto('/history');

    await expect(page.getByRole('heading', { name: /history/i })).toBeVisible();
    await expect(page.getByText('No prompts saved yet')).toBeVisible();
  });

  test('search filters history entries', async ({ page }) => {
    await page.addInitScript(() => {
      const entries = [
        {
          id: 'local-1',
          uuid: 'uuid-local-1',
          input: 'A sunset over the ocean',
          output: 'A breathtaking golden sunset over a calm turquoise ocean.',
          timestamp: '2026-02-15T10:00:00.000Z',
          mode: 'enhanced',
          score: 88,
        },
        {
          id: 'local-2',
          uuid: 'uuid-local-2',
          input: 'Dog in a park',
          output: 'A playful golden retriever in a sunlit park.',
          timestamp: '2026-02-14T08:30:00.000Z',
          mode: 'enhanced',
          score: 82,
        },
      ];
      localStorage.setItem('promptHistory', JSON.stringify(entries));
    });

    await page.goto('/history');

    const searchInput = page.getByLabel('Search prompt history');
    await expect(searchInput).toBeVisible();
    await searchInput.fill('sunset');

    // Only the sunset entry should remain
    await expect(page.getByText('1 results')).toBeVisible();
    await expect(page.getByText('A breathtaking golden sunset')).toBeVisible();
    await expect(page.getByText('A playful golden retriever')).not.toBeVisible();
  });
});
