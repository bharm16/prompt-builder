import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const artifactDir = path.resolve(
  "output/playwright/aggressive-generation-pass-2026-03-24-followup",
);
const baseUrl = "http://localhost:5173";

const summary = {
  startedAt: new Date().toISOString(),
  screenshots: [],
  network: [],
  states: [],
  notes: [],
  auth: {},
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

async function screenshot(name) {
  shotIndex += 1;
  const file = path.join(
    artifactDir,
    `${String(shotIndex).padStart(2, "0")}-${sanitize(name)}.png`,
  );
  await page.screenshot({ path: file, fullPage: true });
  summary.screenshots.push(file);
  console.log(`SHOT ${path.basename(file)}`);
}

async function captureState(label) {
  const state = {
    label,
    url: page.url(),
    bodyText: (await page.evaluate(() => document.body.innerText)).slice(
      0,
      4000,
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
  };
  summary.states.push(state);
  console.log(`STATE ${label}`);
}

function trackApi(requestOrResponse, extra = {}) {
  const url = requestOrResponse.url();
  if (!url.includes("/api/")) return;
  summary.network.push({ url, ...extra });
}

async function waitForWorkspace() {
  await page.waitForSelector(
    '[role="textbox"][aria-label="Optimized prompt"]',
    {
      timeout: 30000,
    },
  );
  await page.waitForTimeout(1200);
}

async function fillPrompt(text) {
  const editor = page.getByRole("textbox", { name: "Optimized prompt" });
  await editor.click();
  await editor.fill(text);
  await page.waitForTimeout(300);
}

try {
  await fs.mkdir(artifactDir, { recursive: true });
  browser = await chromium.launch({ headless: false, slowMo: 60 });
  context = await browser.newContext({
    viewport: { width: 1440, height: 1200 },
  });
  page = await context.newPage();

  page.on("request", (request) => {
    if (!request.url().includes("/api/")) return;
    trackApi(request, {
      kind: "request",
      method: request.method(),
      postData: request.postData() ? request.postData().slice(0, 1000) : null,
    });
  });
  page.on("response", async (response) => {
    if (!response.url().includes("/api/")) return;
    let body = null;
    try {
      body = (await response.text()).slice(0, 1200);
    } catch {
      body = null;
    }
    trackApi(response, {
      kind: "response",
      method: response.request().method(),
      status: response.status(),
      body,
    });
  });

  const email = `codex.qa.followup+${Date.now()}@example.com`;
  const password = "VidraQA!12345";
  summary.auth.email = email;

  await page.goto(`${baseUrl}/signup?redirect=/`, {
    waitUntil: "domcontentloaded",
  });
  await page.getByPlaceholder("Your name").fill("Codex QA");
  await page.getByPlaceholder("you@company.com").fill(email);
  await page.getByPlaceholder("At least 6 characters").fill(password);
  await page.getByPlaceholder("Repeat your password").fill(password);
  await screenshot("01-signup-filled");
  await Promise.all([
    page.waitForURL(/\/email-verification/, { timeout: 30000 }),
    page.getByRole("button", { name: "Create account" }).click(),
  ]);
  await page.getByRole("button", { name: "Continue" }).click();

  await waitForWorkspace();
  await screenshot("02-workspace-ready");
  await captureState("workspace-ready");

  await fillPrompt(
    "A cinematic tracking shot of a fox sprinting through fresh snow at sunrise, powder kicking up behind it.",
  );
  await screenshot("03-first-prompt");
  await page.locator('[data-testid="canvas-generate-button"]').click();
  await page.waitForTimeout(1200);
  await screenshot("04-first-generate");
  await captureState("after-first-generate");

  await page.getByRole("button", { name: /Sessions/i }).click();
  await page.waitForTimeout(700);
  await screenshot("05-sessions-open");
  await captureState("sessions-open");

  const newButton = page.getByRole("button", { name: /\+ New/i });
  await newButton.click();
  await page.waitForTimeout(1000);
  await screenshot("06-after-plus-new");
  await captureState("after-plus-new");

  await fillPrompt("A red kite over a lake.");
  await screenshot("07-second-prompt");
  await captureState("second-prompt-entered");

  const beforePosts = summary.network.filter(
    (entry) =>
      entry.kind === "request" &&
      entry.url.includes("/api/preview/video/generate"),
  ).length;
  const buttonDisabled = await page
    .locator('[data-testid="canvas-generate-button"]')
    .evaluate((el) => (el instanceof HTMLButtonElement ? el.disabled : null));
  summary.notes.push(
    `Second-session canvas generate disabled=${buttonDisabled}`,
  );

  if (!buttonDisabled) {
    await page.locator('[data-testid="canvas-generate-button"]').click();
    await page.waitForTimeout(1500);
    await screenshot("08-second-generate-attempt");
    await captureState("after-second-generate-attempt");
  } else {
    summary.notes.push(
      "Second-session generate stayed disabled, so no second POST was attempted.",
    );
  }

  const afterPosts = summary.network.filter(
    (entry) =>
      entry.kind === "request" &&
      entry.url.includes("/api/preview/video/generate"),
  ).length;
  summary.notes.push(
    `Generate POST delta after +New flow: ${afterPosts - beforePosts}`,
  );
} catch (error) {
  summary.fatal =
    error instanceof Error
      ? { message: error.message, stack: error.stack }
      : { message: String(error) };
  console.error("FATAL", summary.fatal.message);
} finally {
  summary.finishedAt = new Date().toISOString();
  await fs.writeFile(
    path.join(artifactDir, "summary.json"),
    JSON.stringify(summary, null, 2),
  );
  await context?.close().catch(() => {});
  await browser?.close().catch(() => {});
  console.log(`SUMMARY ${path.join(artifactDir, "summary.json")}`);
}
