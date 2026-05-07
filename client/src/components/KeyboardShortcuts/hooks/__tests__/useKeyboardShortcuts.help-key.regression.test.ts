import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { useKeyboardShortcuts } from "../useKeyboardShortcuts";

// Regression: ISSUE-32
//
// Invariant: pressing `?` (Shift+/) anywhere outside an editable region opens
// the shortcuts modal — that's the discoverable convention used across most
// keyboard-friendly web apps. The handler must NOT intercept `?` typed inside
// contenteditable / input / textarea elements, otherwise the user can't type a
// literal `?` into their prompt.
//
// Live observation (2026-04-30): pressing `?` while focused on the canvas
// did nothing — the binding wasn't wired. Cmd+K worked but is not the
// expected discoverability key.

describe("regression: '?' opens the shortcuts modal (ISSUE-32)", () => {
  let editableHost: HTMLDivElement;

  beforeEach(() => {
    editableHost = document.createElement("div");
    // Use setAttribute for JSDOM compatibility — IDL .contentEditable doesn't
    // always round-trip through the DOM in test environments.
    editableHost.setAttribute("contenteditable", "true");
    document.body.appendChild(editableHost);
  });

  afterEach(() => {
    document.body.removeChild(editableHost);
  });

  it("invokes openShortcuts and prevents default when '?' is pressed on a non-editable target", () => {
    const openShortcuts = vi.fn();
    renderHook(() => useKeyboardShortcuts({ openShortcuts }));

    const event = new KeyboardEvent("keydown", {
      key: "?",
      bubbles: true,
      cancelable: true,
    });
    document.body.dispatchEvent(event);

    expect(openShortcuts).toHaveBeenCalledTimes(1);
    // The handler claims the keystroke when it acts on it.
    expect(event.defaultPrevented).toBe(true);
  });

  it("does NOT invoke openShortcuts (and does NOT preventDefault) when '?' is pressed inside a contenteditable", () => {
    const openShortcuts = vi.fn();
    renderHook(() => useKeyboardShortcuts({ openShortcuts }));

    const event = new KeyboardEvent("keydown", {
      key: "?",
      bubbles: true,
      cancelable: true,
    });
    editableHost.dispatchEvent(event);

    expect(openShortcuts).not.toHaveBeenCalled();
    // Load-bearing invariant: users must be able to type a literal `?` into
    // the prompt editor. If the handler ever called preventDefault here, the
    // keystroke would be swallowed and the character would never reach the
    // editor — even with `openShortcuts` correctly suppressed.
    expect(event.defaultPrevented).toBe(false);
  });

  it("does NOT invoke openShortcuts (and does NOT preventDefault) when '?' is pressed inside an <input>", () => {
    const input = document.createElement("input");
    document.body.appendChild(input);
    const openShortcuts = vi.fn();
    renderHook(() => useKeyboardShortcuts({ openShortcuts }));

    const event = new KeyboardEvent("keydown", {
      key: "?",
      bubbles: true,
      cancelable: true,
    });
    input.dispatchEvent(event);

    expect(openShortcuts).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
    document.body.removeChild(input);
  });

  it("ignores '?' when combined with a modifier (Cmd/Ctrl/Alt) — those are reserved for future bindings", () => {
    const openShortcuts = vi.fn();
    renderHook(() => useKeyboardShortcuts({ openShortcuts }));

    for (const modifier of [
      { metaKey: true },
      { ctrlKey: true },
      { altKey: true },
    ] as const) {
      const event = new KeyboardEvent("keydown", {
        key: "?",
        bubbles: true,
        cancelable: true,
        ...modifier,
      });
      document.body.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(false);
    }

    expect(openShortcuts).not.toHaveBeenCalled();
  });

  it("treats nested children of a contenteditable host as editable too", () => {
    // Future-proofing for rich-text editor frameworks (Slate/Tiptap/Lexical)
    // that render the contenteditable on a parent and dispatch keydown from
    // a leaf node. The `closest()`-based guard must walk up the DOM, not
    // just inspect the direct target.
    const inner = document.createElement("span");
    editableHost.appendChild(inner);
    const openShortcuts = vi.fn();
    renderHook(() => useKeyboardShortcuts({ openShortcuts }));

    const event = new KeyboardEvent("keydown", {
      key: "?",
      bubbles: true,
      cancelable: true,
    });
    inner.dispatchEvent(event);

    expect(openShortcuts).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
  });

  it("preserves the existing Cmd+K binding for openShortcuts", () => {
    const openShortcuts = vi.fn();
    renderHook(() => useKeyboardShortcuts({ openShortcuts }));

    // Assume non-Mac for keyboard test stability — uses ctrlKey.
    const event = new KeyboardEvent("keydown", {
      key: "k",
      ctrlKey: true,
      metaKey: true, // covers Mac path too
      bubbles: true,
      cancelable: true,
    });
    document.body.dispatchEvent(event);

    expect(openShortcuts).toHaveBeenCalledTimes(1);
  });
});
