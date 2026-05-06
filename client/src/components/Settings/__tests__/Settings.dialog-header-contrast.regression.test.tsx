import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import Settings from "../Settings";
import type { AppSettings } from "../types";

// Regression: ISSUE-33
//
// Invariant: the Settings dialog header must not paint a light-mode gradient
// (`from-primary-50`, `to-secondary-50`, etc. — Tailwind's lightest tints)
// behind a `text-foreground` heading. The whole app surface is dark
// (`bg-surface-1` ≈ rgb(26,26,31)) and `text-foreground` resolves to a
// near-white value, so a near-white gradient drops the title below the
// readable contrast threshold.
//
// Live repro (Settings shortcut Cmd+,, 2026-05-02): "Settings" was nearly
// invisible — the H2 sat on a light cream-to-teal gradient.

const buildSettings = (overrides: Partial<AppSettings> = {}): AppSettings => ({
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

// Tailwind class names that paint a near-white gradient. If new Tailwind
// classes are introduced that produce the same visual outcome, add them here.
const LIGHT_GRADIENT_CLASSES = [
  "from-primary-50",
  "to-primary-50",
  "from-secondary-50",
  "to-secondary-50",
  "from-neutral-50",
  "to-neutral-50",
  "from-white",
  "to-white",
];

describe("regression: Settings dialog header contrast (ISSUE-33)", () => {
  it("does not place a light-mode gradient behind the dialog title", () => {
    render(<Settings {...buildProps()} />);

    const title = screen.getByText("Settings", { selector: "h2" });
    // Walk up to the closest CardHeader-style ancestor — the element actually
    // painting the background. We can't rely on a single fixed depth because
    // the @promptstudio/system Card wrapper may insert/remove layers.
    let host: HTMLElement | null = title;
    let depth = 0;
    while (host && depth < 6) {
      const cls = host.className || "";
      if (cls.includes("bg-gradient")) break;
      host = host.parentElement;
      depth++;
    }

    // If no ancestor in the chain paints a gradient, the bug is fixed by
    // construction — there's nothing to fight the heading text color.
    if (!host) return;

    const cls = host.className || "";
    for (const offending of LIGHT_GRADIENT_CLASSES) {
      expect(cls).not.toContain(offending);
    }
  });

  it("renders the Settings title text at all (sanity)", () => {
    render(<Settings {...buildProps()} />);
    expect(screen.getByRole("heading", { name: "Settings" })).toBeTruthy();
  });
});
