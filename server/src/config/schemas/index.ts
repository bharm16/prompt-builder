/**
 * Schema Barrel Export
 * 
 * Central export point for all validation schemas.
 * Organized by domain: prompts, suggestions, video/creative workflows, and LLM outputs.
 */

// Prompt schemas
export {
  promptSchema,
  type PromptRequest,
  compileSchema,
  type CompileRequest,
} from './promptSchemas.ts';

// Suggestion schemas
export {
  suggestionSchema,
  customSuggestionSchema,
  sceneChangeSchema,
  coherenceCheckSchema,
  type SuggestionRequest,
  type CustomSuggestionRequest,
  type SceneChangeRequest,
  type CoherenceCheckRequest,
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
  coherenceCheckOutputSchema,
} from './outputSchemas.ts';
