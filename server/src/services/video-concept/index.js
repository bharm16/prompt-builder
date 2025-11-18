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
export { SceneCompletionService } from './services/analysis/SceneCompletionService.js';
export { SceneVariationService } from './services/analysis/SceneVariationService.js';
export { ConceptParsingService } from './services/analysis/ConceptParsingService.js';
export { RefinementService } from './services/analysis/RefinementService.js';

// Services - Detection
export { ConflictDetectionService } from './services/detection/ConflictDetectionService.js';
export { SceneChangeDetectionService } from './services/detection/SceneChangeDetectionService.js';

// Services - Generation
export { SuggestionGeneratorService } from './services/generation/SuggestionGeneratorService.js';
export { TechnicalParameterService } from './services/generation/TechnicalParameterService.js';
export { PromptBuilderService } from './services/generation/SystemPromptBuilder.js';

// Services - Validation
export { CompatibilityService } from './services/validation/CompatibilityService.js';
export { PromptValidationService } from './services/validation/PromptValidationService.js';

// Repositories
export { PreferenceRepository } from './repositories/PreferenceRepository.js';
export { VideoTemplateRepository } from './repositories/VideoTemplateRepository.js';

// Config
export * from './config/descriptorCategories.js';
