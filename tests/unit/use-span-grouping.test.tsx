import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';

import {
  useSpanGrouping,
} from '@features/prompt-optimizer/SpanBentoGrid/hooks/useSpanGrouping';
import type { Span } from '@features/prompt-optimizer/SpanBentoGrid/components/types';
import { TAXONOMY } from '@shared/taxonomy';

const { warnSpy } = vi.hoisted(() => ({
  warnSpy: vi.fn(),
}));

vi.mock('@/services/LoggingService', () => ({
  logger: {
    child: () => ({
      warn: warnSpy,
    }),
  },
}));

describe('useSpanGrouping', () => {
  beforeEach(() => {
    warnSpy.mockClear();
  });

  describe('error handling', () => {
    it('maps unknown categories to subject and logs a warning', () => {
      const spans: Span[] = [
        { id: 's1', category: 'unknown-category', quote: 'hello', start: 2, end: 7 },
      ];

      const { result } = renderHook(() => useSpanGrouping(spans));

      expect(result.current.groups[TAXONOMY.SUBJECT.id]).toHaveLength(1);
      expect(spans[0]?._mappedTo).toBe(TAXONOMY.SUBJECT.id);
      expect(warnSpy).toHaveBeenCalledWith(
        'Unknown category mapped to subject',
        expect.objectContaining({
          categoryId: 'unknown-category',
          mappedTo: TAXONOMY.SUBJECT.id,
        })
      );
    });
  });

  describe('edge cases', () => {
    it('tracks orphaned attributes when hierarchy is enabled', () => {
      const spans: Span[] = [
        { id: 's1', category: 'subject.appearance', quote: 'coat', start: 5, end: 9 },
      ];

      const { result } = renderHook(() =>
        useSpanGrouping(spans, { enableHierarchy: true })
      );

      expect(result.current.groups[TAXONOMY.SUBJECT.id]).toHaveLength(1);
      expect(spans[0]?._isAttribute).toBe(true);
      expect(spans[0]?._parentCategory).toBe(TAXONOMY.SUBJECT.id);
      expect(result.current.hierarchyInfo?.hasOrphans).toBe(true);
      expect(result.current.hierarchyInfo?.orphanedAttributes).toHaveLength(1);
      expect(result.current.hierarchyInfo?.orphanedAttributes[0]?.missingParent).toBe(
        TAXONOMY.SUBJECT.id
      );
    });
  });

  describe('core behavior', () => {
    it('sorts spans within a category by their start position', () => {
      const spans: Span[] = [
        { id: 's1', category: TAXONOMY.SUBJECT.id, quote: 'later', start: 10, end: 15 },
        { id: 's2', category: TAXONOMY.SUBJECT.id, quote: 'early', start: 2, end: 6 },
      ];

      const { result } = renderHook(() => useSpanGrouping(spans));

      const group = result.current.groups[TAXONOMY.SUBJECT.id];
      expect(group?.[0]?.id).toBe('s2');
      expect(group?.[1]?.id).toBe('s1');
    });

  });
});
