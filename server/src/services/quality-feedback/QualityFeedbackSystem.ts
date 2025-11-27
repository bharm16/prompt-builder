/**
 * BACKWARD COMPATIBILITY SHIM
 * 
 * This file has been refactored into a folder structure.
 * The original implementation has been split into:
 * - services/FeatureExtractor.ts
 * - services/QualityAssessor.ts
 * - services/QualityModel.ts
 * - services/FeedbackRepository.ts
 * - QualityFeedbackService.ts (main orchestrator)
 * 
 * This shim maintains backward compatibility with existing imports.
 */

export { QualityFeedbackService as QualityFeedbackSystem, qualityFeedbackService as qualityFeedbackSystem } from './index.js';

