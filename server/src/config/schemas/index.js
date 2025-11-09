/**
 * Schema Barrel Export
 * 
 * Central export point for all validation schemas.
 * Organized by domain: prompts, suggestions, video/creative workflows, and LLM outputs.
 */

// Prompt schemas
export {
  promptSchema,
  generateQuestionsSchema,
  semanticParseSchema,
} from './promptSchemas.js';

// Suggestion schemas
export {
  suggestionSchema,
  customSuggestionSchema,
  sceneChangeSchema,
} from './suggestionSchemas.js';

// Video/creative workflow schemas
export {
  creativeSuggestionSchema,
  videoValidationSchema,
  completeSceneSchema,
  variationsSchema,
  parseConceptSchema,
  saveTemplateSchema,
  templateRecommendationsSchema,
  recordUserChoiceSchema,
  alternativePhrasingsSchema,
} from './videoSchemas.js';

// LLM output schemas
export {
  compatibilityOutputSchema,
  completeSceneOutputSchema,
  variationsOutputSchema,
  parseConceptOutputSchema,
  refinementsOutputSchema,
  conflictsOutputSchema,
  technicalParamsOutputSchema,
  validatePromptOutputSchema,
  smartDefaultsOutputSchema,
  alternativePhrasingsOutputSchema,
} from './outputSchemas.js';

