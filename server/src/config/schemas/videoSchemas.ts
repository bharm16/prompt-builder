/**
 * Video/Creative Workflow Validation Schemas
 * 
 * Zod schemas for validating video concept and creative workflow requests.
 */

import { z } from 'zod';

const ELEMENT_TYPES = [
  'subject',
  'subjectDescriptor1',
  'subjectDescriptor2',
  'subjectDescriptor3',
  'action',
  'location',
  'time',
  'mood',
  'style',
  'event',
] as const;

export type ElementType = typeof ELEMENT_TYPES[number];

export const creativeSuggestionSchema = z.object({
  elementType: z.enum(ELEMENT_TYPES),
  currentValue: z.string().max(5000).optional(),
  context: z.union([
    z.string().max(5000),
    z.record(z.unknown()),
  ]).optional(),
  concept: z.string().max(10000).optional(),
});

export const videoValidationSchema = z.object({
  elementType: z.enum(ELEMENT_TYPES).optional(),
  value: z.string().max(10000).optional(),
  elements: z.record(z.unknown()),
});

export const completeSceneSchema = z.object({
  existingElements: z.record(z.unknown()),
  concept: z.string().max(10000).optional(),
  smartDefaultsFor: z.enum([...ELEMENT_TYPES, 'technical']).optional(),
});

export const variationsSchema = z.object({
  elements: z.record(z.unknown()),
  concept: z.string().max(10000).optional(),
});

export const parseConceptSchema = z.object({
  concept: z.string()
    .min(1, 'Concept is required')
    .max(10000, 'Concept must not exceed 10,000 characters'),
});

export const saveTemplateSchema = z.object({
  name: z.string()
    .min(1, 'Name is required')
    .max(100, 'Name must not exceed 100 characters'),
  elements: z.record(z.unknown()),
  concept: z.string().max(10000).optional(),
  userId: z.string().optional(),
});

export const templateRecommendationsSchema = z.object({
  userId: z.string().optional(),
  currentElements: z.record(z.unknown()).optional(),
});

export const recordUserChoiceSchema = z.object({
  elementType: z.string().min(1),
  chosen: z.string()
    .min(1)
    .max(5000, 'Chosen value must not exceed 5,000 characters'),
  rejected: z.array(z.string().max(5000)).default([]),
  userId: z.string().optional(),
});

export const alternativePhrasingsSchema = z.object({
  elementType: z.string().min(1),
  value: z.string()
    .min(1)
    .max(5000, 'Value must not exceed 5,000 characters'),
});

export type CreativeSuggestionRequest = z.infer<typeof creativeSuggestionSchema>;
export type VideoValidationRequest = z.infer<typeof videoValidationSchema>;
export type CompleteSceneRequest = z.infer<typeof completeSceneSchema>;
export type VariationsRequest = z.infer<typeof variationsSchema>;
export type ParseConceptRequest = z.infer<typeof parseConceptSchema>;
export type SaveTemplateRequest = z.infer<typeof saveTemplateSchema>;
export type TemplateRecommendationsRequest = z.infer<typeof templateRecommendationsSchema>;
export type RecordUserChoiceRequest = z.infer<typeof recordUserChoiceSchema>;
export type AlternativePhrasingsRequest = z.infer<typeof alternativePhrasingsSchema>;

