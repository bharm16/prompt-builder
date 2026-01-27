import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { GenerationBadge } from '../GenerationBadge';

describe('GenerationBadge', () => {
  describe('edge cases', () => {
    it('renders correct text for draft tier without status', () => {
      render(<GenerationBadge tier="draft" />);

      expect(screen.getByText('Draft')).toBeInTheDocument();
    });

    it('renders correct text for render tier without status', () => {
      render(<GenerationBadge tier="render" />);

      expect(screen.getByText('Render')).toBeInTheDocument();
    });
  });

  describe('status indicator styling', () => {
    it('shows pulsing warning dot for pending status', () => {
      const { container } = render(<GenerationBadge tier="draft" status="pending" />);

      const dot = container.querySelector('[aria-hidden="true"]');
      expect(dot).toHaveClass('bg-warning', 'animate-pulse');
    });

    it('shows pulsing warning dot for generating status', () => {
      const { container } = render(<GenerationBadge tier="draft" status="generating" />);

      const dot = container.querySelector('[aria-hidden="true"]');
      expect(dot).toHaveClass('bg-warning', 'animate-pulse');
    });

    it('shows success dot for completed status', () => {
      const { container } = render(<GenerationBadge tier="draft" status="completed" />);

      const dot = container.querySelector('[aria-hidden="true"]');
      expect(dot).toHaveClass('bg-success');
    });

    it('shows error dot for failed status', () => {
      const { container } = render(<GenerationBadge tier="draft" status="failed" />);

      const dot = container.querySelector('[aria-hidden="true"]');
      expect(dot).toHaveClass('bg-error');
    });
  });

  describe('core behavior', () => {
    it('uses muted styling for draft tier without status', () => {
      const { container } = render(<GenerationBadge tier="draft" />);

      const dot = container.querySelector('[aria-hidden="true"]');
      expect(dot).toHaveClass('bg-muted');
    });

    it('uses accent styling for render tier without status', () => {
      const { container } = render(<GenerationBadge tier="render" />);

      const dot = container.querySelector('[aria-hidden="true"]');
      expect(dot).toHaveClass('bg-accent');
    });

    it('applies custom className to badge', () => {
      render(<GenerationBadge tier="draft" className="custom-class" />);

      const badge = screen.getByText('Draft').closest('.custom-class');
      expect(badge).toBeInTheDocument();
    });

    it('applies different badge styling for draft vs render tier', () => {
      const { container, rerender } = render(<GenerationBadge tier="draft" />);

      // Draft uses bg-surface-2 styling
      const draftBadge = container.querySelector('.bg-surface-2');
      expect(draftBadge).not.toBeNull();

      rerender(<GenerationBadge tier="render" />);

      // Render uses bg-accent/10 styling (rendered as bg-accent\/10 in class)
      const renderBadge = container.querySelector('[class*="bg-accent"]');
      expect(renderBadge).not.toBeNull();
    });
  });
});
