import { z } from 'zod';

const AssetTypeSchema = z.enum([
  'character',
  'style',
  'location',
  'object',
]);

const AssetReferenceImageSchema = z
  .object({
    id: z.string(),
    url: z.string(),
    thumbnailUrl: z.string(),
    isPrimary: z.boolean(),
    storagePath: z.string().optional(),
    thumbnailPath: z.string().optional(),
    metadata: z
      .object({
        angle: z
          .enum(['front', 'profile', 'three-quarter', 'back'])
          .nullable()
          .optional(),
        expression: z
          .enum(['neutral', 'smiling', 'serious', 'expressive'])
          .nullable()
          .optional(),
        styleType: z
          .enum(['color-palette', 'mood-board', 'reference-frame'])
          .nullable()
          .optional(),
        timeOfDay: z
          .enum(['day', 'night', 'golden-hour', 'blue-hour'])
          .nullable()
          .optional(),
        lighting: z
          .enum(['natural', 'studio', 'dramatic', 'backlit'])
          .nullable()
          .optional(),
        uploadedAt: z.string(),
        width: z.number(),
        height: z.number(),
        sizeBytes: z.number(),
      })
      .passthrough(),
  })
  .passthrough();

export const AssetSchema = z
  .object({
    id: z.string(),
    userId: z.string(),
    type: AssetTypeSchema,
    trigger: z.string(),
    name: z.string(),
    textDefinition: z.string(),
    negativePrompt: z.string().optional(),
    referenceImages: z.array(AssetReferenceImageSchema),
    faceEmbedding: z.string().nullable().optional(),
    usageCount: z.number(),
    lastUsedAt: z.string().nullable(),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .passthrough();

export const AssetListResponseSchema = z
  .object({
    assets: z.array(AssetSchema),
    total: z.number(),
    byType: z.object({
      character: z.number(),
      style: z.number(),
      location: z.number(),
      object: z.number(),
    }),
  })
  .passthrough();

const ResolvedPromptReferenceImageSchema = z.object({
  assetId: z.string(),
  assetType: AssetTypeSchema,
  assetName: z.string().optional(),
  imageUrl: z.string(),
});

export const ResolvedPromptSchema = z
  .object({
    originalText: z.string(),
    expandedText: z.string(),
    assets: z.array(AssetSchema),
    characters: z.array(AssetSchema),
    styles: z.array(AssetSchema),
    locations: z.array(AssetSchema),
    objects: z.array(AssetSchema),
    requiresKeyframe: z.boolean(),
    negativePrompts: z.array(z.string()),
    referenceImages: z.array(ResolvedPromptReferenceImageSchema),
  })
  .passthrough();

export const AssetSuggestionSchema = z
  .object({
    id: z.string(),
    type: AssetTypeSchema,
    trigger: z.string(),
    name: z.string(),
    thumbnailUrl: z.string().optional(),
  })
  .passthrough();

export const TriggerValidationSchema = z
  .object({
    isValid: z.boolean(),
    missingTriggers: z.array(z.string()),
    foundAssets: z.array(AssetSchema),
  })
  .passthrough();

export const AssetImageUploadResponseSchema = z
  .object({
    image: AssetReferenceImageSchema,
    warnings: z.array(z.string()).optional(),
  })
  .passthrough();

export const AssetForGenerationSchema = z
  .object({
    id: z.string(),
    type: AssetTypeSchema,
    trigger: z.string(),
    name: z.string(),
    textDefinition: z.string(),
    negativePrompt: z.string().optional(),
    primaryImageUrl: z.string().nullable(),
    referenceImages: z.array(AssetReferenceImageSchema),
    faceEmbedding: z.string().nullable().optional(),
  })
  .passthrough();
