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
  displayedPrompt: string | null;
  formattedHTML: string;
}

/**
 * Manages editor content synchronization and cursor position preservation.
 */
export function useEditorContent({
  editorRef,
  displayedPrompt,
  formattedHTML,
}: UseEditorContentOptions): void {
  useLayoutEffect(() => {
    if (editorRef.current && displayedPrompt) {
      const newHTML = formattedHTML || displayedPrompt;

      // Only update if content has actually changed to preserve cursor position
      const currentText = editorRef.current.innerText || editorRef.current.textContent || '';
      const newText = displayedPrompt;

      if (currentText !== newText) {
        const selection = window.getSelection();
        const hadFocus = document.activeElement === editorRef.current;
        let savedOffsets: { start: number; end: number } | null = null;

        // Try to save cursor selection offsets when focus is within the editor
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

        // Set the HTML content
        editorRef.current.innerHTML = newHTML;

        // Restore focus and cursor if it had focus before
        if (hadFocus) {
          try {
            editorRef.current.focus();
            if (savedOffsets) {
              restoreSelectionFromOffsets(
                editorRef.current,
                savedOffsets.start,
                savedOffsets.end
              );
            }
          } catch {
            // Ignore focus errors
          }
        }
      }
    } else if (editorRef.current && !displayedPrompt) {
      editorRef.current.innerHTML =
        '<p style="color: var(--text-muted); font-size: var(--fs-14); line-height: var(--lh-relaxed); font-family: var(--font-sans);">Your optimized prompt will appear here…</p>';
    }
  }, [editorRef, displayedPrompt, formattedHTML]);
}
