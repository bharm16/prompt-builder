import { z } from 'zod';
import type { ImagePreviewSpeedMode } from '@services/image-generation/providers/types';

const SPEED_MODE_OPTIONS = [
  'Lightly Juiced',
  'Juiced',
  'Extra Juiced',
  'Real Time',
] as const;

const SPEED_MODE_SET = new Set<string>(SPEED_MODE_OPTIONS);
const SPEED_MODE_MESSAGE =
  'speedMode must be one of: Lightly Juiced, Juiced, Extra Juiced, Real Time';

const SpeedModeSchema = z
  .string()
  .trim()
  .min(1, 'speedMode must be a string')
  .refine((value) => SPEED_MODE_SET.has(value), { message: SPEED_MODE_MESSAGE })
  .transform((value) => value as ImagePreviewSpeedMode);

const ImageStoryboardGenerateRequestSchema = z.object({
  prompt: z
    .string()
    .trim()
    .min(1, 'Prompt must be a non-empty string'),
  aspectRatio: z
    .string()
    .trim()
    .min(1, 'aspectRatio must be a non-empty string')
    .optional(),
  seedImageUrl: z
    .string()
    .trim()
    .min(1, 'seedImageUrl must be a non-empty string')
    .optional(),
  speedMode: SpeedModeSchema.optional(),
  seed: z
    .number()
    .finite('seed must be a finite number')
    .optional(),
});

export type ImageStoryboardGenerateRequest = z.infer<
  typeof ImageStoryboardGenerateRequestSchema
>;

export type ImageStoryboardGenerateParseResult =
  | { ok: true; data: ImageStoryboardGenerateRequest }
  | { ok: false; error: string };

export const parseImageStoryboardGenerateRequest = (
  body: unknown
): ImageStoryboardGenerateParseResult => {
  const result = ImageStoryboardGenerateRequestSchema.safeParse(body);
  if (!result.success) {
    const message = result.error.issues[0]?.message ?? 'Invalid request data';
    return { ok: false, error: message };
  }
  return { ok: true, data: result.data };
};
