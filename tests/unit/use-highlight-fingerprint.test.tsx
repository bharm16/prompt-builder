import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';

import { useHighlightFingerprint } from '@features/span-highlighting/hooks/useHighlightFingerprint';
import { createHighlightSignature } from '@features/span-highlighting/hooks/useSpanLabeling';
import type { ParseResult } from '@features/span-highlighting/hooks/types';

vi.mock('@features/span-highlighting/hooks/useSpanLabeling', () => ({
  createHighlightSignature: vi.fn(() => 'sig-base'),
}));

const mockCreateHighlightSignature = vi.mocked(createHighlightSignature);

describe('useHighlightFingerprint', () => {
  describe('error handling', () => {
    it('returns null when disabled', () => {
      const parseResult: ParseResult = {
        displayText: 'Hello',
        spans: [{ id: '1', start: 0, end: 5, category: 'subject' }],
      };

      const { result } = renderHook(() => useHighlightFingerprint(false, parseResult));

      expect(result.current).toBeNull();
    });
  });

  describe('edge cases', () => {
    it('returns an empty fingerprint when no spans exist', () => {
      const parseResult: ParseResult = {
        displayText: 'Hello',
        spans: [],
      };

      const { result } = renderHook(() => useHighlightFingerprint(true, parseResult));

      expect(result.current).toBe('empty::sig-base');
      expect(mockCreateHighlightSignature).toHaveBeenCalledWith('Hello');
    });
  });

  describe('core behavior', () => {
    it('combines text and span signatures into a single fingerprint', () => {
      const parseResult: ParseResult = {
        displayText: 'Hello world',
        spans: [
          { id: 'span-1', displayStart: 0, displayEnd: 5, category: 'subject' },
          { start: 6, end: 11, category: 'action' },
        ],
      };

      const { result } = renderHook(() => useHighlightFingerprint(true, parseResult));

      expect(result.current).toBe('sig-base::span-1:0:5:subject|:6:11:action');
    });
  });
});
