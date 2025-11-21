/**
 * BACKWARD COMPATIBILITY SHIM
 * 
 * This file has been refactored into a folder structure.
 * The original implementation has been split into:
 * - services/FeatureExtractor.js
 * - services/QualityAssessor.js
 * - services/QualityModel.js
 * - services/FeedbackRepository.js
 * - QualityFeedbackService.js (main orchestrator)
 * 
 * This shim maintains backward compatibility with existing imports.
 */

export { QualityFeedbackService as QualityFeedbackSystem, qualityFeedbackService as qualityFeedbackSystem } from './index.js';

