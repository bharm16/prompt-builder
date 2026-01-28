import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { SpanBentoGrid } from '@features/prompt-optimizer/SpanBentoGrid/SpanBentoGrid';
import { useSpanGrouping } from '@features/prompt-optimizer/SpanBentoGrid/hooks/useSpanGrouping';
import { scrollToSpan } from '@features/prompt-optimizer/SpanBentoGrid/utils/spanFormatting';
import { TAXONOMY } from '@shared/taxonomy';
import type { Span } from '@features/prompt-optimizer/SpanBentoGrid/components/types';

vi.mock('@features/prompt-optimizer/SpanBentoGrid/hooks/useSpanGrouping', () => ({
  useSpanGrouping: vi.fn(),
}));

vi.mock('@features/prompt-optimizer/SpanBentoGrid/components/BentoBox', () => ({
  BentoBox: ({
    category,
    spans,
    onSpanClick,
    defaultExpanded,
    onSpanHoverChange,
  }: {
    category: string;
    spans: Span[];
    onSpanClick: (span: Span) => void;
    defaultExpanded: boolean;
    onSpanHoverChange?: (id: string | null) => void;
  }) => (
    <button
      type="button"
      data-testid={`bento-${category}`}
      data-expanded={defaultExpanded ? 'true' : 'false'}
      data-has-hover={onSpanHoverChange ? 'true' : 'false'}
      onClick={() => spans[0] && onSpanClick(spans[0])}
    >
      {category}
    </button>
  ),
}));

vi.mock('@features/prompt-optimizer/SpanBentoGrid/utils/spanFormatting', () => ({
  scrollToSpan: vi.fn(),
}));

const mockUseSpanGrouping = vi.mocked(useSpanGrouping);
const mockScrollToSpan = vi.mocked(scrollToSpan);

describe('SpanBentoGrid', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('error handling', () => {
    it('omits hover handlers when onSpanHoverChange is not provided', () => {
      const span: Span = { id: 'span-1', quote: 'hello', category: TAXONOMY.SHOT.id };
      mockUseSpanGrouping.mockReturnValue({
        groups: {
          [TAXONOMY.SHOT.id]: [span],
          [TAXONOMY.SUBJECT.id]: [],
        },
        totalSpans: 1,
        categoryCount: 1,
        hierarchyInfo: null,
      });

      render(
        <SpanBentoGrid
          spans={[span]}
          editorRef={{ current: document.createElement('div') }}
        />
      );

      expect(screen.getByTestId(`bento-${TAXONOMY.SHOT.id}`)).toHaveAttribute(
        'data-has-hover',
        'false'
      );
    });
  });

  describe('edge cases', () => {
    it('passes defaultExpanded for shot and subject categories', () => {
      const span: Span = { id: 'span-1', quote: 'hello', category: TAXONOMY.SHOT.id };
      mockUseSpanGrouping.mockReturnValue({
        groups: {
          [TAXONOMY.SHOT.id]: [span],
          [TAXONOMY.SUBJECT.id]: [],
        },
        totalSpans: 1,
        categoryCount: 1,
        hierarchyInfo: null,
      });

      render(
        <SpanBentoGrid
          spans={[span]}
          editorRef={{ current: document.createElement('div') }}
        />
      );

      expect(screen.getByTestId(`bento-${TAXONOMY.SHOT.id}`)).toHaveAttribute(
        'data-expanded',
        'true'
      );
      expect(screen.getByTestId(`bento-${TAXONOMY.SUBJECT.id}`)).toHaveAttribute(
        'data-expanded',
        'true'
      );
    });
  });

  describe('core behavior', () => {
    it('calls scrollToSpan when a span is clicked', async () => {
      const user = userEvent.setup();
      const span: Span = { id: 'span-1', quote: 'hello', category: TAXONOMY.SHOT.id };
      const editorRef = { current: document.createElement('div') };

      mockUseSpanGrouping.mockReturnValue({
        groups: {
          [TAXONOMY.SHOT.id]: [span],
          [TAXONOMY.SUBJECT.id]: [],
        },
        totalSpans: 1,
        categoryCount: 1,
        hierarchyInfo: null,
      });

      render(
        <SpanBentoGrid
          spans={[span]}
          editorRef={editorRef}
        />
      );

      await user.click(screen.getByTestId(`bento-${TAXONOMY.SHOT.id}`));

      expect(mockScrollToSpan).toHaveBeenCalledWith(editorRef, span);
    });
  });
});
