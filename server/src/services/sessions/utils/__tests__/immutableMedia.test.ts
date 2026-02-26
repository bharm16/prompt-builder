import { describe, expect, it } from 'vitest';
import type { SessionPromptVersionEntry, SessionPromptKeyframe } from '@shared/types/session';
import { enforceImmutableKeyframes, enforceImmutableVersions } from '../immutableMedia';

describe('server immutable media utils', () => {
  it('preserves preview storagePath and assetId when incoming differs', () => {
    const existing: SessionPromptVersionEntry = {
      versionId: 'v1',
      signature: 'sig',
      prompt: 'prompt',
      timestamp: 'now',
      preview: {
        generatedAt: 'now',
        imageUrl: 'https://old.example.com/image.png',
        storagePath: 'users/user1/previews/images/original.webp',
        assetId: 'asset-123',
      },
    };
    const incoming: SessionPromptVersionEntry = {
      ...existing,
      preview: {
        generatedAt: 'now',
        imageUrl: 'https://new.example.com/image.png',
        storagePath: 'users/user1/previews/images/overwritten.webp',
        assetId: 'asset-999',
      },
    };

    const result = enforceImmutableVersions([existing], [incoming]);

    expect(result.versions?.[0]?.preview?.storagePath).toBe('users/user1/previews/images/original.webp');
    expect(result.versions?.[0]?.preview?.assetId).toBe('asset-123');
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it('preserves generation mediaAssetIds when incoming differs', () => {
    const existing: SessionPromptVersionEntry = {
      versionId: 'v1',
      signature: 'sig',
      prompt: 'prompt',
      timestamp: 'now',
      generations: [
        {
          id: 'gen-1',
          mediaUrls: ['https://old.example.com/video.mp4'],
          mediaAssetIds: ['users/user1/generations/original.mp4'],
        },
      ],
    };
    const incoming: SessionPromptVersionEntry = {
      ...existing,
      generations: [
        {
          id: 'gen-1',
          mediaUrls: ['https://new.example.com/video.mp4'],
          mediaAssetIds: ['users/user1/generations/overwritten.mp4'],
        },
      ],
    };

    const result = enforceImmutableVersions([existing], [incoming]);
    const generation = result.versions?.[0]?.generations?.[0] as Record<string, unknown> | undefined;

    expect(generation?.mediaAssetIds).toEqual(['users/user1/generations/original.mp4']);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it('preserves keyframe storagePath when incoming differs', () => {
    const existing: SessionPromptKeyframe[] = [
      {
        id: 'kf-1',
        url: 'https://old.example.com/frame.png',
        storagePath: 'users/user1/previews/images/original.webp',
      },
    ];
    const incoming: SessionPromptKeyframe[] = [
      {
        id: 'kf-1',
        url: 'https://new.example.com/frame.png',
        storagePath: 'users/user1/previews/images/overwritten.webp',
      },
    ];

    const result = enforceImmutableKeyframes(existing, incoming);
    expect(result.keyframes?.[0]?.storagePath).toBe('users/user1/previews/images/original.webp');
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it('does not introduce undefined video fields', () => {
    const existing: SessionPromptVersionEntry = {
      versionId: 'v1',
      signature: 'sig',
      prompt: 'prompt',
      timestamp: 'now',
    };
    const incoming: SessionPromptVersionEntry = {
      versionId: 'v1',
      signature: 'sig',
      prompt: 'prompt',
      timestamp: 'now',
    };

    const result = enforceImmutableVersions([existing], [incoming]);
    const merged = result.versions?.[0];

    expect(Object.prototype.hasOwnProperty.call(merged ?? {}, 'video')).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(merged ?? {}, 'preview')).toBe(false);
  });
});
