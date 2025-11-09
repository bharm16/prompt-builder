/**
 * LLM Output Schemas
 * 
 * Lightweight JSON Schema-inspired shapes for LLM response expectations.
 * These are referenced by services when enforcing structured outputs and in
 * unit tests to keep fixtures in sync with production payloads.
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

