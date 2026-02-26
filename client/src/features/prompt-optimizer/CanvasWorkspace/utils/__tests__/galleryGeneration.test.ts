import { describe, expect, it } from 'vitest';
import { buildGalleryGenerationEntries } from '../galleryGeneration';
import type { Generation } from '@/features/prompt-optimizer/GenerationsPanel/types';

const createGeneration = (
  overrides: Partial<Generation> = {}
): Generation => ({
  id: 'gen-1',
  tier: 'render',
  status: 'completed',
  model: 'sora',
  prompt: 'Prompt',
  promptVersionId: 'version-1',
  createdAt: 1000,
  completedAt: 2000,
  mediaType: 'video',
  mediaUrls: [],
  ...overrides,
});

describe('buildGalleryGenerationEntries', () => {
  it('does not use raw video URLs as gallery thumbnail fallback', () => {
    const entries = buildGalleryGenerationEntries({
      versions: [],
      runtimeGenerations: [
        createGeneration({
          mediaType: 'video',
          thumbnailUrl: null,
          mediaUrls: ['/api/preview/video/content/users/u1/generations/video.mp4'],
        }),
      ],
    });

    expect(entries[0]?.gallery.thumbnailUrl).toBeNull();
  });

  it('ignores video-like thumbnail URLs for video generations', () => {
    const entries = buildGalleryGenerationEntries({
      versions: [],
      runtimeGenerations: [
        createGeneration({
          mediaType: 'video',
          thumbnailUrl: '/api/preview/video/content/users/u1/generations/video.mp4',
          mediaUrls: ['https://storage.example.com/users/u1/generations/video.mp4'],
        }),
      ],
    });

    expect(entries[0]?.gallery.thumbnailUrl).toBeNull();
  });

  it('still falls back to media URL for non-video generations', () => {
    const entries = buildGalleryGenerationEntries({
      versions: [],
      runtimeGenerations: [
        createGeneration({
          mediaType: 'image',
          thumbnailUrl: null,
          mediaUrls: ['https://storage.example.com/users/u1/previews/images/preview.webp'],
        }),
      ],
    });

    expect(entries[0]?.gallery.thumbnailUrl).toBe(
      'https://storage.example.com/users/u1/previews/images/preview.webp'
    );
  });

  it('uses version preview image when generation thumbnail is missing', () => {
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
          generations: [
            createGeneration({
              mediaType: 'video',
              thumbnailUrl: null,
              mediaUrls: ['/api/preview/video/content/asset-1'],
            }),
          ],
        },
      ],
      runtimeGenerations: [],
    });

    expect(entries[0]?.gallery.thumbnailUrl).toBe(
      'https://storage.example.com/users/u1/previews/images/version-thumb.webp'
    );
  });
});
