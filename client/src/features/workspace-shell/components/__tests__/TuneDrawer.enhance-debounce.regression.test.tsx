import React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { TuneDrawer } from "../TuneDrawer";

/**
 * Regression: ISSUE-42
 *
 * Background: rapid Enhance double-clicks fire `onEnhance` multiple times
 * because the upstream `isOptimizing` guard in PromptCanvas.handleEnhance
 * doesn't flip until React commits a `startTransition`-wrapped state update
 * inside `usePromptOptimizer.optimize`. By the time the user's second click
 * lands (a few hundred milliseconds later), the button is still visibly
 * enabled and the handler fires again. Live repro (2026-05-03): triple-
 * clicking Enhance produced THREE separate POST /api/optimize requests,
 * the first two of which the server's rate limiter rejected with 503 —
 * which surfaced as scary error toasts to the user even though their
 * click eventually succeeded.
 *
 * The cooldown ref originally lived in CanvasSettingsRow. After the chip-
 * row redesign moved Enhance into the Tune drawer, the ref moved with it.
 * This test follows the button to its new home.
 *
 * Invariant: For any rapid-fire clicks on the Enhance button issued
 * back-to-back, the onEnhance handler fires AT MOST ONCE.
 */
describe("regression: Enhance button click is debounced against rapid double-fire (ISSUE-42)", () => {
  it("fires onEnhance exactly once when the button is triple-clicked synchronously", () => {
    const onEnhance = vi.fn();
    render(
      <TuneDrawer
        selectedChipIds={[]}
        onToggleChip={vi.fn()}
        onClose={vi.fn()}
        onEnhance={onEnhance}
        isEnhancing={false}
        enhanceDisabled={false}
      />,
    );

    const enhanceButton = screen.getByTestId("tune-drawer-enhance");
    fireEvent.click(enhanceButton);
    fireEvent.click(enhanceButton);
    fireEvent.click(enhanceButton);

    expect(onEnhance).toHaveBeenCalledTimes(1);
  });
});
