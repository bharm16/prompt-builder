/**
 * Video Prompt Analysis Service - Barrel Exports
 * Provides backward compatibility and clean imports
 */

export { VideoPromptService } from './VideoPromptService';

// Export detection services for advanced usage
export { VideoPromptDetectionService } from './services/detection/VideoPromptDetectionService';
export { ModelDetectionService } from './services/detection/ModelDetectionService';
export { SectionDetectionService } from './services/detection/SectionDetectionService';

// Export analysis services for advanced usage
export { PhraseRoleAnalysisService } from './services/analysis/PhraseRoleAnalysisService';
export { ConstraintGenerationService } from './services/analysis/ConstraintGenerationService';

// Export guidance services for advanced usage
export { FallbackStrategyService } from './services/guidance/FallbackStrategyService';
export { CategoryGuidanceService } from './services/guidance/CategoryGuidanceService';

// Export utilities
export { countWords, isSentence, normalizeText } from './utils/textHelpers';

// Export config for testing/debugging
export * from './config/detectionMarkers';
export * from './config/categoryMapping';
export * from './config/constraintModes';
export * from './config/fallbackStrategy';
export * from './config/categoryGuidance';

// Export types
export type * from './types';
export type * from './services/detection/ModelDetectionService';
export type * from './services/detection/SectionDetectionService';

