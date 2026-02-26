import { describe, expect, it } from 'vitest';

import {
  AssetSchema,
  AssetListResponseSchema,
  ResolvedPromptSchema,
  TriggerValidationSchema,
} from '@features/assets/api/schemas';

describe('Asset contract', () => {
  const minimalAsset = {
    id: 'asset-1',
    userId: 'user-1',
    type: 'character' as const,
    trigger: '@hero',
    name: 'Hero Character',
    textDefinition: 'A tall warrior with silver hair',
    referenceImages: [],
    usageCount: 0,
    lastUsedAt: null,
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
  };

  it('accepts a minimal character asset', () => {
    expect(AssetSchema.safeParse(minimalAsset).success).toBe(true);
  });

  it('accepts an asset with reference images and face embedding', () => {
    const result = AssetSchema.safeParse({
      ...minimalAsset,
      faceEmbedding: 'base64encodedstring',
      referenceImages: [
        {
          id: 'img-1',
          url: 'https://storage.example.com/ref.png',
          thumbnailUrl: 'https://storage.example.com/ref-thumb.png',
          isPrimary: true,
          metadata: {
            angle: 'front',
            expression: 'neutral',
            uploadedAt: '2025-01-01T00:00:00Z',
            width: 512,
            height: 512,
            sizeBytes: 102400,
          },
        },
      ],
    });

    expect(result.success).toBe(true);
  });

  it('accepts nullable face embedding', () => {
    expect(AssetSchema.safeParse({ ...minimalAsset, faceEmbedding: null }).success).toBe(true);
  });

  it('accepts null metadata angle and expression in reference images', () => {
    const result = AssetSchema.safeParse({
      ...minimalAsset,
      referenceImages: [
        {
          id: 'img-2',
          url: 'https://example.com/img.png',
          thumbnailUrl: 'https://example.com/thumb.png',
          isPrimary: false,
          metadata: {
            angle: null,
            expression: null,
            styleType: null,
            timeOfDay: null,
            lighting: null,
            uploadedAt: '2025-01-01T00:00:00Z',
            width: 256,
            height: 256,
            sizeBytes: 51200,
          },
        },
      ],
    });

    expect(result.success).toBe(true);
  });

  it('rejects assets with invalid type', () => {
    expect(AssetSchema.safeParse({ ...minimalAsset, type: 'weapon' }).success).toBe(false);
  });

  it('accepts all valid asset types', () => {
    for (const type of ['character', 'style', 'location', 'object'] as const) {
      expect(AssetSchema.safeParse({ ...minimalAsset, type }).success).toBe(true);
    }
  });

  it('rejects assets missing required fields', () => {
    expect(AssetSchema.safeParse({ id: 'x' }).success).toBe(false);
    expect(AssetSchema.safeParse({ id: 'x', userId: 'y', type: 'character' }).success).toBe(false);
  });
});

describe('AssetListResponse contract', () => {
  it('accepts a valid list response with type counts', () => {
    const result = AssetListResponseSchema.safeParse({
      assets: [],
      total: 0,
      byType: { character: 0, style: 0, location: 0, object: 0 },
    });

    expect(result.success).toBe(true);
  });

  it('rejects list response missing byType breakdown', () => {
    expect(AssetListResponseSchema.safeParse({ assets: [], total: 0 }).success).toBe(false);
  });
});

describe('ResolvedPrompt contract', () => {
  it('accepts a minimal resolved prompt', () => {
    const result = ResolvedPromptSchema.safeParse({
      originalText: '@hero walks down the street',
      expandedText: 'A tall warrior with silver hair walks down the street',
      assets: [],
      characters: [],
      styles: [],
      locations: [],
      objects: [],
      requiresKeyframe: false,
      negativePrompts: [],
      referenceImages: [],
    });

    expect(result.success).toBe(true);
  });

  it('accepts resolved prompt with reference images', () => {
    const result = ResolvedPromptSchema.safeParse({
      originalText: '@hero in @castle',
      expandedText: 'A warrior in a medieval castle',
      assets: [],
      characters: [],
      styles: [],
      locations: [],
      objects: [],
      requiresKeyframe: true,
      negativePrompts: ['blurry', 'low quality'],
      referenceImages: [
        {
          assetId: 'asset-1',
          assetType: 'character',
          assetName: 'Hero',
          imageUrl: 'https://example.com/hero.png',
        },
      ],
    });

    expect(result.success).toBe(true);
  });

  it('rejects resolved prompt missing required arrays', () => {
    expect(
      ResolvedPromptSchema.safeParse({
        originalText: 'test',
        expandedText: 'test',
      }).success
    ).toBe(false);
  });
});

describe('TriggerValidation contract', () => {
  it('accepts valid trigger validation response', () => {
    const result = TriggerValidationSchema.safeParse({
      isValid: true,
      missingTriggers: [],
      foundAssets: [],
    });

    expect(result.success).toBe(true);
  });

  it('accepts invalid trigger validation with missing triggers', () => {
    const result = TriggerValidationSchema.safeParse({
      isValid: false,
      missingTriggers: ['@unknown_character'],
      foundAssets: [],
    });

    expect(result.success).toBe(true);
  });
});
