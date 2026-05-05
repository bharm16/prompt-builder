import { createRef } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { UnifiedCanvasPromptBar } from "../UnifiedCanvasPromptBar";
import type { PromptEditorSurfaceProps } from "../PromptEditorSurface";

const noop = () => {};

function makeSurfaceProps(): PromptEditorSurfaceProps {
  return {
    editorRef: createRef<HTMLDivElement>(),
    prompt: "",
    onTextSelection: noop,
    onHighlightClick: noop,
    onHighlightMouseDown: noop,
    onHighlightMouseEnter: noop,
    onHighlightMouseLeave: noop,
    onCopyEvent: noop,
    onInput: noop,
    onEditorKeyDown: noop,
    onEditorBlur: noop,
    autocompleteOpen: false,
    autocompleteSuggestions: [],
    autocompleteSelectedIndex: -1,
    autocompletePosition: { top: 0, left: 0 },
    autocompleteLoading: false,
    onAutocompleteSelect: noop,
    onAutocompleteClose: noop,
    onAutocompleteIndexChange: noop,
    selectedSpanId: null,
    suggestionCount: 0,
    suggestionsListRef: createRef<HTMLDivElement>(),
    inlineSuggestions: [],
    activeSuggestionIndex: -1,
    onActiveSuggestionChange: noop,
    interactionSourceRef: { current: "auto" },
    onSuggestionClick: noop,
    onCloseInlinePopover: noop,
    selectionLabel: "",
    onApplyActiveSuggestion: noop,
    isInlineLoading: false,
    isInlineError: false,
    inlineErrorMessage: "",
    isInlineEmpty: false,
    customRequest: "",
    onCustomRequestChange: noop,
    customRequestError: "",
    onCustomRequestErrorChange: noop,
    onCustomRequestSubmit: vi.fn((e) => e.preventDefault()),
    isCustomRequestDisabled: false,
    isCustomLoading: false,
    showI2VLockIndicator: false,
    resolvedI2VReason: null,
    i2vMotionAlternatives: [],
    onLockedAlternativeClick: noop,
  };
}

describe("UnifiedCanvasPromptBar", () => {
  it("renders as a floating dock with absolute positioning", () => {
    const { container } = render(
      <UnifiedCanvasPromptBar
        moment="empty"
        surfaceProps={makeSurfaceProps()}
      />,
    );
    const root = container.firstChild as HTMLElement;
    expect(root.className).toMatch(/absolute/);
  });

  it("renders the editor surface", () => {
    const { container } = render(
      <UnifiedCanvasPromptBar
        moment="empty"
        surfaceProps={makeSurfaceProps()}
      />,
    );
    // PromptEditor uses a contenteditable div with data-placeholder, not a real
    // <input placeholder>. Confirm via the data attribute.
    expect(
      container.querySelector('[data-placeholder*="Describe a video"]'),
    ).toBeInTheDocument();
  });

  it("does NOT change wrapper class list between moments (no reflow fork)", () => {
    const { container, rerender } = render(
      <UnifiedCanvasPromptBar
        moment="empty"
        surfaceProps={makeSurfaceProps()}
      />,
    );
    const initial = (container.firstChild as HTMLElement).className;
    rerender(
      <UnifiedCanvasPromptBar
        moment="rendering"
        surfaceProps={makeSurfaceProps()}
      />,
    );
    const rerendered = (container.firstChild as HTMLElement).className;
    expect(initial).toBe(rerendered);
  });
});
