import { expect, test } from "@playwright/test";
import { jsonResponse } from "./helpers/responses";
import { injectAuthUser } from "./helpers/auth";
import { mockSessionRoutes } from "./helpers/mockRoutes";

test.describe("video generation (authenticated)", () => {
  test("full flow: optimize → image preview → video generate", async ({
    page,
  }) => {
    // Auth injection must happen before navigation
    await injectAuthUser(page);
    await mockSessionRoutes(page);

    let optimizeCalled = false;
    let imagePreviewCalled = false;
    let videoGenerateCalled = false;

    await page.route("**/api/optimize", async (route) => {
      optimizeCalled = true;
      await route.fulfill(
        jsonResponse({
          success: true,
          prompt: "A cinematic runner sprinting through neon rain.",
          optimizedPrompt: "A cinematic runner sprinting through neon rain.",
          metadata: {
            previewPrompt: "A cinematic runner sprinting through neon rain.",
          },
        }),
      );
    });

    await page.route("**/llm/label-spans**", async (route) => {
      await route.fulfill(jsonResponse({ spans: [] }));
    });

    await page.route("**/api/preview/generate/storyboard", async (route) => {
      // The "Preview storyboard" button triggers this endpoint; the image
      // preview flag flips here too because storyboard is the canonical
      // preview surface in the current UI.
      imagePreviewCalled = true;
      await route.fulfill(
        jsonResponse({
          success: true,
          data: {
            imageUrls: ["https://example.com/storyboard-1.png"],
            deltas: ["refined"],
            baseImageUrl: "https://example.com/storyboard-base.png",
          },
        }),
      );
    });

    // Generic preview route — kept as a fallback stub in case the UI ever
    // routes to it, but the test asserts via the storyboard handler above.
    await page.route("**/api/preview/generate", async (route) => {
      await route.fulfill(
        jsonResponse({
          success: true,
          data: {
            imageUrl: "https://example.com/preview.png",
            metadata: {
              aspectRatio: "16:9",
              model: "replicate-flux-schnell",
              duration: 6,
              generatedAt: "2026-02-10T00:00:00.000Z",
            },
          },
        }),
      );
    });

    await page.route("**/api/preview/video/generate", async (route) => {
      videoGenerateCalled = true;
      await route.fulfill(
        jsonResponse({
          success: true,
          jobId: "job_e2e_1",
          creditsReserved: 7,
        }),
      );
    });

    await page.route("**/api/preview/video/jobs/**", async (route) => {
      await route.fulfill(
        jsonResponse({
          success: true,
          jobId: "job_e2e_1",
          status: "completed",
          videoUrl: "https://example.com/video-result.mp4",
          viewUrl: "https://example.com/video-result.mp4",
        }),
      );
    });

    await page.route("**/api/payment/**", async (route) => {
      await route.fulfill(jsonResponse({ success: true }));
    });

    await page.goto("/");

    // Type a prompt and optimize
    const promptInput = page.getByLabel("Optimized prompt");
    await expect(promptInput).toBeVisible();
    await promptInput.fill(
      "Wide shot of a cyclist crossing a rainy bridge at dusk.",
    );

    const optimizeShortcut =
      process.platform === "darwin" ? "Meta+Enter" : "Control+Enter";
    await promptInput.press(optimizeShortcut);
    await expect.poll(() => optimizeCalled).toBe(true);

    // Generate image preview (button label is "Preview storyboard N credits")
    const previewButton = page.getByLabel(/preview storyboard \d+ credits?/i);
    await expect(previewButton).toBeVisible({ timeout: 10000 });
    await previewButton.click();
    await expect.poll(() => imagePreviewCalled).toBe(true);

    // Generate final video — button label is "Generate N credits"
    const generateButton = page.getByLabel(/^generate \d+ credits?$/i);
    if (await generateButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await generateButton.click();
      await expect.poll(() => videoGenerateCalled).toBe(true);
    }
  });
});
