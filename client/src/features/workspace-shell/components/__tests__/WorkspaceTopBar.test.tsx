import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("../../hooks/useWorkspaceProject", () => ({
  useWorkspaceProject: () => ({
    name: "My Project",
    rename: vi.fn(),
  }),
}));
vi.mock("../../hooks/useWorkspaceCredits", () => ({
  useWorkspaceCredits: () => ({ credits: 1234, avatarUrl: null }),
}));

import { WorkspaceTopBar } from "../WorkspaceTopBar";

describe("WorkspaceTopBar", () => {
  it("renders the project name as static text (no inline-rename until persistence lands)", () => {
    render(<WorkspaceTopBar />);
    const label = screen.getByText("My Project");
    expect(label).toBeInTheDocument();
    // Locked: must NOT be a button — a click affordance that loses data on
    // remount violates the project's "browsing is read-only" UX rule.
    expect(label.tagName.toLowerCase()).toBe("span");
  });

  it("renders mode tabs with Image / Audio / 3D as aria-disabled (not native disabled)", () => {
    render(<WorkspaceTopBar />);
    const inactiveTabs = [/image/i, /audio/i, /3d/i];
    for (const re of inactiveTabs) {
      const tab = screen.getByRole("tab", { name: re });
      expect(tab).toHaveAttribute("aria-disabled", "true");
      // Native `disabled` removes the tab from focus order entirely, breaking
      // tablist roving-tabindex semantics. Inactive tabs must stay focusable
      // for screen readers but be excluded from the tab-order via tabIndex=-1.
      expect(tab).not.toHaveAttribute("disabled");
      expect(tab).toHaveAttribute("tabindex", "-1");
    }
  });

  it("renders Video tab as the active tab with tabIndex 0", () => {
    render(<WorkspaceTopBar />);
    const videoTab = screen.getByRole("tab", { name: /video/i });
    expect(videoTab).toHaveAttribute("aria-selected", "true");
    expect(videoTab).not.toHaveAttribute("aria-disabled", "true");
    expect(videoTab).toHaveAttribute("tabindex", "0");
  });

  it("renders the credits formatted with thousands separator", () => {
    render(<WorkspaceTopBar />);
    expect(screen.getByText(/1,234/)).toBeInTheDocument();
  });
});
