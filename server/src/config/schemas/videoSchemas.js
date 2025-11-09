/**
 * Video/Creative Workflow Validation Schemas
 * 
 * Joi schemas for validating video concept and creative workflow requests.
 */

import Joi from 'joi';

// Element types used across video schemas
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
];

export const creativeSuggestionSchema = Joi.object({
  elementType: Joi.string()
    .required()
    .valid(...ELEMENT_TYPES),
  currentValue: Joi.string().allow('').max(5000),
  context: Joi.alternatives()
    .try(Joi.string().allow('').max(5000), Joi.object().unknown(true))
    .optional(),
  concept: Joi.string().allow('').max(10000),
});

export const videoValidationSchema = Joi.object({
  elementType: Joi.string()
    .valid(...ELEMENT_TYPES)
    .optional(),
  value: Joi.string().allow('').max(10000).optional(),
  elements: Joi.object().required(),
});

export const completeSceneSchema = Joi.object({
  existingElements: Joi.object().required(),
  concept: Joi.string().allow('').max(10000),
  smartDefaultsFor: Joi.string()
    .valid(...ELEMENT_TYPES, 'technical')
    .optional(),
});

export const variationsSchema = Joi.object({
  elements: Joi.object().required(),
  concept: Joi.string().allow('').max(10000),
});

export const parseConceptSchema = Joi.object({
  concept: Joi.string().required().max(10000).messages({
    'string.empty': 'Concept is required',
    'any.required': 'Concept is required',
  }),
});

export const saveTemplateSchema = Joi.object({
  name: Joi.string().required().max(100).messages({
    'string.empty': 'Name is required',
    'any.required': 'Name is required',
  }),
  elements: Joi.object().required(),
  concept: Joi.string().allow('').max(10000),
  userId: Joi.string().allow('').optional(),
});

export const templateRecommendationsSchema = Joi.object({
  userId: Joi.string().allow('').optional(),
  currentElements: Joi.object().optional(),
});

export const recordUserChoiceSchema = Joi.object({
  elementType: Joi.string().required(),
  chosen: Joi.string().required().max(5000),
  rejected: Joi.array().items(Joi.string().max(5000)).default([]),
  userId: Joi.string().allow('').optional(),
});

export const alternativePhrasingsSchema = Joi.object({
  elementType: Joi.string().required(),
  value: Joi.string().required().max(5000),
});

