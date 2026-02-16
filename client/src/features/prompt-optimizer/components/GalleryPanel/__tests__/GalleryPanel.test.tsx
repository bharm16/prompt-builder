import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { GalleryPanel } from '../GalleryPanel';
import type { GalleryGeneration } from '../types';

const makeGeneration = (
  id: string,
  overrides: Partial<GalleryGeneration> = {}
): GalleryGeneration => ({
  id,
  tier: 'final',
  thumbnailUrl: 'https://example.com/thumb.jpg',
  mediaUrl: 'https://example.com/video.mp4',
  mediaType: 'video',
  prompt: 'A cinematic shot',
  model: 'Sora',
  createdAt: Date.now(),
  isFavorite: false,
  generationSettings: null,
  ...overrides,
});

describe('GalleryPanel', () => {
  it('renders all generations and selects one', () => {
    const onSelectGeneration = vi.fn();
    const generations = [
      makeGeneration('g-1', { tier: 'preview' }),
      makeGeneration('g-2', { tier: 'draft' }),
      makeGeneration('g-3', { tier: 'final' }),
    ];

    render(
      <GalleryPanel
        generations={generations}
        activeGenerationId={null}
        onSelectGeneration={onSelectGeneration}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByTestId('gallery-thumbnail-g-1')).toBeInTheDocument();
    expect(screen.getByTestId('gallery-thumbnail-g-2')).toBeInTheDocument();
    expect(screen.getByTestId('gallery-thumbnail-g-3')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('gallery-thumbnail-g-2'));
    expect(onSelectGeneration).toHaveBeenCalledWith('g-2');
  });

  it('filters by preview, draft, and favorites', () => {
    const generations = [
      makeGeneration('preview-1', { tier: 'preview' }),
      makeGeneration('draft-1', { tier: 'draft' }),
      makeGeneration('favorite-1', { isFavorite: true }),
    ];

    render(
      <GalleryPanel
        generations={generations}
        activeGenerationId={null}
        onSelectGeneration={vi.fn()}
        onClose={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Preview' }));
    expect(screen.getByTestId('gallery-thumbnail-preview-1')).toBeInTheDocument();
    expect(screen.queryByTestId('gallery-thumbnail-draft-1')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Draft' }));
    expect(screen.getByTestId('gallery-thumbnail-draft-1')).toBeInTheDocument();
    expect(screen.queryByTestId('gallery-thumbnail-preview-1')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '★' }));
    expect(screen.getByTestId('gallery-thumbnail-favorite-1')).toBeInTheDocument();
    expect(screen.queryByTestId('gallery-thumbnail-draft-1')).not.toBeInTheDocument();
  });

  it('closes from header close button', () => {
    const onClose = vi.fn();
    render(
      <GalleryPanel
        generations={[makeGeneration('g-1')]}
        activeGenerationId={null}
        onSelectGeneration={vi.fn()}
        onClose={onClose}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Close gallery' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

