/**
 * Unit tests for CategoryTabs
 */

import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { ButtonHTMLAttributes } from 'react';

import { CategoryTabs } from '@components/SuggestionsPanel/components/CategoryTabs';
import type { CategoryGroup } from '@components/SuggestionsPanel/hooks/types';

vi.mock('@promptstudio/system/components/ui/button', () => ({
  Button: ({ children, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  ),
}));

describe('CategoryTabs', () => {
  describe('edge cases', () => {
    it('renders nothing when there is only one category', () => {
      const categories: CategoryGroup[] = [
        { category: 'All', suggestions: [{ text: 'A' }] },
      ];

      const { container } = render(
        <CategoryTabs categories={categories} activeCategory="All" />
      );

      expect(container).toBeEmptyDOMElement();
    });
  });

  describe('core behavior', () => {
    it('calls onCategoryChange when a tab is clicked', () => {
      const categories: CategoryGroup[] = [
        { category: 'Tone', suggestions: [{ text: 'A' }] },
        { category: 'Style', suggestions: [{ text: 'B' }] },
      ];
      const onCategoryChange = vi.fn();

      render(
        <CategoryTabs
          categories={categories}
          activeCategory="Tone"
          onCategoryChange={onCategoryChange}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: /Category: Style/ }));

      expect(onCategoryChange).toHaveBeenCalledWith('Style');
    });

    it('marks the active category with aria-pressed', () => {
      const categories: CategoryGroup[] = [
        { category: 'Tone', suggestions: [{ text: 'A' }] },
        { category: 'Style', suggestions: [{ text: 'B' }] },
      ];

      render(<CategoryTabs categories={categories} activeCategory="Tone" />);

      const activeTab = screen.getByRole('button', { name: /Category: Tone/ });
      expect(activeTab).toHaveAttribute('aria-pressed', 'true');
    });
  });
});
