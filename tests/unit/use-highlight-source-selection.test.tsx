import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';

import { useHighlightSourceSelection } from '@features/span-highlighting/hooks/useHighlightSourceSelection';
import { createHighlightSignature } from '@features/span-highlighting/hooks/useSpanLabeling';
import type { HighlightSnapshot } from '@features/prompt-optimizer/PromptCanvas/types';

vi.mock('@features/span-highlighting/hooks/useSpanLabeling', () => ({
  createHighlightSignature: vi.fn(() => 'sig-generated'),
}));

const mockCreateHighlightSignature = vi.mocked(createHighlightSignature);

describe('useHighlightSourceSelection', () => {
  describe('error handling', () => {
    it('returns null when ML highlighting is disabled', () => {
      const { result } = renderHook(() =>
        useHighlightSourceSelection({
          draftSpans: null,
          refinedSpans: null,
          isDraftReady: false,
          isRefining: false,
          initialHighlights: null,
          promptUuid: null,
          displayedPrompt: 'Hello',
          enableMLHighlighting: false,
          initialHighlightsVersion: 0,
        })
      );

      expect(result.current).toBeNull();
    });
  });

  describe('edge cases', () => {
    it('prefers draft spans when draft data is ready', () => {
      const { result } = renderHook(() =>
        useHighlightSourceSelection({
          draftSpans: { spans: [{ start: 0, end: 5, category: 'subject', confidence: 0.9 }], meta: null, source: 'draft', timestamp: 0 },
          refinedSpans: null,
          isDraftReady: true,
          isRefining: false,
          initialHighlights: null,
          promptUuid: 'uuid-1',
          displayedPrompt: 'Hello world',
          enableMLHighlighting: true,
          initialHighlightsVersion: 0,
        })
      );

      expect(result.current?.source).toBe('draft');
      expect(result.current?.signature).toBe('sig-generated');
      expect(result.current?.cacheId).toBe('uuid-1');
      expect(mockCreateHighlightSignature).toHaveBeenCalledWith('Hello world');
    });

    it('prefers refined spans when refinement is complete', () => {
      const { result } = renderHook(() =>
        useHighlightSourceSelection({
          draftSpans: { spans: [], meta: null, source: 'draft', timestamp: 0 },
          refinedSpans: { spans: [{ start: 0, end: 5, category: 'style', confidence: 0.8 }], meta: null, source: 'refined', timestamp: 0 },
          isDraftReady: true,
          isRefining: false,
          initialHighlights: null,
          promptUuid: 'uuid-2',
          displayedPrompt: 'Refined text',
          enableMLHighlighting: true,
          initialHighlightsVersion: 0,
        })
      );

      expect(result.current?.source).toBe('refined');
      expect(result.current?.signature).toBe('sig-generated');
      expect(result.current?.cacheId).toBe('uuid-2');
    });
  });

  describe('core behavior', () => {
    it('uses persisted highlights when a local update is present', () => {
      const initialHighlights: HighlightSnapshot = {
        spans: [{ start: 0, end: 4, category: 'subject', confidence: 0.9 }],
        meta: { localUpdate: true },
      };

      const { result } = renderHook(() =>
        useHighlightSourceSelection({
          draftSpans: { spans: [{ start: 0, end: 5, category: 'style', confidence: 0.9 }], meta: null, source: 'draft', timestamp: 0 },
          refinedSpans: null,
          isDraftReady: true,
          isRefining: false,
          initialHighlights,
          promptUuid: 'uuid-3',
          displayedPrompt: 'Snap',
          enableMLHighlighting: true,
          initialHighlightsVersion: 1,
        })
      );

      expect(result.current?.source).toBe('persisted');
      expect(result.current?.signature).toBe('sig-generated');
      expect(result.current?.cacheId).toBe('uuid-3');
      expect(mockCreateHighlightSignature).toHaveBeenCalledWith('Snap');
    });
  });
});
