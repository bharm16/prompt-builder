import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import type { RefObject, MouseEvent as ReactMouseEvent } from 'react';

import { useLockedSpanInteractions } from '@features/prompt-optimizer/PromptCanvas/hooks/useLockedSpanInteractions';
import type { HighlightSpan } from '@features/span-highlighting/hooks/useHighlightRendering';
import type { LockedSpan } from '@features/prompt-optimizer/types';

const createEditorElements = () => {
  const editor = document.createElement('div');
  const wrapper = document.createElement('div');
  const lockButton = document.createElement('button');

  const span = document.createElement('span');
  span.className = 'value-word';
  span.dataset.spanId = 'span-1';
  span.textContent = 'hello';
  editor.appendChild(span);

  return { editor, wrapper, lockButton, span };
};

describe('useLockedSpanInteractions', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  it('tracks hover state and schedules hide on mouse leave', () => {
    const { editor, wrapper, lockButton, span } = createEditorElements();
    const setHoveredSpanId = vi.fn();

    const editorRef = { current: editor } as RefObject<HTMLElement>;
    const editorWrapperRef = { current: wrapper } as RefObject<HTMLDivElement | null>;
    const lockButtonRef = { current: lockButton } as RefObject<HTMLButtonElement | null>;

    const parseResultSpans: HighlightSpan[] = [
      { id: 'span-1', start: 0, end: 5, quote: 'hello' },
    ];

    const { result } = renderHook(() =>
      useLockedSpanInteractions({
        editorRef,
        editorWrapperRef,
        lockButtonRef,
        enableMLHighlighting: true,
        showHighlights: true,
        hoveredSpanId: null,
        setHoveredSpanId,
        parseResultSpans,
        lockedSpans: [],
        addLockedSpan: vi.fn(),
        removeLockedSpan: vi.fn(),
        highlightFingerprint: 'fingerprint',
        displayedPrompt: 'Prompt',
      })
    );

    act(() => {
      const event = { target: span } as unknown as ReactMouseEvent;
      result.current.handleHighlightMouseEnter(event);
    });

    expect(setHoveredSpanId).toHaveBeenCalledWith('span-1');

    act(() => {
      const event = { relatedTarget: null } as unknown as ReactMouseEvent;
      result.current.handleHighlightMouseLeave(event);
      vi.advanceTimersByTime(2000);
    });

    expect(setHoveredSpanId).toHaveBeenCalledWith(null);
  });

  it('adds locked class and toggles lock state', async () => {
    const { editor, wrapper, lockButton, span } = createEditorElements();
    const addLockedSpan = vi.fn();
    const removeLockedSpan = vi.fn();

    const editorRef = { current: editor } as RefObject<HTMLElement>;
    const editorWrapperRef = { current: wrapper } as RefObject<HTMLDivElement | null>;
    const lockButtonRef = { current: lockButton } as RefObject<HTMLButtonElement | null>;

    const parseResultSpans: HighlightSpan[] = [
      { id: 'span-1', start: 0, end: 5, quote: 'hello' },
    ];

    const lockedSpans: LockedSpan[] = [
      { id: 'span-1', text: 'hello', leftCtx: '', rightCtx: '' },
    ];

    const { result } = renderHook(() =>
      useLockedSpanInteractions({
        editorRef,
        editorWrapperRef,
        lockButtonRef,
        enableMLHighlighting: true,
        showHighlights: true,
        hoveredSpanId: 'span-1',
        setHoveredSpanId: vi.fn(),
        parseResultSpans,
        lockedSpans,
        addLockedSpan,
        removeLockedSpan,
        highlightFingerprint: 'fingerprint',
        displayedPrompt: 'Prompt',
      })
    );

    await waitFor(() => {
      expect(span.classList.contains('value-word--locked')).toBe(true);
    });

    act(() => {
      result.current.handleToggleLock();
    });

    expect(removeLockedSpan).toHaveBeenCalledWith('span-1');
  });

  it('adds a locked span when toggling an unlocked highlight', () => {
    const { editor, wrapper, lockButton } = createEditorElements();
    const addLockedSpan = vi.fn();

    const editorRef = { current: editor } as RefObject<HTMLElement>;
    const editorWrapperRef = { current: wrapper } as RefObject<HTMLDivElement | null>;
    const lockButtonRef = { current: lockButton } as RefObject<HTMLButtonElement | null>;

    const { result } = renderHook(() =>
      useLockedSpanInteractions({
        editorRef,
        editorWrapperRef,
        lockButtonRef,
        enableMLHighlighting: true,
        showHighlights: true,
        hoveredSpanId: 'span-1',
        setHoveredSpanId: vi.fn(),
        parseResultSpans: [{ id: 'span-1', start: 0, end: 5, quote: 'hello' }],
        lockedSpans: [],
        addLockedSpan,
        removeLockedSpan: vi.fn(),
        highlightFingerprint: 'fingerprint',
        displayedPrompt: 'Prompt',
      })
    );

    act(() => {
      result.current.handleToggleLock();
    });

    expect(addLockedSpan).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'span-1', text: 'hello' })
    );
  });

  it('computes lock button position based on span bounds', async () => {
    const { editor, wrapper, lockButton, span } = createEditorElements();
    const editorRef = { current: editor } as RefObject<HTMLElement>;
    const editorWrapperRef = { current: wrapper } as RefObject<HTMLDivElement | null>;
    const lockButtonRef = { current: lockButton } as RefObject<HTMLButtonElement | null>;

    wrapper.getBoundingClientRect = vi.fn(() => ({
      top: 0,
      left: 0,
      width: 200,
      height: 100,
      right: 200,
      bottom: 100,
      x: 0,
      y: 0,
      toJSON: () => '',
    }));

    span.getBoundingClientRect = vi.fn(() => ({
      top: 10,
      left: 50,
      width: 20,
      height: 10,
      right: 70,
      bottom: 20,
      x: 50,
      y: 10,
      toJSON: () => '',
    }));

    const { result } = renderHook(() =>
      useLockedSpanInteractions({
        editorRef,
        editorWrapperRef,
        lockButtonRef,
        enableMLHighlighting: true,
        showHighlights: true,
        hoveredSpanId: 'span-1',
        setHoveredSpanId: vi.fn(),
        parseResultSpans: [{ id: 'span-1', start: 0, end: 5, quote: 'hello' }],
        lockedSpans: [],
        addLockedSpan: vi.fn(),
        removeLockedSpan: vi.fn(),
        highlightFingerprint: 'fingerprint',
        displayedPrompt: 'Prompt',
      })
    );

    await waitFor(() => {
      expect(result.current.lockButtonPosition).toEqual({ top: 10, left: 60 });
    });
  });
});
