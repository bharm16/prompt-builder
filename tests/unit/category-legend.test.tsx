import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { CategoryLegend } from '@features/prompt-optimizer/components/CategoryLegend';
import { CATEGORY_ORDER } from '@features/prompt-optimizer/SpanBentoGrid/config/bentoConfig';

describe('CategoryLegend', () => {
  describe('error handling', () => {
    it('returns null when show is false', () => {
      const { container } = render(
        <CategoryLegend show={false} onClose={vi.fn()} />
      );

      expect(container.firstChild).toBeNull();
    });
  });

  describe('edge cases', () => {
    it('shows brainstorm context indicator when hasContext is true', () => {
      render(
        <CategoryLegend show onClose={vi.fn()} hasContext />
      );

      expect(screen.getByText('Brainstorm context active')).toBeInTheDocument();
    });
  });

  describe('core behavior', () => {
    it('renders all configured categories and wires close action', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();

      render(
        <CategoryLegend show onClose={onClose} isSuggestionsOpen />
      );

      const categoryList = screen.getAllByRole('list')[0];
      if (!categoryList) {
        throw new Error('Expected category list');
      }
      expect(within(categoryList).getAllByRole('listitem')).toHaveLength(CATEGORY_ORDER.length);

      const dialog = screen.getByRole('dialog', { name: 'Highlight categories' });
      expect(dialog).toHaveStyle({ right: 'calc(var(--pc-gap, 16px) + var(--pc-right-rail, 420px) + var(--pc-gap, 16px))' });

      await user.click(screen.getByRole('button', { name: 'Close legend' }));
      expect(onClose).toHaveBeenCalled();
    });
  });
});
