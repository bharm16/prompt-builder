/**
 * Schema Barrel Export
 *
 * Central export point for all validation schemas.
 * Organized by domain: prompts and suggestions.
 */

// Prompt schemas
export {
  promptSchema,
  type PromptRequest,
  compileSchema,
  type CompileRequest,
} from "./promptSchemas.ts";

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
} from "./suggestionSchemas.ts";
