import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { GenerationBadge } from '../GenerationBadge';

describe('GenerationBadge', () => {
  describe('core behavior', () => {
    it('renders correct text for draft tier', () => {
      render(<GenerationBadge tier="draft" />);

      expect(screen.getByText('Draft')).toBeInTheDocument();
    });

    it('renders correct text for render tier', () => {
      render(<GenerationBadge tier="render" />);

      expect(screen.getByText('Render')).toBeInTheDocument();
    });

    it('uses draft styling for draft tier', () => {
      const { container } = render(<GenerationBadge tier="draft" />);

      const badge = container.querySelector('span');
      expect(badge).toHaveClass('bg-black/40', 'text-[#4ADE80]/80');
    });

    it('uses render styling for render tier', () => {
      const { container } = render(<GenerationBadge tier="render" />);

      const badge = container.querySelector('span');
      expect(badge).toHaveClass('bg-black/40', 'text-[#6C5CE7]/80');
    });

    it('applies custom className to badge', () => {
      render(<GenerationBadge tier="draft" className="custom-class" />);

      const badge = screen.getByText('Draft').closest('.custom-class');
      expect(badge).toBeInTheDocument();
    });
  });
});
