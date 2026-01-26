import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import * as fc from 'fast-check';

import { useVersionEditTracking } from '@features/prompt-optimizer/context/hooks/useVersionEditTracking';

describe('useVersionEditTracking', () => {
  describe('error handling', () => {
    it('skips edits when the text does not change', () => {
      const { result } = renderHook(() => useVersionEditTracking());

      act(() => {
        result.current.registerPromptEdit({
          previousText: 'same',
          nextText: 'same',
        });
      });

      expect(result.current.versionEditCountRef.current).toBe(0);
      expect(result.current.versionEditsRef.current).toHaveLength(0);
    });

    it('clears edits when reset is called', () => {
      const { result } = renderHook(() => useVersionEditTracking());

      act(() => {
        result.current.registerPromptEdit({
          previousText: 'old',
          nextText: 'new',
          source: 'manual',
        });
        result.current.resetVersionEdits();
      });

      expect(result.current.versionEditCountRef.current).toBe(0);
      expect(result.current.versionEditsRef.current).toHaveLength(0);
    });
  });

  describe('edge cases', () => {
    it('keeps only the most recent 50 edits', () => {
      const { result } = renderHook(() => useVersionEditTracking());

      act(() => {
        for (let index = 0; index < 51; index += 1) {
          result.current.registerPromptEdit({
            previousText: `old-${index}`,
            nextText: `new-${index}`,
            source: 'manual',
          });
        }
      });

      expect(result.current.versionEditsRef.current).toHaveLength(50);
      expect(result.current.versionEditCountRef.current).toBe(51);
    });

    it('records deltas that match length differences (property-based)', () => {
      const { result } = renderHook(() => useVersionEditTracking());

      fc.assert(
        fc.property(fc.string(), fc.string(), (previousText, nextText) => {
          if (previousText === nextText) {
            return;
          }

          act(() => {
            result.current.resetVersionEdits();
            result.current.registerPromptEdit({ previousText, nextText });
          });

          const lastEdit = result.current.versionEditsRef.current[0];
          expect(lastEdit?.delta).toBe(nextText.length - previousText.length);
        })
      );
    });
  });

  describe('core behavior', () => {
    it('increments the edit count and records metadata', () => {
      const { result } = renderHook(() => useVersionEditTracking());

      act(() => {
        result.current.registerPromptEdit({
          previousText: 'short',
          nextText: 'a little longer',
          source: 'suggestion',
        });
      });

      expect(result.current.versionEditCountRef.current).toBe(1);
      expect(result.current.versionEditsRef.current[0]).toEqual(
        expect.objectContaining({
          delta: 'a little longer'.length - 'short'.length,
          source: 'suggestion',
        })
      );
    });
  });
});
