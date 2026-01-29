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

export const ModelRecommendationEventSchema = z.object({
  event: z.enum([
    'recommendation_viewed',
    'compare_opened',
    'model_selected',
    'generation_started',
  ]),
  recommendationId: z.string().optional(),
  promptId: z.string().optional(),
  recommendedModelId: z.string().optional(),
  selectedModelId: z.string().optional(),
  mode: ModelRecommendationModeSchema.optional(),
  durationSeconds: z.number().int().positive().optional(),
  timeSinceRecommendationMs: z.number().int().nonnegative().optional(),
});

export type ModelRecommendationEventSchemaType = z.infer<typeof ModelRecommendationEventSchema>;
