import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { describe, expect, it } from "vitest";

// Regression: ISSUE-36 (boot-layer cleanup follow-up)
//
// Invariant: client/index.html does NOT contain a `darkMode` localStorage
// rewrite or a MutationObserver that strips the `dark` class from <html>.
//
// Background: ISSUE-36 removed the user-visible Dark Mode toggle, the
// `darkMode` field on AppSettings, and the dom-sync hook that stripped the
// `dark` class. A separate inline boot script in client/index.html also
// rewrote `parsed.darkMode = false` into localStorage on every page load
// and installed a permanent MutationObserver to fight any `dark` class
// additions. With the React-side toggle gone, that boot script became the
// only code in the entire codebase that still referenced `darkMode` — a
// vestigial migration with no caller, fighting a class nothing in the
// React tree adds. It also fought the useSettingsStorage `.partial().strip()`
// migration by re-injecting the stripped key on every cold boot.
//
// Live observation (2026-05-02): grep'd the codebase after deleting the
// React toggle and the only remaining `darkMode` reference (outside of
// build artifacts in `client/dist/`) lived in the index.html boot script.
// Two contradictory mental models for theming, no user-visible effect,
// persistent localStorage churn.
//
// If a real theming system is reintroduced in the future, this test should
// be replaced (not edited) with one that asserts the new boot behavior.

const HERE = dirname(fileURLToPath(import.meta.url));
const INDEX_HTML_PATH = resolve(HERE, "..", "..", "client", "index.html");
const html = readFileSync(INDEX_HTML_PATH, "utf8");

describe("regression: index.html boot script no longer touches darkMode (ISSUE-36)", () => {
  it("does not write `darkMode` into localStorage on boot", () => {
    expect(html).not.toMatch(/darkMode/);
  });

  it("does not install a MutationObserver to strip a 'dark' class", () => {
    expect(html).not.toMatch(/MutationObserver/);
  });

  it('does not call classList.remove("dark") in any inline boot logic', () => {
    expect(html).not.toMatch(/classList\.remove\(\s*["']dark["']\s*\)/);
  });
});
