import { describe, expect, it } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import type { MutableRefObject } from 'react';

import { useCoherenceSpanMarkers } from '@features/prompt-optimizer/PromptCanvas/hooks/useCoherenceSpanMarkers';

const BASE_CLASSES = [
  'underline',
  'decoration-2',
  'underline-offset-4',
  'after:-right-1',
  'after:-top-1',
  'after:h-2',
  'after:w-2',
  'after:rounded-full',
  'after:pointer-events-none',
];

const CONFLICT_CLASSES = [
  'decoration-error',
  'decoration-wavy',
  'after:bg-error',
];

const HARMONIZATION_CLASSES = [
  'decoration-warning',
  'decoration-dotted',
  'after:bg-warning',
];

const ALL_MARKER_CLASSES = [
  ...BASE_CLASSES,
  ...CONFLICT_CLASSES,
  ...HARMONIZATION_CLASSES,
];

const createEditorWithSpan = ({
  spanId,
  classes = [],
  coherenceIssue,
}: {
  spanId?: string;
  classes?: string[];
  coherenceIssue?: 'conflict' | 'harmonization';
}) => {
  const editor = document.createElement('div');
  const span = document.createElement('span');
  span.className = 'value-word';
  if (spanId) {
    span.dataset.spanId = spanId;
  }
  if (coherenceIssue) {
    span.dataset.coherenceIssue = coherenceIssue;
  }
  classes.forEach((className) => span.classList.add(className));
  editor.appendChild(span);
  return { editor, span };
};

const expectClassesRemoved = (element: HTMLElement, classes: string[]) => {
  classes.forEach((className) => {
    expect(element.classList.contains(className)).toBe(false);
  });
};

describe('useCoherenceSpanMarkers', () => {
  describe('error handling', () => {
    it('clears coherence markers when highlighting is disabled', async () => {
      const { editor, span } = createEditorWithSpan({
        spanId: 'span-1',
        classes: [...BASE_CLASSES, ...CONFLICT_CLASSES],
        coherenceIssue: 'conflict',
      });
      const editorRef: MutableRefObject<HTMLElement | null> = { current: editor };

      renderHook((props) => useCoherenceSpanMarkers(props), {
        initialProps: {
          editorRef,
          enableMLHighlighting: false,
          showHighlights: true,
          affectedSpanIds: new Set(['span-1']),
          spanIssueMap: new Map([['span-1', 'conflict']]),
          highlightFingerprint: 'disabled',
        },
      });

      await waitFor(() => {
        expectClassesRemoved(span, ALL_MARKER_CLASSES);
        expect(span.dataset.coherenceIssue).toBeUndefined();
      });
    });

    it('clears coherence markers when spans are missing ids', async () => {
      const { editor, span } = createEditorWithSpan({
        classes: [...BASE_CLASSES, ...HARMONIZATION_CLASSES],
        coherenceIssue: 'harmonization',
      });
      const editorRef: MutableRefObject<HTMLElement | null> = { current: editor };

      renderHook((props) => useCoherenceSpanMarkers(props), {
        initialProps: {
          editorRef,
          enableMLHighlighting: true,
          showHighlights: true,
          affectedSpanIds: new Set(['span-1']),
          spanIssueMap: new Map([['span-1', 'harmonization']]),
          highlightFingerprint: 'missing-id',
        },
      });

      await waitFor(() => {
        expectClassesRemoved(span, ALL_MARKER_CLASSES);
        expect(span.dataset.coherenceIssue).toBeUndefined();
      });
    });

    it('clears coherence markers when no issue applies to a span', async () => {
      const { editor, span } = createEditorWithSpan({
        spanId: 'span-1',
        classes: [...BASE_CLASSES, ...HARMONIZATION_CLASSES],
        coherenceIssue: 'harmonization',
      });
      const editorRef: MutableRefObject<HTMLElement | null> = { current: editor };

      renderHook((props) => useCoherenceSpanMarkers(props), {
        initialProps: {
          editorRef,
          enableMLHighlighting: true,
          showHighlights: true,
          affectedSpanIds: new Set(),
          spanIssueMap: new Map(),
          highlightFingerprint: 'no-issue',
        },
      });

      await waitFor(() => {
        expectClassesRemoved(span, ALL_MARKER_CLASSES);
        expect(span.dataset.coherenceIssue).toBeUndefined();
      });
    });
  });

  describe('edge cases', () => {
    it('prefers issue map entries over affected span ids', async () => {
      const { editor, span } = createEditorWithSpan({ spanId: 'span-1' });
      const editorRef: MutableRefObject<HTMLElement | null> = { current: editor };

      renderHook((props) => useCoherenceSpanMarkers(props), {
        initialProps: {
          editorRef,
          enableMLHighlighting: true,
          showHighlights: true,
          affectedSpanIds: new Set(['span-1']),
          spanIssueMap: new Map([['span-1', 'conflict']]),
          highlightFingerprint: 'prefers-map',
        },
      });

      await waitFor(() => {
        BASE_CLASSES.forEach((className) => {
          expect(span.classList.contains(className)).toBe(true);
        });
        CONFLICT_CLASSES.forEach((className) => {
          expect(span.classList.contains(className)).toBe(true);
        });
        expectClassesRemoved(span, HARMONIZATION_CLASSES);
        expect(span.dataset.coherenceIssue).toBe('conflict');
      });
    });
  });

  describe('core behavior', () => {
    it('marks harmonization spans when affected ids are provided', async () => {
      const { editor, span } = createEditorWithSpan({ spanId: 'span-1' });
      const editorRef: MutableRefObject<HTMLElement | null> = { current: editor };

      renderHook((props) => useCoherenceSpanMarkers(props), {
        initialProps: {
          editorRef,
          enableMLHighlighting: true,
          showHighlights: true,
          affectedSpanIds: new Set(['span-1']),
          spanIssueMap: null,
          highlightFingerprint: 'harmonization',
        },
      });

      await waitFor(() => {
        BASE_CLASSES.forEach((className) => {
          expect(span.classList.contains(className)).toBe(true);
        });
        HARMONIZATION_CLASSES.forEach((className) => {
          expect(span.classList.contains(className)).toBe(true);
        });
        expectClassesRemoved(span, CONFLICT_CLASSES);
        expect(span.dataset.coherenceIssue).toBe('harmonization');
      });
    });
  });
});
