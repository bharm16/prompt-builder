import Joi from 'joi';

export const promptSchema = Joi.object({
  prompt: Joi.string().required().max(10000).messages({
    'string.empty': 'Prompt is required',
    'string.max': 'Prompt must not exceed 10,000 characters',
    'any.required': 'Prompt is required',
  }),
  mode: Joi.string()
    .valid(
      'code',
      'text',
      'learning',
      'video',
      'reasoning',
      'research',
      'socratic',
      'optimize'
    )
    .required()
    .messages({
      'any.only':
        'Mode must be one of: code, text, learning, video, reasoning, research, socratic, optimize',
      'any.required': 'Mode is required',
    }),
  context: Joi.object({
    specificAspects: Joi.string().allow('').max(5000),
    backgroundLevel: Joi.string().allow('').max(1000),
    intendedUse: Joi.string().allow('').max(1000),
  })
    .optional()
    .allow(null),
});

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
    }).optional(),
    metadata: Joi.object({
      format: Joi.string().allow('', null),
      technicalParams: Joi.object().unknown(true).optional(),
      validationScore: Joi.number().allow(null).optional(),
      history: Joi.array().items(Joi.any()).optional(),
    })
      .optional()
      .unknown(true),
  })
    .optional()
    .allow(null),
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

export const creativeSuggestionSchema = Joi.object({
  elementType: Joi.string()
    .required()
    .valid('subject', 'action', 'location', 'time', 'mood', 'style', 'event'),
  currentValue: Joi.string().allow('').max(5000),
  context: Joi.string().allow('').max(5000),
  concept: Joi.string().allow('').max(10000),
});

// Additional schemas for routes that lacked validation
export const generateQuestionsSchema = Joi.object({
  prompt: Joi.string().required().max(10000).messages({
    'string.empty': 'Prompt is required',
    'any.required': 'Prompt is required',
  }),
});

export const compatibilitySchema = Joi.object({
  elementType: Joi.string().required(),
  value: Joi.string().allow('').max(10000).required(),
  existingElements: Joi.object().required(),
});

export const completeSceneSchema = Joi.object({
  existingElements: Joi.object().required(),
  concept: Joi.string().allow('').max(10000),
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

export const refinementsSchema = Joi.object({
  elements: Joi.object().required(),
});

export const conflictsSchema = Joi.object({
  elements: Joi.object().required(),
});

export const technicalParamsSchema = Joi.object({
  elements: Joi.object().required(),
});

export const validatePromptSchema = Joi.object({
  elements: Joi.object().required(),
  concept: Joi.string().allow('').max(10000),
});

export const smartDefaultsSchema = Joi.object({
  elementType: Joi.string().required(),
  existingElements: Joi.object().required(),
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

/**
 * LLM response schema expectations for creative workflow endpoints.
 * These lightweight JSON Schema-inspired shapes are referenced by services
 * when enforcing structured outputs and in unit tests to keep fixtures in sync
 * with production payloads.
 */
export const compatibilityOutputSchema = {
  type: 'object',
  required: ['score', 'feedback'],
};

export const completeSceneOutputSchema = {
  type: 'object',
};

export const variationsOutputSchema = {
  type: 'array',
  items: {
    required: ['name', 'description', 'elements'],
  },
};

export const parseConceptOutputSchema = {
  type: 'object',
  required: ['subject', 'action', 'location', 'time', 'mood', 'style', 'event'],
};

export const refinementsOutputSchema = {
  type: 'object',
};

export const conflictsOutputSchema = {
  type: 'array',
  items: {
    required: ['elements', 'severity', 'message'],
  },
};

export const technicalParamsOutputSchema = {
  type: 'object',
  required: ['camera', 'lighting', 'color', 'format', 'audio', 'postProduction'],
};

export const validatePromptOutputSchema = {
  type: 'object',
  required: ['score', 'breakdown', 'feedback', 'strengths', 'weaknesses'],
};

export const smartDefaultsOutputSchema = {
  type: 'array',
};

export const alternativePhrasingsOutputSchema = {
  type: 'array',
  items: {
    required: ['text', 'tone'],
  },
};
