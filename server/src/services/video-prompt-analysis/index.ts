/**
 * Video Prompt Analysis Service - Barrel Exports
 * Provides backward compatibility and clean imports
 */

export { VideoPromptService } from './VideoPromptService.js';

// Export detection services for advanced usage
export { VideoPromptDetectionService } from './services/detection/VideoPromptDetectionService.js';
export { ModelDetectionService } from './services/detection/ModelDetectionService.js';
export { SectionDetectionService } from './services/detection/SectionDetectionService.js';

// Export analysis services for advanced usage
export { PhraseRoleAnalysisService } from './services/analysis/PhraseRoleAnalysisService.js';
export { ConstraintGenerationService } from './services/analysis/ConstraintGenerationService.js';

// Export guidance services for advanced usage
export { FallbackStrategyService } from './services/guidance/FallbackStrategyService.js';
export { CategoryGuidanceService } from './services/guidance/CategoryGuidanceService.js';

// Export utilities
export { countWords, isSentence, normalizeText } from './utils/textHelpers.js';

// Export config for testing/debugging
export * from './config/detectionMarkers.js';
export * from './config/categoryMapping.js';
export * from './config/constraintModes.js';
export * from './config/fallbackStrategy.js';
export * from './config/categoryGuidance.js';

// Export types
export type * from './types.js';
export type * from './services/detection/ModelDetectionService.js';
export type * from './services/detection/SectionDetectionService.js';

