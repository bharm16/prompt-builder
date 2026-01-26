import { describe, it, expect } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

import {
  useProgressiveSpanRendering,
  sortSpansByConfidence,
} from '@features/span-highlighting/hooks/useProgressiveSpanRendering';
import type { Span } from '@features/span-highlighting/hooks/types';

describe('useProgressiveSpanRendering', () => {
  describe('error handling', () => {
    it('returns all spans immediately when disabled', () => {
      const spans: Span[] = [
        { id: '1', start: 0, end: 2, confidence: 0.9 },
        { id: '2', start: 3, end: 5, confidence: 0.4 },
      ];

      const { result, unmount } = renderHook(() =>
        useProgressiveSpanRendering({ spans, enabled: false })
      );

      expect(result.current.visibleSpans).toEqual(spans);
      expect(result.current.progress).toBe(100);
      expect(result.current.isRendering).toBe(false);
      unmount();
    });

    it('handles empty spans by returning a complete state', () => {
      const { result, unmount } = renderHook(() =>
        useProgressiveSpanRendering({ spans: [], enabled: true })
      );

      expect(result.current.visibleSpans).toEqual([]);
      expect(result.current.progress).toBe(100);
      expect(result.current.isRendering).toBe(false);
      unmount();
    });
  });

  describe('edge cases', () => {
    it('progressively reveals spans based on confidence thresholds', async () => {
      const spans: Span[] = [
        { id: 'high', start: 0, end: 2, confidence: 0.95 },
        { id: 'medium', start: 3, end: 5, confidence: 0.7 },
        { id: 'low', start: 6, end: 8, confidence: 0.4 },
      ];

      const { result } = renderHook(() =>
        useProgressiveSpanRendering({
          spans,
          enabled: true,
          mediumConfidenceDelay: 5,
          lowConfidenceDelay: 10,
        })
      );

      expect(result.current.visibleSpans).toHaveLength(1);
      expect(result.current.isRendering).toBe(true);

      await waitFor(() => {
        expect(result.current.visibleSpans).toHaveLength(3);
      });

      expect(result.current.progress).toBe(100);
      expect(result.current.isRendering).toBe(false);
    });
  });

  describe('core behavior', () => {
    it('sorts spans by confidence in descending order', () => {
      const spans: Span[] = [
        { id: 'a', start: 0, end: 1, confidence: 0.5 },
        { id: 'b', start: 2, end: 3, confidence: 0.9 },
        { id: 'c', start: 4, end: 5 },
      ];

      const sorted = sortSpansByConfidence(spans);

      expect(sorted.map((span) => span.id)).toEqual(['b', 'c', 'a']);
    });
  });
});
