import { expect, test } from "@playwright/test";
import { injectAuthUser } from "./helpers/auth";

test("text input latency remains under baseline threshold", async ({
  page,
}) => {
  await injectAuthUser(page);
  await page.goto("/");

  const promptInput = page.getByLabel("Optimized prompt");
  await expect(promptInput).toBeVisible({ timeout: 15000 });

  const start = Date.now();
  await promptInput.fill(
    "Close-up of a pianist playing under warm stage lighting with shallow depth of field.",
  );
  // The prompt input is a contenteditable div, not a form input — use
  // toHaveText (matches textContent) instead of toHaveValue.
  await expect(promptInput).toHaveText(/pianist playing/i);
  const elapsedMs = Date.now() - start;

  expect(elapsedMs).toBeLessThan(2000);
  await expect(
    page.getByRole("button", { name: /enhance prompt/i }),
  ).toBeVisible();
});
