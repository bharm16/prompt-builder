import { createRef } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PromptEditorSurface } from "../PromptEditorSurface";
import type { PromptEditorSurfaceProps } from "../PromptEditorSurface";

const noop = (): void => {};

function makeProps(
  overrides: Partial<PromptEditorSurfaceProps> = {},
): PromptEditorSurfaceProps {
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
    ...overrides,
  };
}

describe("PromptEditorSurface", () => {
  it("renders the prompt editor with a placeholder", () => {
    const { container } = render(<PromptEditorSurface {...makeProps()} />);
    const editor = container.querySelector("[data-placeholder]");
    expect(editor).not.toBeNull();
    expect(editor?.getAttribute("data-placeholder") ?? "").toMatch(
      /describe a video/i,
    );
  });

  it("does not render the suggestion tray when no span is selected", () => {
    render(<PromptEditorSurface {...makeProps()} />);
    expect(
      screen.queryByTestId("canvas-suggestion-tray"),
    ).not.toBeInTheDocument();
  });

  it("renders the suggestion tray when a span is selected", () => {
    render(
      <PromptEditorSurface {...makeProps({ selectedSpanId: "span-1" })} />,
    );
    expect(screen.getByTestId("canvas-suggestion-tray")).toBeInTheDocument();
  });
});
