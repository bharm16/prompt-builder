/**
 * useEditorContent Hook
 * 
 * Handles editor content updates and cursor position management.
 * Extracted from PromptCanvas component to improve separation of concerns.
 */

import { useLayoutEffect, type RefObject } from 'react';
import { getSelectionOffsets, restoreSelectionFromOffsets } from '@features/prompt-optimizer/utils/textSelection';

export interface UseEditorContentOptions {
  editorRef: RefObject<HTMLElement>;
  editorText: string;
  formattedHTML: string;
  renderHtml: boolean;
}

/**
 * Manages editor content synchronization and cursor position preservation.
 */
export function useEditorContent({
  editorRef,
  editorText,
  formattedHTML,
  renderHtml,
}: UseEditorContentOptions): void {
  useLayoutEffect(() => {
    if (!editorRef.current) {
      return;
    }

    const currentText = editorRef.current.innerText || editorRef.current.textContent || '';
    const newText = editorText ?? '';
    if (currentText === newText) {
      return;
    }

    const selection = window.getSelection();
    const hadFocus = document.activeElement === editorRef.current;
    let savedOffsets: { start: number; end: number } | null = null;

    if (hadFocus && selection && selection.rangeCount > 0) {
      try {
        const range = selection.getRangeAt(0);
        if (
          editorRef.current.contains(range.startContainer) &&
          editorRef.current.contains(range.endContainer)
        ) {
          savedOffsets = getSelectionOffsets(editorRef.current, range);
        }
      } catch {
        savedOffsets = null;
      }
    }

    if (renderHtml) {
      editorRef.current.innerHTML = formattedHTML || newText;
    } else {
      editorRef.current.textContent = newText;
    }

    if (!hadFocus) {
      return;
    }

    try {
      editorRef.current.focus();
      if (savedOffsets) {
        restoreSelectionFromOffsets(editorRef.current, savedOffsets.start, savedOffsets.end);
      }
    } catch {
      // Ignore focus restoration errors.
    }
  }, [editorRef, editorText, formattedHTML, renderHtml]);
}
