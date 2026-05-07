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

  it("does NOT fire (and does NOT preventDefault) when Cmd+K originates inside an INPUT", () => {
    dispatchPromptFocusIntent.mockClear();
    renderHook(() => useWorkspaceKeyboardShortcuts());
    const input = document.createElement("input");
    document.body.appendChild(input);
    input.focus();
    const event = new KeyboardEvent("keydown", {
      key: "k",
      metaKey: true,
      bubbles: true,
      cancelable: true,
    });
    input.dispatchEvent(event);
    expect(dispatchPromptFocusIntent).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
    document.body.removeChild(input);
  });

  it("does NOT fire when Cmd+K originates inside a contenteditable surface", () => {
    dispatchPromptFocusIntent.mockClear();
    renderHook(() => useWorkspaceKeyboardShortcuts());
    const editor = document.createElement("div");
    // Set the attribute explicitly — jsdom doesn't always reflect the
    // property assignment back to an attribute, but `closest()` reads the
    // attribute. The production hook checks both forms.
    editor.setAttribute("contenteditable", "true");
    document.body.appendChild(editor);
    editor.focus();
    const event = new KeyboardEvent("keydown", {
      key: "k",
      metaKey: true,
      bubbles: true,
      cancelable: true,
    });
    editor.dispatchEvent(event);
    expect(dispatchPromptFocusIntent).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
    document.body.removeChild(editor);
  });

  it("does NOT fire when Cmd+K originates inside a NESTED element of a contenteditable region", () => {
    // Real PromptEditor users may have spans / formatted children inside
    // the editable div — the keydown target is the inner span, not the
    // editable div. The closest("[contenteditable]") path catches this.
    dispatchPromptFocusIntent.mockClear();
    renderHook(() => useWorkspaceKeyboardShortcuts());
    const editor = document.createElement("div");
    editor.setAttribute("contenteditable", "true");
    const inner = document.createElement("span");
    inner.textContent = "hello";
    editor.appendChild(inner);
    document.body.appendChild(editor);
    const event = new KeyboardEvent("keydown", {
      key: "k",
      metaKey: true,
      bubbles: true,
      cancelable: true,
    });
    inner.dispatchEvent(event);
    expect(dispatchPromptFocusIntent).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
    document.body.removeChild(editor);
  });

  it("does NOT fire when Cmd+K originates inside a TEXTAREA", () => {
    dispatchPromptFocusIntent.mockClear();
    renderHook(() => useWorkspaceKeyboardShortcuts());
    const textarea = document.createElement("textarea");
    document.body.appendChild(textarea);
    textarea.focus();
    const event = new KeyboardEvent("keydown", {
      key: "k",
      metaKey: true,
      bubbles: true,
      cancelable: true,
    });
    textarea.dispatchEvent(event);
    expect(dispatchPromptFocusIntent).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
    document.body.removeChild(textarea);
  });
});
