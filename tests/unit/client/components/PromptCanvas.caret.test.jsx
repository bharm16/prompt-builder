import { vi } from 'vitest';

vi.mock('../../../../client/src/components/Toast.jsx', () => ({
  useToast: () => ({
    showToast: vi.fn(),
    hideToast: vi.fn(),
    toast: null,
    success: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
    error: vi.fn(),
  }),
  ToastProvider: ({ children }) => children,
  default: () => null,
}));

import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { act } from 'react';
import { PromptCanvas } from '../../../../client/src/features/prompt-optimizer/PromptCanvas.jsx';

const baseProps = {
  inputPrompt: '',
  optimizedPrompt: '',
  qualityScore: null,
  selectedMode: 'text',
  currentMode: 'text',
  promptUuid: 'test-prompt',
  promptContext: null,
  onDisplayedPromptChange: vi.fn(),
  onSkipAnimation: vi.fn(),
  suggestionsData: { show: false },
  onFetchSuggestions: vi.fn(),
  onCreateNew: vi.fn(),
};

describe('PromptCanvas caret restoration', () => {
  it('restores the user selection after formatted HTML is re-applied', async () => {
    const initialText = 'Hello world';
    const updatedText = 'Hello wonderful world';

    const { rerender, getByRole } = render(
      <PromptCanvas
        {...baseProps}
        inputPrompt={initialText}
        displayedPrompt={initialText}
      />
    );

    const editor = getByRole('textbox', { name: /optimized prompt/i });

    await waitFor(() => {
      expect(editor.textContent).toContain(initialText);
    });

    const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
    const textNode = walker.nextNode();
    expect(textNode).toBeTruthy();

    act(() => {
      editor.focus();
      const range = document.createRange();
      range.setStart(textNode, 0);
      range.setEnd(textNode, 5);
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
    });

    // Sanity check: ensure selection captured the expected substring
    expect(window.getSelection().toString()).toBe('Hello');

    rerender(
      <PromptCanvas
        {...baseProps}
        inputPrompt={updatedText}
        displayedPrompt={updatedText}
        optimizedPrompt={updatedText}
      />
    );

    await waitFor(() => {
      expect(editor.textContent).toContain(updatedText);
    });

    await waitFor(() => {
      const selection = window.getSelection();
      expect(selection.anchorNode?.textContent).toContain(updatedText);
      expect(selection.focusNode?.textContent).toContain(updatedText);
      expect(selection.toString()).toBe('Hello');
      const offsets = [selection.anchorOffset, selection.focusOffset].sort((a, b) => a - b);
      expect(offsets).toEqual([0, 5]);
      expect(document.activeElement).toBe(editor);
    });
  });
});
