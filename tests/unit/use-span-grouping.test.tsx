import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';

import {
  useSpanGrouping,
  useCategoryHierarchyInfo,
} from '@features/prompt-optimizer/SpanBentoGrid/hooks/useSpanGrouping';
import { TAXONOMY } from '@shared/taxonomy';

const warnSpy = vi.fn();

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
      const spans = [
        { id: 's1', category: 'unknown-category', quote: 'hello', start: 2 },
      ];

      const { result } = renderHook(() => useSpanGrouping(spans));

      expect(result.current.groups[TAXONOMY.SUBJECT.id]).toHaveLength(1);
      expect(spans[0]._mappedTo).toBe(TAXONOMY.SUBJECT.id);
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
      const spans = [
        { id: 's1', category: 'subject.appearance', quote: 'coat', start: 5 },
      ];

      const { result } = renderHook(() =>
        useSpanGrouping(spans, { enableHierarchy: true })
      );

      expect(result.current.groups[TAXONOMY.SUBJECT.id]).toHaveLength(1);
      expect(spans[0]._isAttribute).toBe(true);
      expect(spans[0]._parentCategory).toBe(TAXONOMY.SUBJECT.id);
      expect(result.current.hierarchyInfo?.hasOrphans).toBe(true);
      expect(result.current.hierarchyInfo?.orphanedAttributes).toHaveLength(1);
      expect(result.current.hierarchyInfo?.orphanedAttributes[0]?.missingParent).toBe(
        TAXONOMY.SUBJECT.id
      );
    });
  });

  describe('core behavior', () => {
    it('sorts spans within a category by their start position', () => {
      const spans = [
        { id: 's1', category: TAXONOMY.SUBJECT.id, quote: 'later', start: 10 },
        { id: 's2', category: TAXONOMY.SUBJECT.id, quote: 'early', start: 2 },
      ];

      const { result } = renderHook(() => useSpanGrouping(spans));

      const group = result.current.groups[TAXONOMY.SUBJECT.id];
      expect(group[0]?.id).toBe('s2');
      expect(group[1]?.id).toBe('s1');
    });

    it('separates parent and attribute spans in hierarchy info hook', () => {
      const spans = [
        { id: 'parent', category: TAXONOMY.SUBJECT.id, quote: 'person', start: 0 },
        {
          id: 'attr',
          category: 'subject.appearance',
          quote: 'tall',
          start: 5,
          _isAttribute: true,
        },
      ];

      const { result } = renderHook(() =>
        useCategoryHierarchyInfo(TAXONOMY.SUBJECT.id, spans)
      );

      expect(result.current.isParent).toBe(true);
      expect(result.current.attributeSpans).toHaveLength(1);
      expect(result.current.parentSpans).toHaveLength(1);
      expect(result.current.hasAttributes).toBe(true);
    });
  });
});
