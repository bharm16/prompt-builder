/**
 * Prompt Validation Schemas
 * 
 * Zod schemas for validating prompt optimization requests.
 */

import { z } from 'zod';

export const promptSchema = z.object({
  prompt: z.string()
    .min(1, 'Prompt is required')
    .max(10000, 'Prompt must not exceed 10,000 characters'),
  mode: z.enum(['video'])
    .optional()
    .default('video'),
  context: z.object({
    specificAspects: z.string().max(5000).optional(),
    backgroundLevel: z.string().max(1000).optional(),
    intendedUse: z.string().max(1000).optional(),
  })
    .optional()
    .nullable(),
  brainstormContext: z.object({
    elements: z.record(z.unknown()).optional(),
    metadata: z.record(z.unknown()).optional(),
    version: z.string().optional(),
    createdAt: z.number().optional(),
  })
    .optional()
    .nullable(),
});

export type PromptRequest = z.infer<typeof promptSchema>;

