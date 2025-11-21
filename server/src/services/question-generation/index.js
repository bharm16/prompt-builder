/**
 * Question Generation Module
 * 
 * Exports the QuestionGenerationService and related components
 */

// Main service
export { QuestionGenerationService, questionGenerationService } from './QuestionGenerationService.js';

// Sub-services (for testing and advanced usage)
export { PromptAnalyzer } from './services/PromptAnalyzer.js';
export { QuestionScorer } from './services/QuestionScorer.js';

// Configuration (for customization)
export * from './config/analysisPatterns.js';
export { buildQuestionGenerationPrompt, buildFollowUpPrompt, QUESTION_SCHEMA } from './config/promptTemplate.js';

