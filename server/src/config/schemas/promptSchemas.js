/**
 * Prompt Validation Schemas
 * 
 * Joi schemas for validating prompt optimization requests.
 */

import Joi from 'joi';

export const promptSchema = Joi.object({
  prompt: Joi.string().required().max(10000).messages({
    'string.empty': 'Prompt is required',
    'string.max': 'Prompt must not exceed 10,000 characters',
    'any.required': 'Prompt is required',
  }),
  mode: Joi.string()
    .valid('video')
    .optional()
    .default('video')
    .messages({
      'any.only': 'Mode must be video',
    }),
  context: Joi.object({
    specificAspects: Joi.string().allow('').max(5000),
    backgroundLevel: Joi.string().allow('').max(1000),
    intendedUse: Joi.string().allow('').max(1000),
  })
    .optional()
    .allow(null),
  brainstormContext: Joi.object({
    elements: Joi.object().pattern(Joi.string(), Joi.any()).optional(),
    metadata: Joi.object().optional(),
    version: Joi.string().optional(),
    createdAt: Joi.number().optional(),
  })
    .optional()
    .allow(null),
});

export const semanticParseSchema = Joi.object({
  text: Joi.string().required().max(50000).messages({
    'string.empty': 'Text is required for semantic parsing',
    'any.required': 'Text is required for semantic parsing',
    'string.max': 'Text must not exceed 50,000 characters',
  }),
});

