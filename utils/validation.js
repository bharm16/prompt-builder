import Joi from 'joi';

export const promptSchema = Joi.object({
  prompt: Joi.string().required().max(10000).messages({
    'string.empty': 'Prompt is required',
    'string.max': 'Prompt must not exceed 10,000 characters',
    'any.required': 'Prompt is required'
  }),
  mode: Joi.string().valid('code', 'text', 'learning', 'video', 'reasoning', 'research', 'socratic', 'optimize').required().messages({
    'any.only': 'Mode must be one of: code, text, learning, video, reasoning, research, socratic, optimize',
    'any.required': 'Mode is required'
  }),
  context: Joi.object({
    specificAspects: Joi.string().allow('').max(5000),
    backgroundLevel: Joi.string().allow('').max(1000),
    intendedUse: Joi.string().allow('').max(1000)
  }).optional().allow(null)
});

export const suggestionSchema = Joi.object({
  highlightedText: Joi.string().required().max(10000).messages({
    'string.empty': 'Highlighted text is required',
    'string.max': 'Highlighted text must not exceed 10,000 characters',
    'any.required': 'Highlighted text is required'
  }),
  contextBefore: Joi.string().allow('').max(5000),
  contextAfter: Joi.string().allow('').max(5000),
  fullPrompt: Joi.string().required().max(50000).messages({
    'string.empty': 'Full prompt is required',
    'string.max': 'Full prompt must not exceed 50,000 characters',
    'any.required': 'Full prompt is required'
  }),
  originalUserPrompt: Joi.string().allow('').max(10000)
});

export const customSuggestionSchema = Joi.object({
  highlightedText: Joi.string().required().max(10000).messages({
    'string.empty': 'Highlighted text is required',
    'any.required': 'Highlighted text is required'
  }),
  customRequest: Joi.string().required().max(1000).messages({
    'string.empty': 'Custom request is required',
    'any.required': 'Custom request is required'
  }),
  fullPrompt: Joi.string().required().max(50000)
});

export const sceneChangeSchema = Joi.object({
  changedField: Joi.string().required(),
  newValue: Joi.string().required().max(10000),
  oldValue: Joi.string().allow('', null).max(10000),
  fullPrompt: Joi.string().required().max(50000),
  affectedFields: Joi.object().optional()
});

export const creativeSuggestionSchema = Joi.object({
  elementType: Joi.string().required().valid('subject', 'action', 'location', 'time', 'mood', 'style', 'event'),
  currentValue: Joi.string().allow('').max(5000),
  context: Joi.string().allow('').max(5000),
  concept: Joi.string().allow('').max(10000)
});
