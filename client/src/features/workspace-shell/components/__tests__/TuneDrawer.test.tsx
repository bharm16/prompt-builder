import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TuneDrawer } from "../TuneDrawer";
import { TUNE_CHIPS } from "../../utils/tuneChips";

describe("TuneDrawer", () => {
  it("renders three section legends (Motion, Mood, Style)", () => {
    render(
      <TuneDrawer
        selectedChipIds={[]}
        onToggleChip={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText(/motion/i)).toBeInTheDocument();
    expect(screen.getByText(/mood/i)).toBeInTheDocument();
    expect(screen.getByText(/style/i)).toBeInTheDocument();
  });

  it("renders all 9 chips as buttons with aria-pressed", () => {
    render(
      <TuneDrawer
        selectedChipIds={[]}
        onToggleChip={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    for (const chip of TUNE_CHIPS) {
      const btn = screen.getByRole("button", { name: chip.label });
      expect(btn).toHaveAttribute("aria-pressed", "false");
    }
  });

  it("marks selected chips as aria-pressed=true", () => {
    const firstChip = TUNE_CHIPS[0]!;
    render(
      <TuneDrawer
        selectedChipIds={[firstChip.id]}
        onToggleChip={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    const btn = screen.getByRole("button", { name: firstChip.label });
    expect(btn).toHaveAttribute("aria-pressed", "true");
  });

  it("calls onToggleChip with the chip id when a chip is clicked", () => {
    const firstChip = TUNE_CHIPS[0]!;
    const onToggle = vi.fn();
    render(
      <TuneDrawer
        selectedChipIds={[]}
        onToggleChip={onToggle}
        onClose={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: firstChip.label }));
    expect(onToggle).toHaveBeenCalledWith(firstChip.id);
  });

  it("calls onClose when the close button is clicked", () => {
    const onClose = vi.fn();
    render(
      <TuneDrawer
        selectedChipIds={[]}
        onToggleChip={vi.fn()}
        onClose={onClose}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /close/i }));
    expect(onClose).toHaveBeenCalled();
  });
});
