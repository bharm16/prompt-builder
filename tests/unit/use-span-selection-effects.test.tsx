import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { RefObject } from 'react';

import { useSpanSelectionEffects } from '@features/prompt-optimizer/PromptCanvas/hooks/useSpanSelectionEffects';

const createEditorWithSpans = () => {
  const editor = document.createElement('div');
  const spanA = document.createElement('span');
  spanA.className = 'value-word';
  spanA.dataset.spanId = 'span-1';
  spanA.textContent = 'hello';

  const spanB = document.createElement('span');
  spanB.className = 'value-word';
  spanB.dataset.spanId = 'span-2';
  spanB.textContent = 'world';

  editor.appendChild(spanA);
  editor.appendChild(spanB);
  return { editor, spanA, spanB };
};

describe('useSpanSelectionEffects', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-01T00:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('marks selected span and dims others', () => {
    const { editor, spanA, spanB } = createEditorWithSpans();
    const editorRef = { current: editor } as RefObject<HTMLElement>;
    const setState = vi.fn();

    const { rerender } = renderHook(useSpanSelectionEffects, {
      initialProps: {
        editorRef,
        enableMLHighlighting: true,
        selectedSpanId: null as string | null,
        displayedPrompt: 'Hello world',
        setState,
      },
    });

    act(() => {
      rerender({
        editorRef,
        enableMLHighlighting: true,
        selectedSpanId: 'span-1',
        displayedPrompt: 'Hello world',
        setState,
      });
    });

    expect(spanA.classList.contains('border-2')).toBe(true);
    expect(spanA.classList.contains('ring-4')).toBe(true);
    expect(spanA.classList.contains('ring-[var(--highlight-ring)]')).toBe(true);
    expect(spanA.classList.contains('z-10')).toBe(true);
    expect(spanA.dataset.open).toBe('true');
    expect(spanB.classList.contains('opacity-40')).toBe(true);
  });

  it('tracks swap timing and clears classes after delay', () => {
    const { editor, spanA } = createEditorWithSpans();
    const editorRef = { current: editor } as RefObject<HTMLElement>;
    const setState = vi.fn();

    const { rerender } = renderHook(useSpanSelectionEffects, {
      initialProps: {
        editorRef,
        enableMLHighlighting: true,
        selectedSpanId: 'span-1',
        displayedPrompt: 'Prompt A',
        setState,
      },
    });

    act(() => {
      rerender({
        editorRef,
        enableMLHighlighting: true,
        selectedSpanId: 'span-1',
        displayedPrompt: 'Prompt B',
        setState,
      });
    });

    expect(setState).toHaveBeenCalledWith({
      lastSwapTime: new Date('2024-01-01T00:00:00Z').getTime(),
    });

    expect(spanA.classList.contains('ps-animate-span-swap')).toBe(true);

    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(spanA.classList.contains('ps-animate-span-swap')).toBe(false);

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(setState).toHaveBeenCalledWith({ lastSwapTime: null });
  });
});
