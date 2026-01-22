import { describe, it, expect, vi } from 'vitest';
import { AssetResolverService } from '../AssetResolverService';
import type { Asset } from '@shared/types/asset';

const baseAsset = (overrides: Partial<Asset>): Asset => ({
  id: 'asset-1',
  userId: 'user-1',
  type: 'character',
  trigger: '@alice',
  name: 'Alice',
  textDefinition: 'A detailed character',
  negativePrompt: 'no hat',
  referenceImages: [
    {
      id: 'img-1',
      url: 'https://example.com/alice.jpg',
      thumbnailUrl: 'https://example.com/alice-thumb.jpg',
      isPrimary: true,
      metadata: {
        uploadedAt: new Date().toISOString(),
        width: 512,
        height: 512,
        sizeBytes: 1000,
      },
    },
  ],
  faceEmbedding: null,
  usageCount: 0,
  lastUsedAt: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides,
});

describe('AssetResolverService', () => {
  it('expands triggers and appends style modifiers', async () => {
    const assets: Asset[] = [
      baseAsset({ trigger: '@alice', name: 'Alice', textDefinition: 'Red hair' }),
      baseAsset({
        id: 'asset-2',
        type: 'style',
        trigger: '@cyber',
        name: 'CyberNoir',
        textDefinition: 'neon, high contrast',
        referenceImages: [],
      }),
      baseAsset({
        id: 'asset-3',
        type: 'location',
        trigger: '@tokyo',
        name: 'Tokyo Alley',
        textDefinition: 'narrow alley',
        referenceImages: [],
      }),
    ];

    const repository = {
      getByTriggers: vi.fn().mockResolvedValue(assets),
      incrementUsage: vi.fn().mockResolvedValue(undefined),
      createUsageRecord: vi.fn().mockResolvedValue(undefined),
      getAll: vi.fn().mockResolvedValue(assets),
    };

    const service = new AssetResolverService(repository as any);
    const result = await service.resolvePrompt('user-1', '@Alice walks in @Tokyo with @Cyber');

    expect(result.expandedText).toContain('Alice (Red hair)');
    expect(result.expandedText).toContain('neon, high contrast');
    expect(result.characters).toHaveLength(1);
    expect(result.styles).toHaveLength(1);
    expect(result.locations).toHaveLength(1);
    expect(result.negativePrompts).toContain('no hat');
    expect(result.requiresKeyframe).toBe(true);
    expect(repository.incrementUsage).toHaveBeenCalledTimes(assets.length);
  });

  it('identifies missing triggers', async () => {
    const repository = {
      getByTriggers: vi.fn().mockResolvedValue([baseAsset({ trigger: '@alice' })]),
    };
    const service = new AssetResolverService(repository as any);
    const validation = await service.validateTriggers('user-1', '@Alice meets @Bob');
    expect(validation.isValid).toBe(false);
    expect(validation.missingTriggers).toEqual(['@bob']);
  });
});
