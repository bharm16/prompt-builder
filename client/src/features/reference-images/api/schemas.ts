import { z } from 'zod';

const ReferenceImageMetadataSchema = z
  .object({
    width: z.number(),
    height: z.number(),
    sizeBytes: z.number(),
    contentType: z.string(),
    source: z.string().nullable().optional(),
    originalName: z.string().nullable().optional(),
  })
  .passthrough();

export const ReferenceImageSchema = z
  .object({
    id: z.string(),
    userId: z.string(),
    imageUrl: z.string(),
    thumbnailUrl: z.string(),
    storagePath: z.string(),
    thumbnailPath: z.string(),
    label: z.string().nullable().optional(),
    metadata: ReferenceImageMetadataSchema,
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .passthrough();

export const ReferenceImageListSchema = z.object({
  images: z.array(ReferenceImageSchema),
});
