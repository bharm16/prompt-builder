import { createRef } from "react";
import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { UnifiedCanvasPromptBar } from "../UnifiedCanvasPromptBar";
import type { PromptEditorSurfaceProps } from "../PromptEditorSurface";
import type { WorkspaceMoment } from "../../utils/computeWorkspaceMoment";

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

const MOMENTS: WorkspaceMoment[] = ["empty", "drafting", "rendering", "ready"];

describe("composer layout regression — no reflow between WorkspaceMoments", () => {
  it("the wrapper class list is identical across all 4 moments", () => {
    const classes = MOMENTS.map((moment) => {
      const { container, unmount } = render(
        <UnifiedCanvasPromptBar
          moment={moment}
          surfaceProps={makeSurfaceProps()}
        />,
      );
      const cls = (container.firstChild as HTMLElement).className;
      unmount();
      return cls;
    });
    // All four moments produce the same wrapper className.
    expect(new Set(classes).size).toBe(1);
  });

  it("the wrapper has position:absolute styling regardless of moment", () => {
    for (const moment of MOMENTS) {
      const { container, unmount } = render(
        <UnifiedCanvasPromptBar
          moment={moment}
          surfaceProps={makeSurfaceProps()}
        />,
      );
      expect((container.firstChild as HTMLElement).className).toMatch(
        /absolute/,
      );
      unmount();
    }
  });
});
