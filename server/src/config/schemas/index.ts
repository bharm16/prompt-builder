/**
 * Schema Barrel Export
 * 
 * Central export point for all validation schemas.
 * Organized by domain: prompts, suggestions, video/creative workflows, and LLM outputs.
 */

// Prompt schemas
export {
  promptSchema,
  semanticParseSchema,
  type PromptRequest,
  type SemanticParseRequest,
} from './promptSchemas.ts';

// Suggestion schemas
export {
  suggestionSchema,
  customSuggestionSchema,
  sceneChangeSchema,
  type SuggestionRequest,
  type CustomSuggestionRequest,
  type SceneChangeRequest,
} from './suggestionSchemas.ts';

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
  type ElementType,
  type CreativeSuggestionRequest,
  type VideoValidationRequest,
  type CompleteSceneRequest,
  type VariationsRequest,
  type ParseConceptRequest,
  type SaveTemplateRequest,
  type TemplateRecommendationsRequest,
  type RecordUserChoiceRequest,
  type AlternativePhrasingsRequest,
} from './videoSchemas.ts';

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
} from './outputSchemas.ts';

