import { useCallback, useEffect, useRef } from 'react';
import type { RefObject } from 'react';

import type { PromptCanvasState } from '../types';

export interface UseSpanSelectionEffectsOptions {
  editorRef: RefObject<HTMLElement>;
  enableMLHighlighting: boolean;
  selectedSpanId: string | null;
  displayedPrompt: string | null;
  setState: (payload: Partial<PromptCanvasState>) => void;
}

export function useSpanSelectionEffects({
  editorRef,
  enableMLHighlighting,
  selectedSpanId,
  displayedPrompt,
  setState,
}: UseSpanSelectionEffectsOptions): void {
  const prevPromptRef = useRef<string | null>(null);
  const swapTimeoutRef = useRef<number | null>(null);

  const clearSwapTimeout = useCallback((): void => {
    if (swapTimeoutRef.current) {
      window.clearTimeout(swapTimeoutRef.current);
      swapTimeoutRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (
      selectedSpanId &&
      prevPromptRef.current !== null &&
      prevPromptRef.current !== displayedPrompt
    ) {
      setState({ lastSwapTime: Date.now() });
      clearSwapTimeout();
      swapTimeoutRef.current = window.setTimeout(() => {
        setState({ lastSwapTime: null });
        swapTimeoutRef.current = null;
      }, 3000);
    }
  }, [selectedSpanId, displayedPrompt, setState, clearSwapTimeout]);

  useEffect(() => {
    if (!editorRef.current || !enableMLHighlighting) return;

    const editor = editorRef.current;
    const allHighlights = editor.querySelectorAll('.value-word');

    const promptChanged =
      prevPromptRef.current !== null &&
      prevPromptRef.current !== displayedPrompt &&
      selectedSpanId !== null;

    allHighlights.forEach((highlight) => {
      const element = highlight as HTMLElement;
      const spanId = element.dataset?.spanId;

      if (selectedSpanId && spanId === selectedSpanId) {
        element.classList.add('value-word--selected');
        element.classList.remove('value-word--dimmed');
        element.dataset.open = 'true';

        if (promptChanged) {
          element.classList.add('value-word--swapped');
          setTimeout(() => {
            element.classList.remove('value-word--swapped');
          }, 300);
        }
      } else if (selectedSpanId) {
        element.classList.add('value-word--dimmed');
        element.classList.remove('value-word--selected');
        delete element.dataset.open;
      } else {
        element.classList.remove(
          'value-word--selected',
          'value-word--dimmed',
          'value-word--swapped'
        );
        delete element.dataset.open;
      }
    });

    prevPromptRef.current = displayedPrompt;
  }, [selectedSpanId, enableMLHighlighting, displayedPrompt, editorRef]);

  useEffect(() => () => clearSwapTimeout(), [clearSwapTimeout]);
}
