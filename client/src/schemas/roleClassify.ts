import { z } from 'zod';

export const LabeledSpanSchema = z.object({
  text: z.string(),
  start: z.number(),
  end: z.number(),
  role: z.string(),
  confidence: z.number(),
});

export const RoleClassifyResponseSchema = z.object({
  spans: z.array(LabeledSpanSchema).default([]),
});

export type LabeledSpan = z.infer<typeof LabeledSpanSchema>;
export type RoleClassifyResponse = z.infer<typeof RoleClassifyResponseSchema>;
