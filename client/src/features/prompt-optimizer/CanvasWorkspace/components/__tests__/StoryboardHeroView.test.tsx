import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { StoryboardHeroView } from '../StoryboardHeroView';
import type { Generation } from '@/features/prompt-optimizer/GenerationsPanel/types';

const makeGeneration = (
  overrides: Partial<Generation> & Pick<Generation, 'id'>
): Generation => ({
  id: overrides.id,
  tier: overrides.tier ?? 'draft',
  status: overrides.status ?? 'completed',
  model: overrides.model ?? 'flux-kontext',
  prompt: overrides.prompt ?? 'Cinematic board',
  promptVersionId: overrides.promptVersionId ?? 'v1',
  createdAt: overrides.createdAt ?? 1,
  completedAt: overrides.completedAt ?? 2,
  mediaType: overrides.mediaType ?? 'image-sequence',
  mediaUrls:
    overrides.mediaUrls ??
    [
      'https://example.com/frame-1.png',
      'https://example.com/frame-2.png',
      'https://example.com/frame-3.png',
      'https://example.com/frame-4.png',
    ],
  ...(overrides.mediaAssetIds ? { mediaAssetIds: overrides.mediaAssetIds } : {}),
  ...(overrides.error ? { error: overrides.error } : {}),
});

describe('StoryboardHeroView', () => {
  it('renders up to four storyboard frames and supports selecting frames', () => {
    const generation = makeGeneration({ id: 'storyboard-1' });
    render(<StoryboardHeroView generation={generation} onUseAsStartFrame={vi.fn()} />);

    const frame0 = screen.getByTestId('storyboard-hero-frame-0');
    const frame1 = screen.getByTestId('storyboard-hero-frame-1');
    expect(frame0.className).toContain('border-[#6C5CE7]');

    fireEvent.click(frame1);
    expect(frame1.className).toContain('border-[#6C5CE7]');
  });

  it('sends selected frame payload when using as start frame', () => {
    const onUseAsStartFrame = vi.fn();
    const generation = makeGeneration({
      id: 'storyboard-2',
      mediaAssetIds: ['asset-1', 'asset-2', 'asset-3', 'asset-4'],
    });

    render(
      <StoryboardHeroView
        generation={generation}
        onUseAsStartFrame={onUseAsStartFrame}
      />
    );

    fireEvent.click(screen.getByTestId('storyboard-hero-frame-2'));
    fireEvent.click(screen.getByTestId('storyboard-hero-use-start-frame'));

    expect(onUseAsStartFrame).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'storyboard-storyboard-2-frame-2',
        url: 'https://example.com/frame-3.png',
        source: 'generation',
        sourcePrompt: 'Cinematic board',
        assetId: 'asset-3',
      })
    );
  });

  it('handles generations with fewer than four frames', () => {
    const generation = makeGeneration({
      id: 'storyboard-3',
      mediaUrls: ['https://example.com/frame-only.png'],
    });

    render(<StoryboardHeroView generation={generation} onUseAsStartFrame={vi.fn()} />);
    expect(screen.getByTestId('storyboard-hero-frame-0')).toBeInTheDocument();
    expect(screen.queryByTestId('storyboard-hero-frame-1')).not.toBeInTheDocument();
  });

  it('renders pending and failed states', () => {
    const { rerender } = render(
      <StoryboardHeroView
        generation={makeGeneration({
          id: 'storyboard-pending',
          status: 'generating',
          mediaUrls: [],
          completedAt: null,
        })}
        onUseAsStartFrame={vi.fn()}
      />
    );

    expect(screen.getByText('PREVIEW · GENERATING')).toBeInTheDocument();

    rerender(
      <StoryboardHeroView
        generation={makeGeneration({
          id: 'storyboard-failed',
          status: 'failed',
          mediaUrls: [],
          error: 'No output',
        })}
        onUseAsStartFrame={vi.fn()}
      />
    );

    expect(screen.getByText('Storyboard failed')).toBeInTheDocument();
    expect(screen.getByText('No output')).toBeInTheDocument();
  });
});
