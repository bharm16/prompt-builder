import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { GenerationCard } from '@features/prompt-optimizer/GenerationsPanel/components/GenerationCard';
import type { Generation } from '@features/prompt-optimizer/GenerationsPanel/types';

const mockUseGenerationProgress = vi.fn();

vi.mock('@features/prompt-optimizer/GenerationsPanel/hooks/useGenerationProgress', () => ({
  useGenerationProgress: (generation: Generation) => mockUseGenerationProgress(generation),
}));

const mockKontextFrameStrip = vi.fn();
const mockVideoThumbnail = vi.fn();

vi.mock('@features/prompt-optimizer/GenerationsPanel/components/KontextFrameStrip', () => ({
  KontextFrameStrip: (props: { onFrameClick?: (index: number, url: string | null) => void }) => {
    mockKontextFrameStrip(props);
    return (
      <button type="button" onClick={() => props.onFrameClick?.(1, 'https://cdn/frame.png')}>
        Frame
      </button>
    );
  },
}));

vi.mock('@features/prompt-optimizer/GenerationsPanel/components/VideoThumbnail', () => ({
  VideoThumbnail: (props: { isGenerating: boolean }) => {
    mockVideoThumbnail(props);
    return <div>VideoThumbnail</div>;
  },
}));

const createGeneration = (overrides: Partial<Generation> = {}): Generation => ({
  id: 'gen-1',
  tier: 'draft',
  status: 'pending',
  model: 'wan-2.2',
  prompt: 'Prompt',
  promptVersionId: 'version-1',
  createdAt: 1,
  completedAt: null,
  mediaType: 'image-sequence',
  mediaUrls: ['https://cdn/frame.png'],
  thumbnailUrl: null,
  error: null,
  ...overrides,
});

describe('GenerationCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseGenerationProgress.mockReturnValue({
      progressPercent: null,
      isGenerating: false,
      isCompleted: false,
      isFailed: false,
    });
  });

  describe('error handling', () => {
    it('shows the failure state and allows retrying', async () => {
      mockUseGenerationProgress.mockReturnValue({
        progressPercent: null,
        isGenerating: false,
        isCompleted: false,
        isFailed: true,
      });
      const onRetry = vi.fn();
      const generation = createGeneration({ status: 'failed', error: 'Generation failed' });

      const user = userEvent.setup();
      render(<GenerationCard generation={generation} onRetry={onRetry} />);

      expect(screen.getByText('Generation failed')).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: /retry/i }));
      expect(onRetry).toHaveBeenCalledWith(generation);
    });
  });

  describe('edge cases', () => {
    it('ignores card click when clicking the actions button', () => {
      const onClick = vi.fn();
      const onDelete = vi.fn();
      const generation = createGeneration({ status: 'completed' });

      render(
        <GenerationCard
          generation={generation}
          onClick={onClick}
          onDelete={onDelete}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: /more actions/i }));

      expect(onDelete).toHaveBeenCalledWith(generation);
      expect(onClick).not.toHaveBeenCalled();
    });
  });

  describe('core behavior', () => {
    it('passes selected frames to the parent callback', () => {
      const onSelectFrame = vi.fn();
      const generation = createGeneration({ status: 'completed' });

      render(
        <GenerationCard
          generation={generation}
          onSelectFrame={onSelectFrame}
          selectedFrameUrl={null}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: /frame/i }));
      expect(onSelectFrame).toHaveBeenCalledWith('https://cdn/frame.png', 1, 'gen-1');
    });
  });
});
