import { z } from 'zod';

export const ModelRecommendationModeSchema = z.enum(['t2v', 'i2v']);

export const LabeledSpanSchema = z.object({
  text: z.string().min(1),
  role: z.string().optional(),
  category: z.string().optional(),
  start: z.number().optional(),
  end: z.number().optional(),
  confidence: z.number().min(0).max(1).optional(),
});

export const ModelRecommendationRequestSchema = z.object({
  prompt: z.string().min(1),
  mode: ModelRecommendationModeSchema.optional(),
  spans: z.array(LabeledSpanSchema).optional(),
  durationSeconds: z.number().int().positive().optional(),
});

export type ModelRecommendationRequestSchemaType = z.infer<typeof ModelRecommendationRequestSchema>;
