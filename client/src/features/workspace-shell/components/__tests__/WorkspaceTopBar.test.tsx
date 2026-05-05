import { fireEvent, render, screen } from "@testing-library/react";
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
  it("renders the project name", () => {
    render(<WorkspaceTopBar />);
    expect(screen.getByText("My Project")).toBeInTheDocument();
  });

  it("renders mode tabs with Image / Audio / 3D as aria-disabled", () => {
    render(<WorkspaceTopBar />);
    expect(screen.getByRole("tab", { name: /image/i })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    expect(screen.getByRole("tab", { name: /audio/i })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    expect(screen.getByRole("tab", { name: /3d/i })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });

  it("renders Video tab as the active tab", () => {
    render(<WorkspaceTopBar />);
    const videoTab = screen.getByRole("tab", { name: /video/i });
    expect(videoTab).toHaveAttribute("aria-selected", "true");
    expect(videoTab).not.toHaveAttribute("aria-disabled", "true");
  });

  it("renders the credits formatted with thousands separator", () => {
    render(<WorkspaceTopBar />);
    expect(screen.getByText(/1,234/)).toBeInTheDocument();
  });

  it("enters rename mode on click and commits on Enter", () => {
    render(<WorkspaceTopBar />);
    const nameButton = screen.getByText("My Project");
    fireEvent.click(nameButton);
    const input = screen.getByDisplayValue("My Project") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "Renamed" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(screen.queryByDisplayValue("Renamed")).not.toBeInTheDocument();
  });
});
