import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const dispatchPromptFocusIntent = vi.fn();
vi.mock("../../events", () => ({
  dispatchPromptFocusIntent: (...args: unknown[]) =>
    dispatchPromptFocusIntent(...args),
}));

import { useWorkspaceKeyboardShortcuts } from "../useWorkspaceKeyboardShortcuts";

describe("useWorkspaceKeyboardShortcuts", () => {
  it("focuses the composer on Cmd+K", () => {
    renderHook(() => useWorkspaceKeyboardShortcuts());
    const event = new KeyboardEvent("keydown", { key: "k", metaKey: true });
    window.dispatchEvent(event);
    expect(dispatchPromptFocusIntent).toHaveBeenCalled();
  });

  it("focuses the composer on Ctrl+K (cross-platform)", () => {
    dispatchPromptFocusIntent.mockClear();
    renderHook(() => useWorkspaceKeyboardShortcuts());
    const event = new KeyboardEvent("keydown", { key: "k", ctrlKey: true });
    window.dispatchEvent(event);
    expect(dispatchPromptFocusIntent).toHaveBeenCalled();
  });

  it("ignores plain K", () => {
    dispatchPromptFocusIntent.mockClear();
    renderHook(() => useWorkspaceKeyboardShortcuts());
    const event = new KeyboardEvent("keydown", { key: "k" });
    window.dispatchEvent(event);
    expect(dispatchPromptFocusIntent).not.toHaveBeenCalled();
  });
});
