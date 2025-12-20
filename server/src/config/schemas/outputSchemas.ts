/**
 * LLM Output Schemas
 * 
 * Zod schemas for LLM response expectations.
 * These are referenced by services when enforcing structured outputs and in
 * unit tests to keep fixtures in sync with production payloads.
 */

import { z } from 'zod';

export const compatibilityOutputSchema = z.looseObject({
  score: z.number(),
  feedback: z.string(),
});

export const completeSceneOutputSchema = z.record(z.string(), z.unknown());

export const variationsOutputSchema = z.array(
  z.looseObject({
    name: z.string(),
    description: z.string(),
    elements: z.record(z.string(), z.unknown()),
  })
);

export const parseConceptOutputSchema = z.looseObject({
  subject: z.string(),
  action: z.string(),
  location: z.string(),
  time: z.string(),
  mood: z.string(),
  style: z.string(),
  event: z.string(),
});

export const refinementsOutputSchema = z.record(z.string(), z.unknown());

export const conflictsOutputSchema = z.array(
  z.looseObject({
    elements: z.record(z.string(), z.unknown()),
    severity: z.string(),
    message: z.string(),
  })
);

export const technicalParamsOutputSchema = z.looseObject({
  camera: z.record(z.string(), z.unknown()),
  lighting: z.record(z.string(), z.unknown()),
  color: z.record(z.string(), z.unknown()),
  format: z.record(z.string(), z.unknown()),
  audio: z.record(z.string(), z.unknown()),
  postProduction: z.record(z.string(), z.unknown()),
});

export const validatePromptOutputSchema = z.looseObject({
  score: z.number(),
  breakdown: z.record(z.string(), z.unknown()),
  feedback: z.string(),
  strengths: z.array(z.string()),
  weaknesses: z.array(z.string()),
});

export const smartDefaultsOutputSchema = z.array(z.unknown());

export const alternativePhrasingsOutputSchema = z.array(
  z.looseObject({
    text: z.string(),
    tone: z.string(),
  })
);

