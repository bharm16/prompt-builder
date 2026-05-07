import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { TuneDrawer } from "../TuneDrawer";

/**
 * Regression: Enhance button shows loading state during optimization.
 *
 * Migration note: the Enhance button moved from CanvasSettingsRow into the
 * Tune drawer as part of the chip-row redesign. The loading-state contract
 * (spinner + disabled + aria-label flip to "Enhancing prompt…") follows it.
 */
describe("regression: Enhance button shows loading state during optimization", () => {
  it("disables the button and shows spinner when isEnhancing is true", () => {
    render(
      <TuneDrawer
        selectedChipIds={[]}
        onToggleChip={vi.fn()}
        onClose={vi.fn()}
        onEnhance={vi.fn()}
        isEnhancing={true}
      />,
    );

    const button = screen.getByRole("button", { name: /enhancing/i });
    expect(button).toBeDisabled();
    // Should have a spinning SVG, not the MagicWand icon
    const spinner = button.querySelector("svg.animate-spin");
    expect(spinner).toBeTruthy();
  });

  it("keeps the button enabled with MagicWand when isEnhancing is false", () => {
    render(
      <TuneDrawer
        selectedChipIds={[]}
        onToggleChip={vi.fn()}
        onClose={vi.fn()}
        onEnhance={vi.fn()}
        isEnhancing={false}
      />,
    );

    const button = screen.getByRole("button", { name: "Enhance prompt" });
    expect(button).not.toBeDisabled();
    // Should NOT have the spinner
    const spinner = button.querySelector("svg.animate-spin");
    expect(spinner).toBeNull();
  });
});
