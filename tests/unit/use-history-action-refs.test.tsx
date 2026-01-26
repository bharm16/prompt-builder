import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';

import { useHistoryActionRefs } from '@features/prompt-optimizer/context/hooks/useHistoryActionRefs';

describe('useHistoryActionRefs', () => {
  describe('error handling', () => {
    it('initializes isApplyingHistoryRef to false', () => {
      const { result } = renderHook(() => useHistoryActionRefs());

      expect(result.current.isApplyingHistoryRef.current).toBe(false);
    });

    it('initializes skipLoadFromUrlRef to false', () => {
      const { result } = renderHook(() => useHistoryActionRefs());

      expect(result.current.skipLoadFromUrlRef.current).toBe(false);
    });

    it('keeps flags isolated from each other', () => {
      const { result } = renderHook(() => useHistoryActionRefs());

      act(() => {
        result.current.isApplyingHistoryRef.current = true;
      });

      expect(result.current.isApplyingHistoryRef.current).toBe(true);
      expect(result.current.skipLoadFromUrlRef.current).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('preserves manual flag updates across rerenders', () => {
      const { result, rerender } = renderHook(() => useHistoryActionRefs());

      act(() => {
        result.current.skipLoadFromUrlRef.current = true;
      });

      rerender();

      expect(result.current.skipLoadFromUrlRef.current).toBe(true);
    });
  });

  describe('core behavior', () => {
    it('returns stable ref instances across renders', () => {
      const { result, rerender } = renderHook(() => useHistoryActionRefs());
      const firstIsApplyingRef = result.current.isApplyingHistoryRef;
      const firstSkipLoadRef = result.current.skipLoadFromUrlRef;

      rerender();

      expect(result.current.isApplyingHistoryRef).toBe(firstIsApplyingRef);
      expect(result.current.skipLoadFromUrlRef).toBe(firstSkipLoadRef);
    });
  });
});
