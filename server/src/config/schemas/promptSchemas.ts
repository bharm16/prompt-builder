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
  targetModel: z.string()
    .max(64, 'Target model must not exceed 64 characters')
    .optional()
    .nullable(),
  context: z.object({
    specificAspects: z.string().max(5000).optional(),
    backgroundLevel: z.string().max(1000).optional(),
    intendedUse: z.string().max(1000).optional(),
  })
    .optional()
    .nullable(),
  brainstormContext: z.object({
    elements: z.record(z.string(), z.unknown()).optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
    version: z.string().optional(),
    createdAt: z.number().optional(),
  })
    .optional()
    .nullable(),
  generationParams: z
    .record(z.string(), z.union([z.string(), z.number(), z.boolean()]))
    .optional()
    .nullable(),
  startImage: z.string()
    .max(10000, 'startImage must not exceed 10,000 characters')
    .optional(),
  constraintMode: z.enum(['strict', 'flexible', 'transform'])
    .optional(),
  skipCache: z.boolean().optional().default(false),
  lockedSpans: z.array(z.object({
    id: z.string().max(512).optional(),
    text: z.string().min(1).max(2000),
    leftCtx: z.string().max(2000).optional().nullable(),
    rightCtx: z.string().max(2000).optional().nullable(),
    category: z.string().max(256).optional().nullable(),
    source: z.string().max(256).optional().nullable(),
    confidence: z.number().optional().nullable(),
  }))
    .optional()
    .default([]),
});

export type PromptRequest = z.infer<typeof promptSchema>;

export const compileSchema = z.object({
  prompt: z.string()
    .min(1, 'Prompt is required')
    .max(10000, 'Prompt must not exceed 10,000 characters'),
  targetModel: z.string()
    .min(1, 'Target model is required')
    .max(64, 'Target model must not exceed 64 characters'),
  context: z.object({
    specificAspects: z.string().max(5000).optional(),
    backgroundLevel: z.string().max(1000).optional(),
    intendedUse: z.string().max(1000).optional(),
  })
    .optional()
    .nullable(),
});

export type CompileRequest = z.infer<typeof compileSchema>;
