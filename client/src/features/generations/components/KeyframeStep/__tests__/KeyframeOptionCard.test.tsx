import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { KeyframeOptionCard } from '../KeyframeOptionCard';
import type { KeyframeOption } from '../hooks/useKeyframeGeneration';

const createKeyframe = (overrides: Partial<KeyframeOption> = {}): KeyframeOption => ({
  imageUrl: 'https://example.com/keyframe.jpg',
  faceStrength: 0.5,
  ...overrides,
});

describe('KeyframeOptionCard', () => {
  describe('edge cases', () => {
    it('renders FaceMatchIndicator without score when faceMatchScore is not provided', () => {
      render(
        <KeyframeOptionCard
          keyframe={createKeyframe()}
          isSelected={false}
          onSelect={vi.fn()}
        />
      );

      expect(screen.getByText('Face match: --')).toBeInTheDocument();
    });

    it('does not show check indicator when not selected', () => {
      render(
        <KeyframeOptionCard
          keyframe={createKeyframe()}
          isSelected={false}
          onSelect={vi.fn()}
        />
      );

      // Check icon should not be present
      expect(screen.queryByRole('button')?.querySelector('.bg-violet-500 p-1')).toBeNull();
    });
  });

  describe('selection state', () => {
    it('shows check indicator when selected', () => {
      const { container } = render(
        <KeyframeOptionCard
          keyframe={createKeyframe()}
          isSelected={true}
          onSelect={vi.fn()}
        />
      );

      // The check icon container has bg-violet-500
      const checkIndicator = container.querySelector('.bg-violet-500.p-1');
      expect(checkIndicator).toBeInTheDocument();
    });

    it('applies violet border styling when selected', () => {
      render(
        <KeyframeOptionCard
          keyframe={createKeyframe()}
          isSelected={true}
          onSelect={vi.fn()}
        />
      );

      const button = screen.getByRole('button');
      expect(button).toHaveClass('border-violet-500');
    });

    it('applies transparent border when not selected', () => {
      render(
        <KeyframeOptionCard
          keyframe={createKeyframe()}
          isSelected={false}
          onSelect={vi.fn()}
        />
      );

      const button = screen.getByRole('button');
      expect(button).toHaveClass('border-transparent');
    });
  });

  describe('core behavior', () => {
    it('calls onSelect when clicked', async () => {
      const onSelect = vi.fn();
      const user = userEvent.setup();

      render(
        <KeyframeOptionCard
          keyframe={createKeyframe()}
          isSelected={false}
          onSelect={onSelect}
        />
      );

      await user.click(screen.getByRole('button'));

      expect(onSelect).toHaveBeenCalledTimes(1);
    });

    it('renders image with correct src', () => {
      render(
        <KeyframeOptionCard
          keyframe={createKeyframe({ imageUrl: 'https://example.com/custom.jpg' })}
          isSelected={false}
          onSelect={vi.fn()}
        />
      );

      const img = screen.getByAltText('Keyframe option');
      expect(img).toHaveAttribute('src', 'https://example.com/custom.jpg');
    });

    it('displays face match score when provided', () => {
      render(
        <KeyframeOptionCard
          keyframe={createKeyframe({ faceMatchScore: 0.92 })}
          isSelected={false}
          onSelect={vi.fn()}
        />
      );

      expect(screen.getByText('92% match')).toBeInTheDocument();
    });
  });
});
