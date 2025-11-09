/**
 * Video Prompt Service - Barrel Exports
 * Provides backward compatibility and clean imports
 */

export { VideoPromptService } from './VideoPromptService.js';

// Export services for advanced usage
export { VideoPromptDetector } from './services/VideoPromptDetector.js';
export { PhraseRoleAnalyzer } from './services/PhraseRoleAnalyzer.js';
export { ConstraintGenerator } from './services/ConstraintGenerator.js';
export { FallbackStrategyService } from './services/FallbackStrategyService.js';
export { CategoryGuidanceService } from './services/CategoryGuidanceService.js';

// Export utilities
export { countWords, isSentence, normalizeText } from './utils/textHelpers.js';

// Export config for testing/debugging
export * from './config/detectionMarkers.js';
export * from './config/categoryMapping.js';
export * from './config/constraintModes.js';
export * from './config/fallbackStrategy.js';
export * from './config/categoryGuidance.js';

