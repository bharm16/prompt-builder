/**
 * BACKWARD COMPATIBILITY SHIM
 * 
 * This file has been refactored into a folder structure.
 * The original implementation has been split into:
 * - services/VideoPromptDetector.js
 * - services/PhraseRoleAnalyzer.js
 * - services/ConstraintGenerator.js
 * - services/FallbackStrategyService.js
 * - services/CategoryGuidanceService.js
 * - VideoPromptService.js (main orchestrator)
 * 
 * This shim maintains backward compatibility with existing imports.
 */

export { VideoPromptService } from '../video-prompt/index.js';
