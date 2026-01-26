import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type React from 'react';
import userEvent from '@testing-library/user-event';

import { KeyframeStep } from '@features/prompt-optimizer/GenerationsPanel/components/KeyframeStep/KeyframeStep';
import type { Asset } from '@shared/types/asset';
import type { KeyframeOption } from '@features/prompt-optimizer/GenerationsPanel/components/KeyframeStep/hooks/useKeyframeGeneration';

const mockUseKeyframeGeneration = vi.fn();

vi.mock(
  '@features/prompt-optimizer/GenerationsPanel/components/KeyframeStep/hooks/useKeyframeGeneration',
  () => ({
    useKeyframeGeneration: (args: unknown) => mockUseKeyframeGeneration(args),
  })
);

vi.mock('@promptstudio/system/components/ui/button', () => ({
  Button: ({ children, ...props }: { children: React.ReactNode }) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
}));

describe('KeyframeStep', () => {
  const character = { id: 'char-1', trigger: '@hero' } as Asset;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('error handling', () => {
    it('renders error state and retries generation', async () => {
      const regenerate = vi.fn();
      const generateKeyframes = vi.fn();
      mockUseKeyframeGeneration.mockReturnValue({
        keyframes: [],
        selectedKeyframe: null,
        isGenerating: false,
        error: 'Failed to generate keyframes',
        generateKeyframes,
        selectKeyframe: vi.fn(),
        regenerate,
      });

      const user = userEvent.setup();
      render(
        <KeyframeStep
          prompt="Prompt"
          character={character}
          aspectRatio="16:9"
          onApprove={vi.fn()}
          onSkip={vi.fn()}
        />
      );

      expect(screen.getByText('Failed to generate keyframes')).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: /try again/i }));
      expect(regenerate).toHaveBeenCalled();
      expect(generateKeyframes).toHaveBeenCalled();
    });
  });

  describe('edge cases', () => {
    it('shows a loading state while generating', () => {
      mockUseKeyframeGeneration.mockReturnValue({
        keyframes: [],
        selectedKeyframe: null,
        isGenerating: true,
        error: null,
        generateKeyframes: vi.fn(),
        selectKeyframe: vi.fn(),
        regenerate: vi.fn(),
      });

      render(
        <KeyframeStep
          prompt="Prompt"
          character={character}
          aspectRatio="16:9"
          onApprove={vi.fn()}
          onSkip={vi.fn()}
        />
      );

      expect(screen.getByText('Generating keyframes...')).toBeInTheDocument();
    });
  });

  describe('core behavior', () => {
    it('enables approval once a keyframe is selected', async () => {
      const keyframe = { imageUrl: 'frame.png', faceStrength: 0.9 } as KeyframeOption;
      const generateKeyframes = vi.fn();
      const onApprove = vi.fn();
      mockUseKeyframeGeneration.mockReturnValue({
        keyframes: [keyframe],
        selectedKeyframe: keyframe,
        isGenerating: false,
        error: null,
        generateKeyframes,
        selectKeyframe: vi.fn(),
        regenerate: vi.fn(),
      });

      const user = userEvent.setup();
      render(
        <KeyframeStep
          prompt="Prompt"
          character={character}
          aspectRatio="16:9"
          onApprove={onApprove}
          onSkip={vi.fn()}
        />
      );

      const approveButton = screen.getByRole('button', { name: /use this keyframe/i });
      expect(approveButton).toBeEnabled();

      await user.click(approveButton);
      expect(onApprove).toHaveBeenCalledWith('frame.png');
      expect(generateKeyframes).toHaveBeenCalled();
    });
  });
});
