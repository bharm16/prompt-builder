import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { RefObject } from 'react';

import { useEditorContent } from '@features/prompt-optimizer/PromptCanvas/hooks/useEditorContent';
import { getSelectionOffsets, restoreSelectionFromOffsets } from '@features/prompt-optimizer/utils/textSelection';

vi.mock('@features/prompt-optimizer/utils/textSelection', () => ({
  getSelectionOffsets: vi.fn(),
  restoreSelectionFromOffsets: vi.fn(),
}));

const mockGetSelectionOffsets = vi.mocked(getSelectionOffsets);
const mockRestoreSelectionFromOffsets = vi.mocked(restoreSelectionFromOffsets);

describe('useEditorContent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('clears editor content in plain-text mode when prompt is empty', () => {
    const editor = document.createElement('div');
    editor.textContent = 'Existing text';
    document.body.appendChild(editor);
    const editorRef = { current: editor } as unknown as RefObject<HTMLElement>;

    renderHook(() =>
      useEditorContent({
        editorRef,
        editorText: '',
        formattedHTML: '',
        renderHtml: false,
      })
    );

    expect(editor.textContent).toBe('');
  });

  it('updates HTML and restores selection when editor is focused', () => {
    const editor = document.createElement('div');
    editor.tabIndex = -1;
    const textNode = document.createTextNode('Old text');
    editor.appendChild(textNode);
    document.body.appendChild(editor);
    editor.focus();

    const range = document.createRange();
    range.setStart(textNode, 0);
    range.setEnd(textNode, 3);

    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);

    mockGetSelectionOffsets.mockReturnValue({ start: 1, end: 3 });

    const editorRef = { current: editor } as unknown as RefObject<HTMLElement>;

    renderHook(() =>
      useEditorContent({
        editorRef,
        editorText: 'New text',
        formattedHTML: '<p>New text</p>',
        renderHtml: true,
      })
    );

    expect(editor.innerHTML).toBe('<p>New text</p>');
    expect(mockGetSelectionOffsets).toHaveBeenCalledWith(editor, range);
    expect(mockRestoreSelectionFromOffsets).toHaveBeenCalledWith(editor, 1, 3);
  });
});
