import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const artifactDir = path.resolve(
  "output/playwright/aggressive-generation-pass-2026-03-24-rerun",
);
const baseUrl = "http://localhost:5173";

const summary = {
  startedAt: new Date().toISOString(),
  baseUrl,
  auth: {},
  notes: [],
  screenshots: [],
  states: [],
  network: [],
  requestFailures: [],
  console: [],
  pageErrors: [],
  sessionLinks: [],
};

let browser;
let context;
let page;
let shotIndex = 0;

function sanitize(name) {
  return name
    .replace(/[^a-z0-9._-]+/gi, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

async function screenshot(name, { fullPage = true } = {}) {
  shotIndex += 1;
  const file = path.join(
    artifactDir,
    `${String(shotIndex).padStart(2, "0")}-${sanitize(name)}.png`,
  );
  await page.screenshot({ path: file, fullPage });
  summary.screenshots.push(file);
  console.log(`SHOT ${path.basename(file)}`);
  return file;
}

async function visibleButtons() {
  return await page
    .locator('button, a[role="button"]')
    .evaluateAll((elements) =>
      elements
        .map((element) => {
          const rect = element.getBoundingClientRect();
          const style = window.getComputedStyle(element);
          const visible =
            rect.width > 0 &&
            rect.height > 0 &&
            style.visibility !== "hidden" &&
            style.display !== "none";
          if (!visible) return null;
          const isButton = element instanceof HTMLButtonElement;
          return {
            tag: element.tagName.toLowerCase(),
            text: (element.textContent || "").trim(),
            ariaLabel: element.getAttribute("aria-label"),
            title: element.getAttribute("title"),
            disabled: isButton
              ? element.disabled
              : element.getAttribute("aria-disabled"),
            testId: element.getAttribute("data-testid"),
          };
        })
        .filter(Boolean),
    );
}

async function bodyText() {
  return await page.evaluate(() => document.body.innerText);
}

async function captureState(label) {
  const state = {
    at: new Date().toISOString(),
    label,
    url: page.url(),
    buttons: await visibleButtons(),
    bodyText: (await bodyText()).slice(0, 5000),
    sessionAnchors: await page.evaluate(() =>
      Array.from(document.querySelectorAll('a[href*="/session/"]')).map(
        (a) => ({
          text: (a.textContent || "").trim(),
          href: a.getAttribute("href"),
        }),
      ),
    ),
    canvasGenerate: await page
      .locator('[data-testid="canvas-generate-button"]')
      .evaluateAll((els) =>
        els.map((el) => ({
          disabled: el instanceof HTMLButtonElement ? el.disabled : null,
          ariaLabel: el.getAttribute("aria-label"),
          title: el.getAttribute("title"),
        })),
      ),
    canvasPreview: await page
      .locator('[data-testid="canvas-preview-button"]')
      .evaluateAll((els) =>
        els.map((el) => ({
          disabled: el instanceof HTMLButtonElement ? el.disabled : null,
          ariaLabel: el.getAttribute("aria-label"),
          title: el.getAttribute("title"),
        })),
      ),
    footerButtons: await page.locator("footer button").evaluateAll((els) =>
      els.map((el) => ({
        text: (el.textContent || "").trim(),
        disabled: el instanceof HTMLButtonElement ? el.disabled : null,
        ariaLabel: el.getAttribute("aria-label"),
        title: el.getAttribute("title"),
      })),
    ),
  };
  summary.states.push(state);
  for (const link of state.sessionAnchors) {
    if (link.href) {
      summary.sessionLinks.push(link.href);
    }
  }
  console.log(`STATE ${label} ${state.url}`);
  return state;
}

function interestingUrl(url) {
  return [
    "/api/preview/video/generate",
    "/api/preview/video/jobs/",
    "/api/history",
    "/api/payment",
    "/api/billing",
    "/api/credits",
    "/api/sessions",
    "/api/auth",
  ].some((segment) => url.includes(segment));
}

async function waitForWorkspace() {
  await page.waitForSelector(
    '[role="textbox"][aria-label="Optimized prompt"]',
    {
      timeout: 30000,
    },
  );
  await page.waitForTimeout(1500);
}

async function fillPrompt(prompt) {
  const editor = page.getByRole("textbox", { name: "Optimized prompt" });
  await editor.click();
  await editor.fill(prompt);
  await page.waitForTimeout(400);
}

async function clickCanvasGenerate(options) {
  await page.locator('[data-testid="canvas-generate-button"]').click(options);
}

async function clickSessions() {
  await page.getByRole("button", { name: /Sessions/i }).click();
  await page.waitForTimeout(700);
}

async function clickGallery() {
  await page.getByRole("button", { name: /Gallery/i }).click();
  await page.waitForTimeout(700);
}

async function clickTool() {
  await page.getByRole("button", { name: /^Tool$/i }).click();
  await page.waitForTimeout(700);
}

async function maybeCreateAccount() {
  await page.goto(`${baseUrl}/`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1800);
  await screenshot("01-root-initial");

  const promptVisible = await page
    .getByRole("textbox", { name: "Optimized prompt" })
    .isVisible()
    .catch(() => false);
  const accountLinkVisible = await page
    .getByRole("link", { name: "Account" })
    .isVisible()
    .catch(() => false);
  const signInLinkVisible = await page
    .getByRole("link", { name: /Sign in/i })
    .isVisible()
    .catch(() => false);

  summary.auth.initialWorkspaceVisible = promptVisible;
  summary.auth.initialAccountLinkVisible = accountLinkVisible;
  summary.auth.initialSignInVisible = signInLinkVisible;

  if (promptVisible && accountLinkVisible) {
    summary.auth.hadExistingSession = true;
    return;
  }

  summary.auth.hadExistingSession = false;
  const email = `codex.qa+${Date.now()}@example.com`;
  const password = "VidraQA!12345";
  summary.auth.testEmail = email;
  summary.auth.createdAccount = true;

  await page.goto(`${baseUrl}/signup?redirect=/`, {
    waitUntil: "domcontentloaded",
  });
  await page.waitForTimeout(1000);
  await screenshot("02-signup-page");
  await page.getByPlaceholder("Your name").fill("Codex QA");
  await page.getByPlaceholder("you@company.com").fill(email);
  await page.getByPlaceholder("At least 6 characters").fill(password);
  await page.getByPlaceholder("Repeat your password").fill(password);
  await screenshot("03-signup-filled");
  await Promise.all([
    page.waitForURL(/\/email-verification/, { timeout: 30000 }),
    page.getByRole("button", { name: "Create account" }).click(),
  ]);
  await page.waitForTimeout(1200);
  await screenshot("04-email-verification");
  await captureState("email-verification");
  await page.getByRole("button", { name: "Continue" }).click();
}

async function run() {
  await fs.mkdir(artifactDir, { recursive: true });
  browser = await chromium.launch({ headless: false, slowMo: 60 });
  context = await browser.newContext({
    viewport: { width: 1440, height: 1200 },
  });
  await context.tracing.start({
    screenshots: true,
    snapshots: true,
    sources: false,
  });
  page = await context.newPage();

  page.on("console", (msg) => {
    summary.console.push({
      type: msg.type(),
      text: msg.text(),
      location: msg.location(),
    });
  });
  page.on("pageerror", (error) => {
    summary.pageErrors.push({ message: error.message, stack: error.stack });
  });
  page.on("requestfailed", (request) => {
    summary.requestFailures.push({
      url: request.url(),
      method: request.method(),
      failure: request.failure(),
    });
  });
  page.on("request", (request) => {
    if (!interestingUrl(request.url())) return;
    summary.network.push({
      kind: "request",
      url: request.url(),
      method: request.method(),
      at: new Date().toISOString(),
      postData: request.postData() ? request.postData().slice(0, 4000) : null,
    });
    console.log(`REQ ${request.method()} ${request.url()}`);
  });
  page.on("response", async (response) => {
    if (!interestingUrl(response.url())) return;
    let body = null;
    try {
      body = (await response.text()).slice(0, 4000);
    } catch {
      body = null;
    }
    summary.network.push({
      kind: "response",
      url: response.url(),
      method: response.request().method(),
      status: response.status(),
      at: new Date().toISOString(),
      body,
    });
    console.log(
      `RES ${response.status()} ${response.request().method()} ${response.url()}`,
    );
  });

  await maybeCreateAccount();
  await waitForWorkspace();
  summary.auth.signedIn = true;
  await screenshot("05-workspace-after-auth");
  await captureState("workspace-ready");

  const longPrompt =
    "A cinematic tracking shot of a fox sprinting through fresh snow at sunrise, powder kicking up behind it, shallow depth of field, realistic motion blur, 16mm film texture.";
  await fillPrompt(longPrompt);
  await screenshot("06-long-prompt-entered");
  await captureState("prompt-entered-long");

  const initialGenerateButton = await page
    .locator('[data-testid="canvas-generate-button"]')
    .evaluate((el) => ({
      disabled: el instanceof HTMLButtonElement ? el.disabled : null,
      ariaLabel: el.getAttribute("aria-label"),
      title: el.getAttribute("title"),
    }));
  summary.notes.push(
    `Initial canvas generate button: ${JSON.stringify(initialGenerateButton)}`,
  );

  await clickCanvasGenerate();
  await page.waitForTimeout(1200);
  await screenshot("07-after-first-generate-click");
  await captureState("after-first-generate-click");

  try {
    await page
      .locator('[data-testid="canvas-generate-button"]')
      .dblclick({ timeout: 2000 });
    summary.notes.push(
      "Double-click on canvas generate completed without Playwright error.",
    );
  } catch (error) {
    summary.notes.push(
      `Double-click on canvas generate failed: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }

  await page.waitForTimeout(6000);
  await screenshot("08-first-generate-plus-6s");
  await captureState("first-generate-plus-6s");

  try {
    await clickGallery();
  } catch (error) {
    summary.notes.push(
      `Gallery toggle failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  await screenshot("09-gallery-after-queued-generate");
  await captureState("gallery-after-queued-generate");

  try {
    await clickTool();
  } catch (error) {
    summary.notes.push(
      `Returning to Tool failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  const mutatedPrompt = "A fox running through snow.";
  await fillPrompt(mutatedPrompt);
  await screenshot("10-prompt-mutated-during-queue");
  await captureState("prompt-mutated-during-queue");

  const canvasGenerateStateAfterMutation = await page
    .locator('[data-testid="canvas-generate-button"]')
    .evaluate((el) => ({
      disabled: el instanceof HTMLButtonElement ? el.disabled : null,
      ariaLabel: el.getAttribute("aria-label"),
      title: el.getAttribute("title"),
    }));
  summary.notes.push(
    `Canvas generate after mutation: ${JSON.stringify(canvasGenerateStateAfterMutation)}`,
  );

  await clickSessions();
  await screenshot("11-sessions-panel-open");
  await captureState("sessions-panel-open");

  const firstSessionHref = await page.evaluate(() => {
    const anchor = document.querySelector('a[href*="/session/"]');
    return anchor ? anchor.getAttribute("href") : null;
  });
  if (firstSessionHref) {
    summary.notes.push(`Found session link: ${firstSessionHref}`);
  } else {
    summary.notes.push("No /session/:id link was visible in Sessions panel.");
  }

  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForWorkspace();
  await screenshot("12-workspace-after-reload");
  await captureState("workspace-after-reload");

  await clickSessions();
  await screenshot("13-sessions-after-reload");
  await captureState("sessions-after-reload");

  const newButton = page.getByRole("button", { name: /\+ New/i });
  if (await newButton.isVisible().catch(() => false)) {
    await newButton.click();
    await page.waitForTimeout(800);
    await screenshot("14-after-new-session");
    await captureState("after-new-session");
  } else {
    summary.notes.push("Could not find + New in Sessions panel after reload.");
  }

  try {
    await clickTool();
  } catch (error) {
    summary.notes.push(
      `Reopening Tool panel before low-balance retry failed: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
  await fillPrompt("A red kite over a lake.");
  await screenshot("15-low-balance-new-session-prompt");
  await captureState("low-balance-new-session-prompt");

  const lowBalanceCanvasButton = await page
    .locator('[data-testid="canvas-generate-button"]')
    .evaluate((el) => ({
      disabled: el instanceof HTMLButtonElement ? el.disabled : null,
      ariaLabel: el.getAttribute("aria-label"),
      title: el.getAttribute("title"),
    }));
  summary.notes.push(
    `Low-balance canvas button: ${JSON.stringify(lowBalanceCanvasButton)}`,
  );

  const footerButtonStates = await page
    .locator("footer button")
    .evaluateAll((els) =>
      els.map((el) => ({
        text: (el.textContent || "").trim(),
        disabled: el instanceof HTMLButtonElement ? el.disabled : null,
        title: el.getAttribute("title"),
      })),
    );
  summary.notes.push(
    `Footer buttons on low balance: ${JSON.stringify(footerButtonStates)}`,
  );

  const postCountBeforeLowBalanceClicks = summary.network.filter(
    (entry) =>
      entry.kind === "request" &&
      entry.url.includes("/api/preview/video/generate"),
  ).length;

  try {
    await clickCanvasGenerate({ clickCount: 2, delay: 30 });
    summary.notes.push(
      "Low-balance canvas generate accepted double click attempt.",
    );
  } catch (error) {
    summary.notes.push(
      `Low-balance canvas generate double click threw: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }

  await page.waitForTimeout(1800);
  await screenshot("16-after-low-balance-generate-attempt");
  await captureState("after-low-balance-generate-attempt");

  const postCountAfterLowBalanceClicks = summary.network.filter(
    (entry) =>
      entry.kind === "request" &&
      entry.url.includes("/api/preview/video/generate"),
  ).length;
  summary.notes.push(
    `Generate POST count delta after low-balance double click: ${
      postCountAfterLowBalanceClicks - postCountBeforeLowBalanceClicks
    }`,
  );

  await page.waitForTimeout(4000);
  await screenshot("17-low-balance-plus-4s");
  await captureState("low-balance-plus-4s");

  await page.goto(`${baseUrl}/account`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);
  await screenshot("18-account-page");
  await captureState("account-page");

  await page.goto(`${baseUrl}/home`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1200);
  await screenshot("19-home-page-signed-in");
  await captureState("home-page-signed-in");

  if (firstSessionHref) {
    await page.goto(`${baseUrl}${firstSessionHref}`, {
      waitUntil: "domcontentloaded",
    });
    await page.waitForTimeout(1500);
    await screenshot("20-session-route");
    await captureState("session-route");
  }
}

try {
  await run();
} catch (error) {
  summary.fatal =
    error instanceof Error
      ? { message: error.message, stack: error.stack }
      : { message: String(error) };
  console.error("FATAL", summary.fatal.message);
} finally {
  summary.finishedAt = new Date().toISOString();
  try {
    if (context) {
      await context.tracing.stop({ path: path.join(artifactDir, "trace.zip") });
    }
  } catch (error) {
    summary.traceError = error instanceof Error ? error.message : String(error);
  }
  try {
    await fs.writeFile(
      path.join(artifactDir, "summary.json"),
      JSON.stringify(summary, null, 2),
    );
  } catch (error) {
    console.error(
      "WRITE_SUMMARY_FAILED",
      error instanceof Error ? error.message : String(error),
    );
  }
  try {
    await context?.close();
  } catch (error) {
    summary.notes.push(
      `Closing Playwright context failed: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
  try {
    await browser?.close();
  } catch (error) {
    summary.notes.push(
      `Closing Playwright browser failed: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
  console.log(`SUMMARY ${path.join(artifactDir, "summary.json")}`);
}
