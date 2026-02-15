import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { StoryboardStrip } from '../StoryboardStrip';
import type { GenerationsPanelStateSnapshot } from '@/features/prompt-optimizer/GenerationsPanel/types';

const buildSnapshot = (): GenerationsPanelStateSnapshot => ({
  activeGenerationId: 'gen-1',
  isGenerating: false,
  selectedFrameUrl: null,
  generations: [
    {
      id: 'gen-1',
      tier: 'draft',
      status: 'completed',
      model: 'flux-kontext',
      prompt: 'A cinematic skyline',
      promptVersionId: 'v1',
      createdAt: 10,
      completedAt: 20,
      mediaType: 'image-sequence',
      mediaUrls: [
        'https://example.com/frame-1.png',
        'https://example.com/frame-2.png',
        'https://example.com/frame-3.png',
        'https://example.com/frame-4.png',
        'https://example.com/frame-5.png',
      ],
      mediaAssetIds: ['asset-1', 'asset-2', 'asset-3', 'asset-4', 'asset-5'],
    },
  ],
});

describe('StoryboardStrip', () => {
  it('renders up to four frames and assigns selected frame as start frame', () => {
    const onUseAsStartFrame = vi.fn();

    render(
      <StoryboardStrip
        snapshot={buildSnapshot()}
        onUseAsStartFrame={onUseAsStartFrame}
        onDismiss={vi.fn()}
      />
    );

    expect(screen.getByTestId('storyboard-frame-0')).toBeInTheDocument();
    expect(screen.getByTestId('storyboard-frame-1')).toBeInTheDocument();
    expect(screen.getByTestId('storyboard-frame-2')).toBeInTheDocument();
    expect(screen.getByTestId('storyboard-frame-3')).toBeInTheDocument();
    expect(screen.queryByTestId('storyboard-frame-4')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('storyboard-frame-1'));
    fireEvent.click(screen.getByTestId('storyboard-use-start-frame'));

    expect(onUseAsStartFrame).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'https://example.com/frame-2.png',
        source: 'generation',
        assetId: 'asset-2',
        sourcePrompt: 'A cinematic skyline',
      })
    );
  });

  it('calls onDismiss when dismiss action is used', () => {
    const onDismiss = vi.fn();

    render(
      <StoryboardStrip
        snapshot={buildSnapshot()}
        onUseAsStartFrame={vi.fn()}
        onDismiss={onDismiss}
      />
    );

    fireEvent.click(screen.getByTestId('storyboard-dismiss'));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
