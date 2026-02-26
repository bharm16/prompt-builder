import { describe, it, expect, vi } from 'vitest';
import AssetService from '../AssetService';
import TriggerValidationService from '../TriggerValidationService';
import type { Asset } from '@shared/types/asset';

describe('AssetService', () => {
  const baseCharacterAsset = (overrides: Partial<Asset> = {}): Asset => ({
    id: 'asset-1',
    userId: 'user-1',
    type: 'character',
    trigger: '@alice',
    name: 'Alice',
    textDefinition: 'Character',
    negativePrompt: '',
    referenceImages: [],
    faceEmbedding: null,
    usageCount: 0,
    lastUsedAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  });

  it('rejects invalid asset types', async () => {
    const repository = {
      triggerExists: vi.fn().mockResolvedValue(false),
      create: vi.fn(),
    };
    const service = new AssetService(
      repository as any,
      {} as any,
      {} as any,
      new TriggerValidationService(),
      null
    );

    await expect(
      service.createAsset('user-1', {
        type: 'invalid' as any,
        trigger: '@Alice',
        name: 'Alice',
        textDefinition: 'Test',
      })
    ).rejects.toThrow('Invalid asset type');
  });

  it('creates assets with normalized triggers', async () => {
    const mockAsset = {
      id: 'asset-1',
      userId: 'user-1',
      type: 'character',
      trigger: '@alice',
      name: 'Alice',
      textDefinition: 'Test',
      negativePrompt: '',
      referenceImages: [],
      faceEmbedding: null,
      usageCount: 0,
      lastUsedAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const repository = {
      triggerExists: vi.fn().mockResolvedValue(false),
      create: vi.fn().mockResolvedValue(mockAsset),
    };

    const service = new AssetService(
      repository as any,
      {} as any,
      {} as any,
      new TriggerValidationService(),
      null
    );

    const result = await service.createAsset('user-1', {
      type: 'character',
      trigger: '@Alice',
      name: 'Alice',
      textDefinition: 'Test',
    });

    expect(result.trigger).toBe('@alice');
    expect(repository.create).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({ trigger: '@alice' })
    );
  });

  it('allows empty text definitions for character assets', async () => {
    const mockAsset = {
      id: 'asset-2',
      userId: 'user-1',
      type: 'character',
      trigger: '@mara',
      name: 'Mara',
      textDefinition: '',
      negativePrompt: '',
      referenceImages: [],
      faceEmbedding: null,
      usageCount: 0,
      lastUsedAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const repository = {
      triggerExists: vi.fn().mockResolvedValue(false),
      create: vi.fn().mockResolvedValue(mockAsset),
    };

    const service = new AssetService(
      repository as any,
      {} as any,
      {} as any,
      new TriggerValidationService(),
      null
    );

    const result = await service.createAsset('user-1', {
      type: 'character',
      trigger: '@Mara',
      name: 'Mara',
    });

    expect(result.textDefinition).toBe('');
  });

  it('requires text definitions for non-character assets', async () => {
    const repository = {
      triggerExists: vi.fn().mockResolvedValue(false),
      create: vi.fn(),
    };

    const service = new AssetService(
      repository as any,
      {} as any,
      {} as any,
      new TriggerValidationService(),
      null
    );

    await expect(
      service.createAsset('user-1', {
        type: 'style',
        trigger: '@Noir',
        name: 'Noir',
        textDefinition: '   ',
      })
    ).rejects.toThrow('Text definition is required for this asset type');
  });

  it('delegates prompt resolution helpers to resolver service', async () => {
    const repository = {
      getById: vi.fn(),
    };
    const resolver = {
      resolvePrompt: vi.fn().mockResolvedValue({ expandedText: 'expanded', assets: [] }),
      getSuggestions: vi.fn().mockResolvedValue(['@alice']),
      validateTriggers: vi.fn().mockResolvedValue({ isValid: true, missingTriggers: [], foundAssets: [] }),
    };

    const service = new AssetService(
      repository as any,
      {} as any,
      resolver as any,
      new TriggerValidationService(),
      null
    );

    await expect(service.resolvePrompt('user-1', '@alice walks')).resolves.toEqual({
      expandedText: 'expanded',
      assets: [],
    });
    await expect(service.getSuggestions('user-1', '@a')).resolves.toEqual(['@alice']);
    await expect(service.validateTriggers('user-1', '@alice walks')).resolves.toEqual({
      isValid: true,
      missingTriggers: [],
      foundAssets: [],
    });

    expect(resolver.resolvePrompt).toHaveBeenCalledWith('user-1', '@alice walks');
    expect(resolver.getSuggestions).toHaveBeenCalledWith('user-1', '@a');
    expect(resolver.validateTriggers).toHaveBeenCalledWith('user-1', '@alice walks');
  });

  it('rejects addReferenceImage when reference image validation fails', async () => {
    const repository = {
      getById: vi.fn().mockResolvedValue(baseCharacterAsset()),
    };
    const referenceImageService = {
      validateForAssetType: vi.fn().mockResolvedValue({
        isValid: false,
        warnings: [],
        errors: ['Image resolution too low'],
      }),
      processImage: vi.fn(),
      generateThumbnail: vi.fn(),
    };

    const service = new AssetService(
      repository as any,
      referenceImageService as any,
      {} as any,
      new TriggerValidationService(),
      null
    );

    await expect(
      service.addReferenceImage('user-1', 'asset-1', Buffer.from('bad-image'))
    ).rejects.toThrow('Image resolution too low');
  });

  it('throws when character asset has no reference images for generation', async () => {
    const repository = {
      getById: vi.fn().mockResolvedValue(baseCharacterAsset({ referenceImages: [] })),
      incrementUsage: vi.fn(),
    };

    const service = new AssetService(
      repository as any,
      {} as any,
      {} as any,
      new TriggerValidationService(),
      null
    );

    await expect(service.getAssetForGeneration('user-1', 'asset-1')).rejects.toThrow(
      'Character has no reference images'
    );
  });

  it('returns primary generation payload and increments usage', async () => {
    const asset = baseCharacterAsset({
      referenceImages: [
        {
          id: 'img-1',
          url: 'https://example.com/one.png',
          thumbnailUrl: 'https://example.com/one-thumb.png',
          isPrimary: false,
          metadata: {
            uploadedAt: new Date().toISOString(),
            width: 512,
            height: 512,
            sizeBytes: 1000,
          },
        },
        {
          id: 'img-2',
          url: 'https://example.com/two.png',
          thumbnailUrl: 'https://example.com/two-thumb.png',
          isPrimary: true,
          metadata: {
            uploadedAt: new Date().toISOString(),
            width: 512,
            height: 512,
            sizeBytes: 1000,
          },
        },
      ],
      negativePrompt: 'no blur',
      faceEmbedding: 'embedding-blob',
    });

    const repository = {
      getById: vi.fn().mockResolvedValue(asset),
      incrementUsage: vi.fn().mockResolvedValue(undefined),
    };

    const service = new AssetService(
      repository as any,
      {} as any,
      {} as any,
      new TriggerValidationService(),
      null
    );

    const result = await service.getAssetForGeneration('user-1', 'asset-1');

    expect(result.primaryImageUrl).toBe('https://example.com/two.png');
    expect(result.negativePrompt).toBe('no blur');
    expect(result.faceEmbedding).toBe('embedding-blob');
    expect(repository.incrementUsage).toHaveBeenCalledWith('user-1', 'asset-1');
  });
});
