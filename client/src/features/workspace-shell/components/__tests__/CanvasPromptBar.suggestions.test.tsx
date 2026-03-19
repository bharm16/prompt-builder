import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { CanvasPromptBar } from '../CanvasPromptBar';

vi.mock('../CanvasSettingsRow', () => ({
  CanvasSettingsRow: () => <div data-testid="canvas-settings-row-mock" />,
}));

vi.mock('@/features/prompt-optimizer/components/PromptEditor', () => ({
  PromptEditor: React.forwardRef<HTMLDivElement, Record<string, unknown>>(
    function PromptEditorMock(_, ref) {
      return <div ref={ref} data-testid="prompt-editor-mock" tabIndex={0} />;
    }
  ),
}));

const buildProps = (
  overrides: Partial<React.ComponentProps<typeof CanvasPromptBar>> = {}
): React.ComponentProps<typeof CanvasPromptBar> => ({
  editorRef: React.createRef<HTMLDivElement>() as React.RefObject<HTMLDivElement>,
  prompt: 'A moody cyberpunk street',
  onTextSelection: vi.fn(),
  onHighlightClick: vi.fn(),
  onHighlightMouseDown: vi.fn(),
  onHighlightMouseEnter: vi.fn(),
  onHighlightMouseLeave: vi.fn(),
  onCopyEvent: vi.fn(),
  onInput: vi.fn(),
  onEditorKeyDown: vi.fn(),
  onEditorBlur: vi.fn(),
  autocompleteOpen: false,
  autocompleteSuggestions: [],
  autocompleteSelectedIndex: 0,
  autocompletePosition: { top: 0, left: 0 },
  autocompleteLoading: false,
  onAutocompleteSelect: vi.fn(),
  onAutocompleteClose: vi.fn(),
  onAutocompleteIndexChange: vi.fn(),
  selectedSpanId: 'span-1',
  suggestionCount: 2,
  suggestionsListRef:
    React.createRef<HTMLDivElement>() as React.RefObject<HTMLDivElement>,
  inlineSuggestions: [
    {
      key: 'one',
      text: 'Option A',
      meta: null,
      item: { id: 's1', text: 'Option A' },
    },
    {
      key: 'two',
      text: 'Option B',
      meta: '92% match',
      item: { id: 's2', text: 'Option B' },
    },
  ],
  activeSuggestionIndex: 0,
  onActiveSuggestionChange: vi.fn(),
  interactionSourceRef: { current: 'auto' },
  onSuggestionClick: vi.fn(),
  onCloseInlinePopover: vi.fn(),
  selectionLabel: 'camera angle',
  onApplyActiveSuggestion: vi.fn(),
  isInlineLoading: false,
  isInlineError: false,
  inlineErrorMessage: 'error',
  isInlineEmpty: false,
  customRequest: '',
  onCustomRequestChange: vi.fn(),
  customRequestError: '',
  onCustomRequestErrorChange: vi.fn(),
  onCustomRequestSubmit: vi.fn(),
  isCustomRequestDisabled: true,
  isCustomLoading: false,
  showI2VLockIndicator: false,
  resolvedI2VReason: null,
  i2vMotionAlternatives: [],
  onLockedAlternativeClick: vi.fn(),
  renderModelId: 'sora-2',
  onOpenMotion: vi.fn(),
  ...overrides,
});

describe('CanvasPromptBar suggestions tray', () => {
  it('hides tray when selectedSpanId is null', () => {
    render(<CanvasPromptBar {...buildProps({ selectedSpanId: null })} />);
    expect(screen.queryByTestId('canvas-suggestion-tray')).not.toBeInTheDocument();
  });

  it('shows tray with suggestions when a span is selected', () => {
    render(<CanvasPromptBar {...buildProps()} />);
    expect(screen.getByTestId('canvas-suggestion-tray')).toBeInTheDocument();
    expect(screen.getByText('Option A')).toBeInTheDocument();
    expect(screen.getByText('Option B')).toBeInTheDocument();
  });

  it('shows loading and error states', () => {
    const { rerender } = render(
      <CanvasPromptBar {...buildProps({ isInlineLoading: true, suggestionCount: 0, inlineSuggestions: [] })} />
    );
    expect(screen.getByTestId('canvas-suggestion-tray')).toBeInTheDocument();
    expect(screen.getByText('Replace \"camera angle\"')).toBeInTheDocument();

    rerender(
      <CanvasPromptBar
        {...buildProps({
          isInlineLoading: false,
          isInlineError: true,
          inlineErrorMessage: 'Failed to load suggestions',
          suggestionCount: 0,
          inlineSuggestions: [],
        })}
      />
    );
    expect(screen.getByText('Failed to load suggestions')).toBeInTheDocument();
  });

  it('supports custom request form error and submit', () => {
    const onCustomRequestSubmit = vi.fn((event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
    });

    render(
      <CanvasPromptBar
        {...buildProps({
          customRequest: 'make it rain',
          customRequestError: 'Too long',
          isCustomRequestDisabled: false,
          onCustomRequestSubmit,
        })}
      />
    );

    expect(screen.getByText('Too long')).toBeInTheDocument();
    const input = screen.getByLabelText('Custom suggestion request');
    const form = input.closest('form');
    expect(form).not.toBeNull();
    fireEvent.submit(form!);
    expect(onCustomRequestSubmit).toHaveBeenCalledTimes(1);
  });

  it('clicking a pill applies suggestion and closes tray', () => {
    const onSuggestionClick = vi.fn();
    const onCloseInlinePopover = vi.fn();

    render(
      <CanvasPromptBar
        {...buildProps({
          onSuggestionClick,
          onCloseInlinePopover,
        })}
      />
    );

    fireEvent.click(screen.getByText('Option A'));
    expect(onSuggestionClick).toHaveBeenCalledTimes(1);
    expect(onCloseInlinePopover).toHaveBeenCalledTimes(1);
  });

  it('supports manual collapse and auto-opens for a new selected span', () => {
    const props = buildProps();
    const { rerender } = render(<CanvasPromptBar {...props} />);

    fireEvent.click(screen.getByRole('button', { name: 'Collapse' }));
    expect(screen.queryByText('Option A')).not.toBeInTheDocument();

    rerender(<CanvasPromptBar {...props} selectedSpanId="span-2" />);
    expect(screen.getByText('Option A')).toBeInTheDocument();
  });
});
