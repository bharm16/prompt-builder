import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { TuneDrawer } from "../TuneDrawer";

/**
 * Regression: ISSUE-39
 *
 * Invariant: when the prompt is empty (or whitespace-only), the AI Enhance
 * button must be rendered as `disabled` so the user gets the same kind of
 * "you can't do this yet" affordance as every other action that depends on
 * a non-empty prompt.
 *
 * Live observation (2026-05-02): clicking Enhance with an empty prompt
 * produced ZERO user-visible feedback — no toast, no error, no
 * disabled state. The handler in PromptCanvas.handleEnhance silently
 * returns when `editorDisplayText.trim()` is empty, so the click is a
 * no-op. Combined with the absence of a disabled affordance, the
 * button looks broken to the user.
 *
 * Migration note: the Enhance button moved from CanvasSettingsRow into the
 * Tune drawer as part of the chip-row redesign. The disabled-when-empty
 * contract follows it. The parent (CanvasWorkspace) computes
 * `enhanceDisabled = !onEnhance || !prompt.trim()` and passes it down.
 */

interface DrawerProps {
  enhanceDisabled?: boolean;
  isEnhancing?: boolean;
  onEnhance?: () => void;
}

const renderDrawer = (props: DrawerProps = {}): void => {
  render(
    <TuneDrawer
      selectedChipIds={[]}
      onToggleChip={vi.fn()}
      onClose={vi.fn()}
      {...(props.onEnhance !== undefined ? { onEnhance: props.onEnhance } : {})}
      isEnhancing={props.isEnhancing ?? false}
      enhanceDisabled={props.enhanceDisabled ?? false}
    />,
  );
};

describe("regression: Enhance button is disabled when prompt is empty (ISSUE-39)", () => {
  it("disables the Enhance button when enhanceDisabled is true (parent computes from empty prompt)", () => {
    renderDrawer({ onEnhance: vi.fn(), enhanceDisabled: true });
    const button = screen.getByTestId("tune-drawer-enhance");
    expect(button).toBeDisabled();
  });

  it("enables the Enhance button when prompt has content and onEnhance is wired", () => {
    renderDrawer({ onEnhance: vi.fn(), enhanceDisabled: false });
    const button = screen.getByTestId("tune-drawer-enhance");
    expect(button).not.toBeDisabled();
  });

  it("does not render the Enhance row at all when onEnhance is missing", () => {
    // Existing contract: no callback → no button. The parent only passes
    // `onEnhance` when the upstream chain is wired, so the entire row hides.
    renderDrawer({});
    expect(screen.queryByTestId("tune-drawer-enhance")).not.toBeInTheDocument();
  });

  it("stays disabled while an enhancement is already in flight", () => {
    // The disabled prop is a 2-way OR (`isEnhancing || enhanceDisabled`).
    // A regression that flips the sign of the `isEnhancing` term — for
    // example, `!isEnhancing` from a careless refactor — would let the user
    // fire a second concurrent enhancement, which the underlying handler is
    // not built to handle. Lock the in-flight branch independently of the
    // enhanceDisabled branch above.
    renderDrawer({ onEnhance: vi.fn(), isEnhancing: true });
    const button = screen.getByTestId("tune-drawer-enhance");
    expect(button).toBeDisabled();
  });
});
