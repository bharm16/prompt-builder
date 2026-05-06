import { createRef } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CanvasPromptBar } from "../CanvasPromptBar";
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

describe("CanvasPromptBar", () => {
  it("renders as a floating dock with absolute positioning", () => {
    const { container } = render(
      <CanvasPromptBar surfaceProps={makeSurfaceProps()} />,
    );
    const root = container.firstChild as HTMLElement;
    expect(root.className).toMatch(/absolute/);
  });

  it("renders the editor surface", () => {
    const { container } = render(
      <CanvasPromptBar surfaceProps={makeSurfaceProps()} />,
    );
    // PromptEditor uses a contenteditable div with data-placeholder, not a real
    // <input placeholder>. Confirm via the data attribute.
    expect(
      container.querySelector('[data-placeholder*="Describe a video"]'),
    ).toBeInTheDocument();
  });

  it("does NOT change wrapper class list across surface state changes (no reflow fork)", () => {
    // The composer must stay structurally identical even as the editor's
    // internal state evolves (prompt fills, suggestions arrive, autocomplete
    // opens). A divergent className would cause layout reflow on every
    // keystroke. Verify by re-rendering with materially different surface
    // props and asserting the wrapper class is byte-identical.
    const empty = makeSurfaceProps();
    const filled: PromptEditorSurfaceProps = {
      ...makeSurfaceProps(),
      prompt: "a dancer in a sunlit studio",
      autocompleteOpen: true,
      isInlineLoading: true,
    };
    const { container, rerender } = render(
      <CanvasPromptBar surfaceProps={empty} />,
    );
    const initial = (container.firstChild as HTMLElement).className;
    rerender(<CanvasPromptBar surfaceProps={filled} />);
    const rerendered = (container.firstChild as HTMLElement).className;
    expect(initial).toBe(rerendered);
  });
});
