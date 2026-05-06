import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import Settings from "../Settings";
import type { AppSettings } from "../types";

// Regression: ISSUE-36
//
// Invariant: the Settings dialog does NOT render a "Dark Mode" toggle.
//
// Background: a previous version of the dialog exposed a Dark Mode switch
// that persisted `darkMode` to localStorage but had no observable effect —
// the app's surfaces use semantic tokens (`bg-app`, `bg-surface-1`, …) that
// evaluate to dark colors regardless of any theme class, and
// useSettingsDomSync explicitly stripped the `dark` class on every render.
// Exposing the toggle implied a feature the codebase does not actually
// support, leaving users to wonder why nothing changed when they flipped
// the switch.
//
// Live observation (2026-05-02): Settings → Appearance → "Dark Mode"
// toggled visually but the rendered theme didn't change. localStorage was
// updated, the switch position flipped, the Moon/Sun icon flipped — but
// every surface stayed dark.
//
// If light-mode support is added in the future, this test should be
// replaced (not edited) with one that asserts the toggle's effect.

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

describe("regression: non-functional Dark Mode toggle is removed (ISSUE-36)", () => {
  it("does not render a 'Dark Mode' label or toggle anywhere in the dialog", () => {
    render(<Settings {...buildProps()} />);
    expect(screen.queryByText(/dark mode/i)).toBeNull();
    expect(screen.queryByLabelText(/toggle dark mode/i)).toBeNull();
  });

  it("still renders the Appearance section with the Font Size control", () => {
    render(<Settings {...buildProps()} />);
    // Sanity: removing the dark-mode row must not also drop the surrounding
    // Appearance group or the still-functional Font Size control.
    expect(screen.getByText("Appearance")).toBeTruthy();
    expect(screen.getByText("Font Size")).toBeTruthy();
  });
});
