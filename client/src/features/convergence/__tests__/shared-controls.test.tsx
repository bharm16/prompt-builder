import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { BackButton } from '../components/shared/BackButton';
import { RegenerateButton } from '../components/shared/RegenerateButton';
import { StepCreditBadge, getStepCost } from '../components/shared/StepCreditBadge';
import { EstimatedCostBadge } from '../components/shared/EstimatedCostBadge';
import { ImageSkeleton } from '../components/shared/ImageSkeleton';

// ============================================================================
// BackButton
// ============================================================================

describe('BackButton', () => {
  describe('error handling', () => {
    it('does not invoke onBack when disabled', async () => {
      const onBack = vi.fn();
      const user = userEvent.setup();

      render(<BackButton onBack={onBack} disabled label="Go back" />);

      await user.click(screen.getByRole('button', { name: 'Go back' }));
      expect(onBack).not.toHaveBeenCalled();
    });
  });

  describe('edge cases', () => {
    it('applies the small size classes for compact layouts', () => {
      render(<BackButton size="sm" label="Return" />);
      const button = screen.getByRole('button', { name: 'Return' });

      expect(button).toHaveClass('text-xs');
      expect(button).toHaveClass('px-3');
    });
  });

  describe('core behavior', () => {
    it('invokes onBack when enabled', async () => {
      const onBack = vi.fn();
      const user = userEvent.setup();

      render(<BackButton onBack={onBack} label="Back" />);

      await user.click(screen.getByRole('button', { name: 'Back' }));
      expect(onBack).toHaveBeenCalledTimes(1);
    });
  });
});

// ============================================================================
// RegenerateButton
// ============================================================================

describe('RegenerateButton', () => {
  describe('error handling', () => {
    it('prevents regeneration when the limit is reached', async () => {
      const onRegenerate = vi.fn();
      const user = userEvent.setup();

      render(
        <RegenerateButton
          regenerationCount={3}
          onRegenerate={onRegenerate}
        />
      );

      const button = screen.getByRole('button', { name: 'Regeneration limit reached' });
      expect(button).toBeDisabled();

      await user.click(button);
      expect(onRegenerate).not.toHaveBeenCalled();
    });
  });

  describe('edge cases', () => {
    it('shows a loading state without counts or cost', () => {
      render(
        <RegenerateButton
          isLoading
          regenerationCount={1}
        />
      );

      expect(screen.getByText('Regenerating...')).toBeInTheDocument();
      expect(screen.queryByLabelText('Costs 4 credits')).toBeNull();
    });
  });

  describe('core behavior', () => {
    it('shows remaining regenerations and cost when available', () => {
      render(
        <RegenerateButton
          regenerationCount={1}
          showCost
        />
      );

      expect(screen.getByText('Regenerate')).toBeInTheDocument();
      expect(screen.getByText('2')).toBeInTheDocument();
      expect(screen.getByLabelText('Costs 4 credits')).toBeInTheDocument();
    });
  });
});

// ============================================================================
// StepCreditBadge
// ============================================================================

describe('StepCreditBadge', () => {
  describe('error handling', () => {
    it('renders nothing when the step has no credit cost', () => {
      const { container } = render(<StepCreditBadge step="intent" />);

      expect(container.firstChild).toBeNull();
    });
  });

  describe('edge cases', () => {
    it('omits the label when showLabel is false', () => {
      render(<StepCreditBadge step="direction" showLabel={false} />);

      expect(screen.queryByText(/credit/)).toBeNull();
    });
  });

  describe('core behavior', () => {
    it('uses the provided cost override and singular label', () => {
      render(<StepCreditBadge step="direction" cost={1} />);

      expect(screen.getByText('1')).toBeInTheDocument();
      expect(screen.getByText('credit')).toBeInTheDocument();
      expect(screen.getByLabelText('This step costs 1 credit')).toBeInTheDocument();
    });

    it('falls back to the configured step cost map', () => {
      render(<StepCreditBadge step="mood" />);

      expect(screen.getByText(String(getStepCost('mood')))).toBeInTheDocument();
    });
  });
});

// ============================================================================
// EstimatedCostBadge
// ============================================================================

describe('EstimatedCostBadge', () => {
  describe('error handling', () => {
    it('hides the tooltip when showTooltip is false', () => {
      render(
        <EstimatedCostBadge
          variant="subtle"
          showTooltip={false}
          estimatedCost={12}
        />
      );

      expect(screen.queryByRole('tooltip')).toBeNull();
    });
  });

  describe('edge cases', () => {
    it('renders zero cost values without crashing', () => {
      render(<EstimatedCostBadge estimatedCost={0} />);

      expect(screen.getByText('~0')).toBeInTheDocument();
      expect(screen.getByLabelText('Estimated cost: approximately 0 credits')).toBeInTheDocument();
    });
  });

  describe('core behavior', () => {
    it('uses custom cost values for prominent badges', () => {
      render(
        <EstimatedCostBadge
          estimatedCost={42}
          variant="prominent"
          size="lg"
        />
      );

      expect(screen.getByText('~42')).toBeInTheDocument();
      expect(screen.getByLabelText('Estimated cost: approximately 42 credits')).toBeInTheDocument();
    });
  });
});

// ============================================================================
// ImageSkeleton
// ============================================================================

describe('ImageSkeleton', () => {
  describe('error handling', () => {
    it('renders without shimmer when disabled', () => {
      const { container } = render(<ImageSkeleton shimmer={false} />);

      const skeleton = container.firstChild as HTMLElement;
      expect(skeleton).not.toHaveClass('animate-pulse');
      expect(container.querySelector('.animate-\\[shimmer_2s_infinite\\]')).toBeNull();
    });
  });

  describe('edge cases', () => {
    it('uses the requested aspect ratio classes', () => {
      const { container } = render(<ImageSkeleton aspectRatio="video" />);

      const skeleton = container.firstChild as HTMLElement;
      expect(skeleton).toHaveClass('aspect-video');
    });
  });

  describe('core behavior', () => {
    it('renders accessible labels for screen readers', () => {
      render(<ImageSkeleton aria-label="Loading preview" />);

      expect(screen.getByRole('status', { name: 'Loading preview' })).toBeInTheDocument();
      expect(screen.getByText('Loading preview')).toBeInTheDocument();
    });
  });
});
