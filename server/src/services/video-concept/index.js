/**
 * Video Concept Services - Specialized services for video concept generation
 *
 * This module exports all specialized services used by VideoConceptService.
 * Each service has a single, well-defined responsibility.
 * 
 * Reorganized structure:
 * - services/analysis/ - Scene analysis and manipulation
 * - services/detection/ - Conflict and scene change detection
 * - services/generation/ - Content and suggestion generation
 * - services/validation/ - Compatibility and prompt validation
 * - repositories/ - Data access layer
 * - config/ - Configuration and constants
 */

// Services - Analysis
export { SceneCompletionService } from './services/analysis/SceneCompletionService.ts';
export { SceneVariationService } from './services/analysis/SceneVariationService.ts';
export { ConceptParsingService } from './services/analysis/ConceptParsingService.ts';
export { RefinementService } from './services/analysis/RefinementService.ts';

// Services - Detection
export { ConflictDetectionService } from './services/detection/ConflictDetectionService.ts';
export { SceneChangeDetectionService } from './services/detection/SceneChangeDetectionService.ts';

// Services - Generation
export { SuggestionGeneratorService } from './services/generation/SuggestionGeneratorService.ts';
export { TechnicalParameterService } from './services/generation/TechnicalParameterService.ts';
export { PromptBuilderService } from './services/generation/SystemPromptBuilder.ts';

// Services - Validation
export { CompatibilityService } from './services/validation/CompatibilityService.ts';
export { PromptValidationService } from './services/validation/PromptValidationService.ts';

// Repositories
export { PreferenceRepository } from './repositories/PreferenceRepository.ts';
export { VideoTemplateRepository } from './repositories/VideoTemplateRepository.ts';

// Config
export * from './config/descriptorCategories.js';
