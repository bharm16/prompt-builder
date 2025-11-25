/**
 * Validation Schemas - Backward Compatibility Exports
 * 
 * This file re-exports all schemas from their new organized locations
 * in server/src/config/schemas/ to maintain backward compatibility
 * with existing imports.
 * 
 * MIGRATION NOTE:
 * Schemas have been reorganized into config/schemas/ for better organization:
 * - promptSchemas.ts - Prompt optimization request schemas
 * - suggestionSchemas.ts - Enhancement suggestion request schemas
 * - videoSchemas.ts - Video/creative workflow request schemas
 * - outputSchemas.ts - LLM response expectation schemas
 * 
 * New code should import directly from config/schemas/, but this file
 * maintains compatibility with existing code importing from utils/validation.ts
 */

// Re-export all schemas from their new locations
export {
  // Prompt schemas
  promptSchema,
  semanticParseSchema,
  
  // Suggestion schemas
  suggestionSchema,
  customSuggestionSchema,
  sceneChangeSchema,
  
  // Video/creative workflow schemas
  creativeSuggestionSchema,
  videoValidationSchema,
  completeSceneSchema,
  variationsSchema,
  parseConceptSchema,
  saveTemplateSchema,
  templateRecommendationsSchema,
  recordUserChoiceSchema,
  alternativePhrasingsSchema,
  
  // LLM output schemas
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
} from '../config/schemas/index.js';

