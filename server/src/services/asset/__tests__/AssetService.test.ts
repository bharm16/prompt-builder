import { describe, it, expect, vi } from 'vitest';
import AssetService from '../AssetService';
import TriggerValidationService from '../TriggerValidationService';

describe('AssetService', () => {
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
});
