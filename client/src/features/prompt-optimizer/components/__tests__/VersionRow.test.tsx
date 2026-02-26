import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, waitFor } from '@testing-library/react';
import type { Generation } from '@/features/prompt-optimizer/GenerationsPanel/types';
import { VersionRow, type VersionEntry } from '../VersionRow';

const buildGeneration = (overrides: Partial<Generation> = {}): Generation => ({
  id: 'gen-1',
  tier: 'draft',
  status: 'completed',
  model: 'wan-2.2',
  prompt: 'test prompt',
  promptVersionId: 'v-1',
  createdAt: 1700000000000,
  completedAt: 1700000001000,
  mediaType: 'video',
  mediaUrls: ['https://example.com/video.mp4'],
  thumbnailUrl: 'https://example.com/thumb.jpg',
  ...overrides,
});

const renderRow = (entry: VersionEntry) =>
  render(
    <VersionRow
      entry={entry}
      index={0}
      total={1}
      isSelected={true}
      onSelect={vi.fn()}
      layout="horizontal"
    />
  );

describe('VersionRow', () => {
  it('uses generation thumbnail when preview.imageUrl is missing', () => {
    const { container } = renderRow({
      versionId: 'v-1',
      label: 'v1',
      generations: [buildGeneration()],
    });

    const image = container.querySelector('img');
    expect(image).not.toBeNull();
    expect(image).toHaveAttribute('src', 'https://example.com/thumb.jpg');
  });

  it('falls back to generation thumbnail when preview image fails', async () => {
    const { container } = renderRow({
      versionId: 'v-1',
      label: 'v1',
      preview: {
        generatedAt: new Date().toISOString(),
        imageUrl: 'https://example.com/expired-preview.jpg',
      },
      generations: [buildGeneration()],
    });

    const firstImage = container.querySelector('img');
    expect(firstImage).not.toBeNull();
    expect(firstImage).toHaveAttribute('src', 'https://example.com/expired-preview.jpg');

    fireEvent.error(firstImage!);

    await waitFor(() => {
      const nextImage = container.querySelector('img');
      expect(nextImage).not.toBeNull();
      expect(nextImage).toHaveAttribute('src', 'https://example.com/thumb.jpg');
    });
  });

  it('shows placeholder when all thumbnail candidates fail', async () => {
    const { container } = renderRow({
      versionId: 'v-1',
      label: 'v1',
      preview: {
        generatedAt: new Date().toISOString(),
        imageUrl: 'https://example.com/expired-preview.jpg',
      },
    });

    const firstImage = container.querySelector('img');
    expect(firstImage).not.toBeNull();

    fireEvent.error(firstImage!);

    await waitFor(() => {
      expect(container.querySelector('img')).toBeNull();
    });
  });
});
