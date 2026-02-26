import { describe, expect, it } from 'vitest';
import type { Generation } from '@/features/prompt-optimizer/GenerationsPanel/types';
import { buildGalleryGenerationEntries } from '../galleryGeneration';

const createGeneration = (
  overrides: Partial<Generation> = {}
): Generation => ({
  id: 'gen-pending',
  tier: 'draft',
  status: 'pending',
  model: 'flux-kontext',
  prompt: 'Prompt',
  promptVersionId: 'version-1',
  createdAt: 1000,
  completedAt: null,
  mediaType: 'image-sequence',
  mediaUrls: [],
  thumbnailUrl: null,
  ...overrides,
});

describe('regression: gallery thumbnail source during pending generation', () => {
  it('does not use version preview image while generation is pending', () => {
    const entries = buildGalleryGenerationEntries({
      versions: [
        {
          versionId: 'v1',
          signature: 'sig',
          prompt: 'Prompt',
          timestamp: '2026-02-20T18:00:00.000Z',
          preview: {
            generatedAt: '2026-02-20T18:00:00.000Z',
            imageUrl: 'https://storage.example.com/users/u1/previews/images/version-thumb.webp',
          },
          generations: [createGeneration()],
        },
      ],
      runtimeGenerations: [],
    });

    expect(entries[0]?.gallery.thumbnailUrl).toBeNull();
  });
});
