/**
 * BACKWARD COMPATIBILITY SHIM
 * 
 * This file has been refactored into a modular structure.
 * The original implementation has been split into:
 * - services/PromptAnalyzer.js (complexity & ambiguity analysis)
 * - services/QuestionScorer.js (relevance scoring & ranking)
 * - config/analysisPatterns.js (detection patterns & weights)
 * - config/promptTemplate.js (system prompt templates)
 * - QuestionGenerationService.js (main orchestrator)
 * 
 * New location: server/src/services/question-generation/
 * 
 * This shim maintains backward compatibility with existing imports.
 */

export { QuestionGenerationService, questionGenerationService } from './question-generation/index.js';
