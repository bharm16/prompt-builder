import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { CanvasGenerationStrip } from '../CanvasGenerationStrip';
import type { Generation } from '@/features/prompt-optimizer/GenerationsPanel/types';

const makeGeneration = (
  overrides: Partial<Generation> & Pick<Generation, 'id'>
): Generation => ({
  id: overrides.id,
  tier: overrides.tier ?? 'draft',
  status: overrides.status ?? 'completed',
  model: overrides.model ?? 'wan-2.5',
  prompt: overrides.prompt ?? 'A cinematic skyline',
  promptVersionId: overrides.promptVersionId ?? 'v1',
  createdAt: overrides.createdAt ?? 1,
  completedAt: overrides.completedAt ?? overrides.createdAt ?? 1,
  mediaType: overrides.mediaType ?? 'video',
  mediaUrls: overrides.mediaUrls ?? ['https://example.com/video.mp4'],
  ...(overrides.thumbnailUrl !== undefined
    ? { thumbnailUrl: overrides.thumbnailUrl }
    : {}),
  ...(overrides.mediaAssetIds ? { mediaAssetIds: overrides.mediaAssetIds } : {}),
  ...(overrides.error ? { error: overrides.error } : {}),
});

describe('CanvasGenerationStrip', () => {
  it('orders generations newest-first and applies category counters', () => {
    const generations: Generation[] = [
      makeGeneration({
        id: 'draft-old',
        tier: 'draft',
        createdAt: 10,
        completedAt: 20,
      }),
      makeGeneration({
        id: 'render-new',
        tier: 'render',
        createdAt: 30,
        completedAt: 40,
      }),
      makeGeneration({
        id: 'preview-mid',
        tier: 'draft',
        mediaType: 'image-sequence',
        mediaUrls: ['https://example.com/frame.png'],
        createdAt: 20,
        completedAt: 25,
      }),
    ];

    render(
      <CanvasGenerationStrip
        generations={generations}
        selectedGenerationId={null}
        onSelectGeneration={vi.fn()}
      />
    );

    const strip = screen.getByTestId('canvas-generation-strip');
    const buttons = within(strip).getAllByRole('button');
    expect(buttons[0]).toHaveAttribute('data-testid', 'generation-strip-item-render-new');
    expect(buttons[1]).toHaveAttribute('data-testid', 'generation-strip-item-preview-mid');
    expect(buttons[2]).toHaveAttribute('data-testid', 'generation-strip-item-draft-old');
    expect(buttons[0]).toHaveTextContent('R1');
    expect(buttons[1]).toHaveTextContent('P1');
    expect(buttons[2]).toHaveTextContent('D1');
  });

  it('marks selected generation with active border styles', () => {
    const generation = makeGeneration({ id: 'selected-gen' });

    render(
      <CanvasGenerationStrip
        generations={[generation]}
        selectedGenerationId="selected-gen"
        onSelectGeneration={vi.fn()}
      />
    );

    expect(screen.getByTestId('generation-strip-item-selected-gen').className).toContain(
      'border-[#E2E6EF]'
    );
  });

  it('shows pending and failed overlays', () => {
    const pending = makeGeneration({
      id: 'pending-gen',
      status: 'generating',
      mediaUrls: [],
      completedAt: null,
    });
    const failed = makeGeneration({
      id: 'failed-gen',
      status: 'failed',
      error: 'Boom',
    });

    render(
      <CanvasGenerationStrip
        generations={[pending, failed]}
        selectedGenerationId={null}
        onSelectGeneration={vi.fn()}
      />
    );

    expect(screen.getByTestId('generation-strip-pending-pending-gen')).toBeInTheDocument();
    expect(screen.getByTestId('generation-strip-failed-failed-gen')).toBeInTheDocument();
  });

  it('calls onSelectGeneration for clicked thumbnail', () => {
    const onSelectGeneration = vi.fn();
    const generation = makeGeneration({ id: 'click-gen' });

    render(
      <CanvasGenerationStrip
        generations={[generation]}
        selectedGenerationId={null}
        onSelectGeneration={onSelectGeneration}
      />
    );

    fireEvent.click(screen.getByTestId('generation-strip-item-click-gen'));
    expect(onSelectGeneration).toHaveBeenCalledWith('click-gen');
  });
});
