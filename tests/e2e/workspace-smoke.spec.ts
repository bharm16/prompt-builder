import { expect, test } from "@playwright/test";
import { jsonResponse } from "./helpers/responses";
import { injectAuthUser } from "./helpers/auth";

test("workspace smoke: optimize, preview, and session persistence flow", async ({
  page,
}) => {
  // Auth injection must happen before navigation. The Optimized prompt
  // contenteditable is auth-gated; unauthenticated users only see a static
  // placeholder and can't interact with the editor.
  await injectAuthUser(page);

  let optimizeCalls = 0;
  let previewCalls = 0;
  let sessionMutationCalls = 0;

  await page.route("**/api/optimize", async (route) => {
    optimizeCalls += 1;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        prompt: "A cinematic runner sprinting through neon rain.",
        optimizedPrompt: "A cinematic runner sprinting through neon rain.",
        metadata: {
          previewPrompt: "A cinematic runner sprinting through neon rain.",
        },
      }),
    });
  });

  await page.route("**/api/preview/generate/storyboard", async (route) => {
    previewCalls += 1;
    await route.fulfill(
      jsonResponse({
        success: true,
        data: {
          imageUrls: ["https://example.com/storyboard-1.png"],
          deltas: ["refined frame"],
          baseImageUrl: "https://example.com/storyboard-base.png",
        },
      }),
    );
  });

  await page.route("**/api/preview/generate", async (route) => {
    previewCalls += 1;
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

  await page.route("**/api/v2/sessions**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const pathname = url.pathname;
    const method = request.method();

    if (method === "GET" && pathname.endsWith("/api/v2/sessions")) {
      await route.fulfill(jsonResponse({ success: true, data: [] }));
      return;
    }

    if (method === "POST" && pathname.endsWith("/api/v2/sessions")) {
      sessionMutationCalls += 1;
      await route.fulfill(
        jsonResponse({
          success: true,
          data: {
            id: "session_e2e_1",
            prompt: { uuid: "prompt_e2e_1", input: "Initial prompt" },
          },
        }),
      );
      return;
    }

    if (method === "GET" && pathname.includes("/api/v2/sessions/by-prompt/")) {
      await route.fulfill(
        jsonResponse(
          {
            success: true,
            data: { id: "session_e2e_1" },
          },
          200,
        ),
      );
      return;
    }

    if (
      method === "GET" &&
      pathname.includes("/api/v2/sessions/session_e2e_1")
    ) {
      await route.fulfill(
        jsonResponse({
          success: true,
          data: {
            id: "session_e2e_1",
            prompt: { uuid: "prompt_e2e_1", input: "Loaded prompt" },
          },
        }),
      );
      return;
    }

    if (method === "PATCH") {
      sessionMutationCalls += 1;
      await route.fulfill(
        jsonResponse({ success: true, data: { id: "session_e2e_1" } }),
      );
      return;
    }

    await route.fulfill(jsonResponse({ success: true }));
  });

  await page.goto("/");

  const promptInput = page.getByLabel("Optimized prompt");
  await expect(promptInput).toBeVisible();
  await promptInput.fill(
    "Wide shot of a cyclist crossing a rainy bridge at dusk.",
  );

  const optimizeShortcut =
    process.platform === "darwin" ? "Meta+Enter" : "Control+Enter";
  await promptInput.press(optimizeShortcut);
  await expect.poll(() => optimizeCalls).toBeGreaterThan(0);

  await page.getByLabel(/preview storyboard \d+ credits?/i).click();
  await expect.poll(() => previewCalls).toBeGreaterThan(0);

  // The sessions panel toggle now uses aria-label "Sessions" (rail icon).
  // The previous "Session selector" / "Open sessions" labels were removed
  // when the workspace got the rail-based navigation.
  const sessionsButton = page.getByRole("button", { name: /^sessions$/i });
  await expect
    .poll(async () => {
      if (sessionMutationCalls > 0) return true;
      return sessionsButton.isVisible();
    })
    .toBe(true);
  await expect(sessionsButton).toBeVisible();
});
