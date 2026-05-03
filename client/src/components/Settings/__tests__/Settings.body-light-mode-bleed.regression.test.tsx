import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import Settings from "../Settings";
import type { AppSettings } from "../types";

// Regression: ISSUE-34 (follow-up to ISSUE-33)
//
// Invariant: the Settings dialog body must use semantic surface tokens
// (`bg-surface-1` / `bg-surface-2` / `border-border` / `text-foreground` /
// `text-muted`) that adapt to the active theme. Raw light-mode neutrals
// (`bg-neutral-50`, `text-neutral-900`, etc.) paint near-white on the dark
// surface, producing the same kind of theme-bleed that ISSUE-33 fixed in the
// header — just spread across every row in the body instead of one banner.
//
// Live observation (2026-05-02): the Dark Mode, Font Size, Auto-save, and
// Export Format rows rendered as light cream pills against the dark dialog
// surface. Inner text remained readable (it used dark colors), but the
// inconsistency violated the visual hierarchy of the rest of the app.

const buildSettings = (overrides: Partial<AppSettings> = {}): AppSettings => ({
  darkMode: false,
  fontSize: "medium",
  autoSave: true,
  exportFormat: "markdown",
  ...overrides,
});

const buildProps = () => ({
  isOpen: true,
  onClose: vi.fn(),
  settings: buildSettings(),
  updateSetting: vi.fn(),
  resetSettings: vi.fn(),
});

// Tailwind tokens that paint a light-only background. Anything in this list
// drops below the contrast budget when the rest of the surface is
// `bg-surface-1` (≈ rgb(26,26,31)). The matching is substring so e.g.
// `bg-neutral-50` also catches `hover:bg-neutral-50`.
const LIGHT_ONLY_BG_TOKENS = [
  "bg-neutral-50",
  "bg-neutral-100",
  "bg-white",
  "bg-gray-50",
  "bg-gray-100",
];
// Light-only text tokens. A `text-neutral-900` heading on a dark dialog
// renders as near-black on near-black — invisible. Headings should use
// `text-foreground`; secondary copy should use `text-muted`.
const LIGHT_ONLY_TEXT_TOKENS = [
  "text-neutral-900",
  "text-neutral-700",
  "text-neutral-600",
  "text-gray-900",
  "text-gray-700",
];
const LIGHT_BORDER_TOKENS = ["border-neutral-200", "border-gray-200"];

const collectOffenders = (
  root: HTMLElement,
  tokens: string[],
): Array<{ tag: string; classes: string; matched: string }> => {
  const offenders: Array<{ tag: string; classes: string; matched: string }> =
    [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
  let node = walker.currentNode as Element | null;
  while (node) {
    if (node instanceof HTMLElement) {
      const cls = (node.className || "").toString();
      for (const token of tokens) {
        // Whole-token check via regex (so `bg-neutral-100` doesn't match
        // `hover:bg-neutral-1000` if such a token ever existed).
        const re = new RegExp(`(?:^|[\\s:])${token}(?=$|[\\s])`);
        if (re.test(cls)) {
          offenders.push({ tag: node.tagName, classes: cls, matched: token });
          break;
        }
      }
    }
    node = walker.nextNode() as Element | null;
  }
  return offenders;
};

// The Dialog renders via Radix portal — its content lives at the document
// root, not inside the test render container.
const queryDialog = (): HTMLElement => {
  const dialog = document.querySelector<HTMLElement>('[role="dialog"]');
  if (!dialog) throw new Error("Settings dialog did not render");
  return dialog;
};

describe("regression: Settings body uses theme-aware tokens (ISSUE-34)", () => {
  it("does not paint any element with a light-only background token", () => {
    render(<Settings {...buildProps()} />);
    const offenders = collectOffenders(queryDialog(), LIGHT_ONLY_BG_TOKENS);
    expect(offenders).toEqual([]);
  });

  it("does not use light-only neutral text colors on body content", () => {
    render(<Settings {...buildProps()} />);
    const offenders = collectOffenders(queryDialog(), LIGHT_ONLY_TEXT_TOKENS);
    expect(offenders).toEqual([]);
  });

  it("does not use light-only border colors that disappear on the dark surface", () => {
    render(<Settings {...buildProps()} />);
    const offenders = collectOffenders(queryDialog(), LIGHT_BORDER_TOKENS);
    expect(offenders).toEqual([]);
  });
});
