import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { GalleryGeneration } from '@features/prompt-optimizer/components/GalleryPanel';
import { GenerationPopover } from '../GenerationPopover';

const makeGeneration = (
  id: string,
  overrides: Partial<GalleryGeneration> = {}
): GalleryGeneration => ({
  id,
  tier: 'final',
  thumbnailUrl: 'https://example.com/thumb.jpg',
  mediaUrl: 'https://example.com/video.mp4',
  mediaType: 'video',
  prompt: `Prompt ${id}`,
  model: 'Sora',
  duration: '5s',
  aspectRatio: '16:9',
  createdAt: Date.now(),
  isFavorite: false,
  generationSettings: null,
  ...overrides,
});

describe('GenerationPopover', () => {
  it('closes on backdrop click', () => {
    const onClose = vi.fn();
    render(
      <GenerationPopover
        generations={[makeGeneration('g-1')]}
        activeId="g-1"
        onChange={vi.fn()}
        onClose={onClose}
        onReuse={vi.fn()}
        onToggleFavorite={vi.fn()}
      />
    );

    fireEvent.click(screen.getByTestId('generation-popover'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('switches active generation from rail and reuses active generation', () => {
    const onChange = vi.fn();
    const onReuse = vi.fn();
    const generations = [makeGeneration('g-1'), makeGeneration('g-2')];

    render(
      <GenerationPopover
        generations={generations}
        activeId="g-1"
        onChange={onChange}
        onClose={vi.fn()}
        onReuse={onReuse}
        onToggleFavorite={vi.fn()}
      />
    );

    fireEvent.click(screen.getByTestId('popover-rail-g-2'));
    expect(onChange).toHaveBeenCalledWith('g-2');

    fireEvent.click(screen.getByRole('button', { name: 'Reuse prompt and settings' }));
    expect(onReuse).toHaveBeenCalledWith('g-1');
  });

  it('toggles favorite state from top action', () => {
    const onToggleFavorite = vi.fn();
    render(
      <GenerationPopover
        generations={[makeGeneration('g-1', { isFavorite: false })]}
        activeId="g-1"
        onChange={vi.fn()}
        onClose={vi.fn()}
        onReuse={vi.fn()}
        onToggleFavorite={onToggleFavorite}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Toggle favorite' }));
    expect(onToggleFavorite).toHaveBeenCalledWith('g-1', true);
  });
});
