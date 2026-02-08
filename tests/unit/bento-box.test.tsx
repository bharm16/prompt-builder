import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { BentoBox } from '@features/prompt-optimizer/SpanBentoGrid/components/BentoBox';
import { EMPTY_STATE_MESSAGE } from '@features/prompt-optimizer/SpanBentoGrid/config/bentoConfig';
import type { Span } from '@features/prompt-optimizer/SpanBentoGrid/components/types';

const renderSpy = vi.fn();

vi.mock('@features/prompt-optimizer/SpanBentoGrid/components/SpanItem', () => ({
  SpanItem: (props: { span: Span; backgroundColor: string; borderColor: string }) => {
    renderSpy(props);
    return <div data-testid={`span-${props.span.id}`}>{props.span.quote}</div>;
  },
}));

describe('BentoBox', () => {
  beforeEach(() => {
    renderSpy.mockClear();
  });

  const config = {
    label: 'Shot',
    icon: () => <span>icon</span>,
    backgroundColor: 'red',
    borderColor: 'blue',
    order: 1,
    description: 'Shot configuration',
  };

  describe('error handling', () => {
    it('shows the empty state when there are no spans', () => {
      render(
        <BentoBox
          category="shot"
          spans={[]}
          config={config}
          onSpanClick={vi.fn()}
        />
      );

      expect(screen.getByText(EMPTY_STATE_MESSAGE)).toBeInTheDocument();
    });
  });

  describe('edge cases', () => {
    it('respects defaultExpanded and toggles when header is clicked', async () => {
      const user = userEvent.setup();
      render(
        <BentoBox
          category="shot"
          spans={[]}
          config={config}
          onSpanClick={vi.fn()}
          defaultExpanded
        />
      );

      const section = screen.getByRole('button', { name: /shot/i }).closest('section');
      expect(section).toHaveAttribute('data-expanded', 'true');

      await user.click(screen.getByRole('button', { name: /shot/i }));

      expect(section).toHaveAttribute('data-expanded', 'false');
    });
  });

  describe('core behavior', () => {
    it('renders spans and passes colors to SpanItem', () => {
      const spans: Span[] = [
        { id: 'span-1', quote: 'hello', category: 'shot', start: 0, end: 5 },
      ];

      render(
        <BentoBox
          category="shot"
          spans={spans}
          config={config}
          onSpanClick={vi.fn()}
        />
      );

      expect(screen.getByTestId('span-span-1')).toBeInTheDocument();
      expect(renderSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          backgroundColor: 'red',
          borderColor: 'blue',
        })
      );
    });
  });
});
