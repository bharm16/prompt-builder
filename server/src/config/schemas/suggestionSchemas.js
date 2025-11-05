/**
 * Suggestion Validation Schemas
 * 
 * Joi schemas for validating enhancement suggestion requests.
 */

import Joi from 'joi';

export const suggestionSchema = Joi.object({
  highlightedText: Joi.string().required().max(10000).messages({
    'string.empty': 'Highlighted text is required',
    'string.max': 'Highlighted text must not exceed 10,000 characters',
    'any.required': 'Highlighted text is required',
  }),
  contextBefore: Joi.string().allow('').max(5000),
  contextAfter: Joi.string().allow('').max(5000),
  fullPrompt: Joi.string().required().max(50000).messages({
    'string.empty': 'Full prompt is required',
    'string.max': 'Full prompt must not exceed 50,000 characters',
    'any.required': 'Full prompt is required',
  }),
  originalUserPrompt: Joi.string().allow('').max(10000),
  highlightedCategory: Joi.string().allow('', null).max(200).optional(),
  highlightedCategoryConfidence: Joi.number()
    .min(0)
    .max(1)
    .optional()
    .allow(null),
  highlightedPhrase: Joi.string().allow('', null).max(1000).optional(),
  brainstormContext: Joi.object({
    version: Joi.string().optional(),
    createdAt: Joi.number().optional(),
    elements: Joi.object({
      subject: Joi.string().allow('', null),
      action: Joi.string().allow('', null),
      location: Joi.string().allow('', null),
      time: Joi.string().allow('', null),
      mood: Joi.string().allow('', null),
      style: Joi.string().allow('', null),
      event: Joi.string().allow('', null),
    }).optional().unknown(true),
    metadata: Joi.object({
      format: Joi.string().allow('', null),
      technicalParams: Joi.object().unknown(true).optional(),
      validationScore: Joi.any().optional(),
      history: Joi.array().items(Joi.any()).optional(),
    })
      .optional()
      .unknown(true),
  })
    .optional()
    .allow(null)
    .unknown(true),
});

export const customSuggestionSchema = Joi.object({
  highlightedText: Joi.string().required().max(10000).messages({
    'string.empty': 'Highlighted text is required',
    'any.required': 'Highlighted text is required',
  }),
  customRequest: Joi.string().required().max(1000).messages({
    'string.empty': 'Custom request is required',
    'any.required': 'Custom request is required',
  }),
  fullPrompt: Joi.string().required().max(50000),
});

export const sceneChangeSchema = Joi.object({
  changedField: Joi.string().required(),
  newValue: Joi.string().required().max(10000),
  oldValue: Joi.string().allow('', null).max(10000),
  fullPrompt: Joi.string().required().max(50000),
  affectedFields: Joi.object().optional(),
  sectionHeading: Joi.string().allow('', null).max(200).optional(),
  sectionContext: Joi.string().allow('', null).max(5000).optional(),
});

