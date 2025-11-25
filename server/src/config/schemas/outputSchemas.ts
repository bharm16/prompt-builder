/**
 * LLM Output Schemas
 * 
 * Zod schemas for LLM response expectations.
 * These are referenced by services when enforcing structured outputs and in
 * unit tests to keep fixtures in sync with production payloads.
 */

import { z } from 'zod';

export const compatibilityOutputSchema = z.object({
  score: z.number(),
  feedback: z.string(),
}).passthrough();

export const completeSceneOutputSchema = z.record(z.unknown());

export const variationsOutputSchema = z.array(
  z.object({
    name: z.string(),
    description: z.string(),
    elements: z.record(z.unknown()),
  }).passthrough()
);

export const parseConceptOutputSchema = z.object({
  subject: z.string(),
  action: z.string(),
  location: z.string(),
  time: z.string(),
  mood: z.string(),
  style: z.string(),
  event: z.string(),
}).passthrough();

export const refinementsOutputSchema = z.record(z.unknown());

export const conflictsOutputSchema = z.array(
  z.object({
    elements: z.record(z.unknown()),
    severity: z.string(),
    message: z.string(),
  }).passthrough()
);

export const technicalParamsOutputSchema = z.object({
  camera: z.record(z.unknown()),
  lighting: z.record(z.unknown()),
  color: z.record(z.unknown()),
  format: z.record(z.unknown()),
  audio: z.record(z.unknown()),
  postProduction: z.record(z.unknown()),
}).passthrough();

export const validatePromptOutputSchema = z.object({
  score: z.number(),
  breakdown: z.record(z.unknown()),
  feedback: z.string(),
  strengths: z.array(z.string()),
  weaknesses: z.array(z.string()),
}).passthrough();

export const smartDefaultsOutputSchema = z.array(z.unknown());

export const alternativePhrasingsOutputSchema = z.array(
  z.object({
    text: z.string(),
    tone: z.string(),
  }).passthrough()
);

