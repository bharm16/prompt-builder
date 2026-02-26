import { describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { ContinuityShot } from '@/features/continuity/types';
import type { PromptVersionEntry } from '@features/prompt-optimizer/types/domain/prompt-session';
import { useShotGenerations } from '../useShotGenerations';

const createShot = (
  overrides: Partial<ContinuityShot> = {}
): ContinuityShot => ({
  id: 'shot-1',
  sessionId: 'session-1',
  sequenceIndex: 1,
  userPrompt: 'A prompt',
  continuityMode: 'none',
  styleStrength: 0.5,
  styleReferenceId: null,
  modelId: 'sora',
  status: 'completed',
  createdAt: '2026-02-20T18:00:00.000Z',
  ...overrides,
});

const createVersion = (
  overrides: Partial<PromptVersionEntry> = {}
): PromptVersionEntry => ({
  versionId: 'v1',
  signature: 'sig',
  prompt: 'A prompt',
  timestamp: '2026-02-20T18:00:00.000Z',
  ...overrides,
});

describe('useShotGenerations', () => {
  it('uses latest version preview image and storage path metadata for generated shot media', () => {
    const shot = createShot({
      videoAssetId: 'fallback-asset',
      versions: [
        createVersion({
          preview: {
            generatedAt: '2026-02-20T18:01:00.000Z',
            imageUrl: 'https://storage.example.com/users/u1/previews/images/thumb.webp',
          },
          video: {
            generatedAt: '2026-02-20T18:01:00.000Z',
            videoUrl: '/api/preview/video/content/asset-from-version',
            storagePath: 'users/u1/generations/version-video.mp4',
            assetId: 'asset-from-version',
          },
        }),
      ] as unknown as ContinuityShot['versions'],
    });

    const { result } = renderHook(() =>
      useShotGenerations({
        currentShot: shot,
        updateShot: vi.fn(),
      })
    );

    const generation = result.current.sequenceGenerations[0];
    expect(generation?.thumbnailUrl).toBe(
      'https://storage.example.com/users/u1/previews/images/thumb.webp'
    );
    expect(generation?.mediaUrls).toEqual(['/api/preview/video/content/asset-from-version']);
    expect(generation?.mediaAssetIds).toEqual(['users/u1/generations/version-video.mp4']);
  });

  it('falls back to shot videoAssetId content URL when version video URL is unavailable', () => {
    const shot = createShot({
      videoAssetId: 'shot-asset-id',
      versions: [createVersion()] as unknown as ContinuityShot['versions'],
    });

    const { result } = renderHook(() =>
      useShotGenerations({
        currentShot: shot,
        updateShot: vi.fn(),
      })
    );

    const generation = result.current.sequenceGenerations[0];
    expect(generation?.mediaUrls).toEqual(['/api/preview/video/content/shot-asset-id']);
    expect(generation?.mediaAssetIds).toEqual(['shot-asset-id']);
  });
});
