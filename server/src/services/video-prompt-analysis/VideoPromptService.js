import { VideoPromptDetectionService } from './services/detection/VideoPromptDetectionService.js';
import { PhraseRoleAnalysisService } from './services/analysis/PhraseRoleAnalysisService.js';
import { ConstraintGenerationService } from './services/analysis/ConstraintGenerationService.js';
import { FallbackStrategyService } from './services/guidance/FallbackStrategyService.js';
import { CategoryGuidanceService } from './services/guidance/CategoryGuidanceService.js';
import { ModelDetectionService } from './services/detection/ModelDetectionService.js';
import { SectionDetectionService } from './services/detection/SectionDetectionService.js';
import { TaxonomyValidationService } from '../taxonomy-validation/TaxonomyValidationService.js';
import { countWords } from './utils/textHelpers.js';

/**
 * VideoPromptService - Main Orchestrator
 * 
 * Responsible for coordinating video prompt detection, analysis, and constraint management.
 * Delegates to specialized services for each concern.
 * 
 * Single Responsibility: Orchestrate video prompt logic
 */
export class VideoPromptService {
  constructor() {
    this.detector = new VideoPromptDetectionService();
    this.phraseRoleAnalyzer = new PhraseRoleAnalysisService();
    this.constraintGenerator = new ConstraintGenerationService();
    this.fallbackStrategy = new FallbackStrategyService();
    this.categoryGuidance = new CategoryGuidanceService();
    this.modelDetector = new ModelDetectionService();
    this.sectionDetector = new SectionDetectionService();
    this.taxonomyValidator = new TaxonomyValidationService();
  }

  /**
   * Count words in a string
   * @param {string} text - Text to count words in
   * @returns {number} Word count
   */
  countWords(text) {
    return countWords(text);
  }

  /**
   * Check if this is a video prompt
   * @param {string} fullPrompt - Full prompt text
   * @returns {boolean} True if video prompt
   */
  isVideoPrompt(fullPrompt) {
    return this.detector.isVideoPrompt(fullPrompt);
  }

  /**
   * Detect the likely role of a highlighted phrase within a video prompt
   * @param {string} highlightedText - Highlighted text
   * @param {string} contextBefore - Text before highlight
   * @param {string} contextAfter - Text after highlight
   * @param {string} explicitCategory - Explicit category if provided
   * @returns {string} Phrase role
   */
  detectVideoPhraseRole(highlightedText, contextBefore, contextAfter, explicitCategory) {
    return this.phraseRoleAnalyzer.detectVideoPhraseRole(
      highlightedText,
      contextBefore,
      contextAfter,
      explicitCategory
    );
  }

  /**
   * Resolve video replacement constraints based on highlight context
   * @param {Object} details - Details about the highlight
   * @param {Object} options - Options like forceMode
   * @returns {Object} Constraint configuration
   */
  getVideoReplacementConstraints(details = {}, options = {}) {
    return this.constraintGenerator.getVideoReplacementConstraints(details, options);
  }

  /**
   * Determine the next fallback constraint mode to try
   * @param {Object} currentConstraints - Current constraint configuration
   * @param {Object} details - Details about the highlight
   * @param {Set} attemptedModes - Set of already attempted modes
   * @returns {Object|null} Next fallback constraints or null
   */
  getVideoFallbackConstraints(
    currentConstraints,
    details = {},
    attemptedModes = new Set()
  ) {
    return this.fallbackStrategy.getVideoFallbackConstraints(
      currentConstraints,
      details,
      attemptedModes,
      (d, o) => this.getVideoReplacementConstraints(d, o)
    );
  }

  /**
   * Get category-specific focus guidance for better suggestions
   * NEW: Now context-aware with full prompt, spans, and edit history
   * 
   * @param {string} phraseRole - Role of the phrase
   * @param {string} categoryHint - Category hint
   * @param {string} fullContext - Full prompt text (NEW)
   * @param {Array} allSpans - All labeled spans (NEW)
   * @param {Array} editHistory - Recent edits (NEW)
   * @returns {Array|null} Array of guidance strings or null
   */
  getCategoryFocusGuidance(phraseRole, categoryHint, fullContext = '', allSpans = [], editHistory = []) {
    return this.categoryGuidance.getCategoryFocusGuidance(
      phraseRole,
      categoryHint,
      fullContext,
      allSpans,
      editHistory
    );
  }

  /**
   * Detect which AI video model is being targeted
   * @param {string} fullPrompt - Full prompt text
   * @returns {string|null} Model identifier or null
   */
  detectTargetModel(fullPrompt) {
    return this.modelDetector.detectTargetModel(fullPrompt);
  }

  /**
   * Get model capabilities (strengths and weaknesses)
   * @param {string} model - Model identifier
   * @returns {Object|null} Capabilities object or null
   */
  getModelCapabilities(model) {
    return this.modelDetector.getModelCapabilities(model);
  }

  /**
   * Get model-specific guidance for a category
   * @param {string} model - Model identifier
   * @param {string} category - Category being edited
   * @returns {Array<string>} Array of guidance strings
   */
  getModelSpecificGuidance(model, category) {
    return this.modelDetector.getModelSpecificGuidance(model, category);
  }

  /**
   * Format model context for prompt inclusion
   * @param {string} model - Model identifier
   * @returns {string} Formatted context
   */
  formatModelContext(model) {
    return this.modelDetector.formatModelContext(model);
  }

  /**
   * Detect which section of the prompt template is being edited
   * @param {string} highlightedText - The highlighted text
   * @param {string} fullPrompt - Full prompt text
   * @param {string} contextBefore - Text before highlight
   * @returns {string} Section identifier
   */
  detectPromptSection(highlightedText, fullPrompt, contextBefore) {
    return this.sectionDetector.detectSection(highlightedText, fullPrompt, contextBefore);
  }

  /**
   * Get section-specific constraints
   * @param {string} section - Section identifier
   * @returns {Object|null} Constraints object or null
   */
  getSectionConstraints(section) {
    return this.sectionDetector.getSectionConstraints(section);
  }

  /**
   * Get section-specific guidance for a category
   * @param {string} section - Section identifier
   * @param {string} category - Category being edited
   * @returns {Array<string>} Array of guidance strings
   */
  getSectionGuidance(section, category) {
    return this.sectionDetector.getSectionGuidance(section, category);
  }

  /**
   * Format section context for prompt inclusion
   * @param {string} section - Section identifier
   * @returns {string} Formatted context
   */
  formatSectionContext(section) {
    return this.sectionDetector.formatSectionContext(section);
  }

  /**
   * Validate taxonomy hierarchy in spans
   * NEW: Detects orphaned attributes and hierarchy violations
   * 
   * @param {Array} spans - Array of span objects with category property
   * @param {Object} options - Validation options
   * @returns {Object} Validation result with issues and suggestions
   */
  validateSpanHierarchy(spans, options = {}) {
    return this.taxonomyValidator.validateSpans(spans, options);
  }

  /**
   * Check if spans have orphaned attributes
   * Quick check for UI warnings
   * 
   * @param {Array} spans - Array of spans
   * @returns {boolean} True if orphans detected
   */
  hasOrphanedAttributes(spans) {
    return this.taxonomyValidator.hasOrphanedAttributes(spans);
  }

  /**
   * Get missing parent categories for validation suggestions
   * @param {Array} spans - Array of spans
   * @returns {Array<string>} Array of missing parent category IDs
   */
  getMissingParentCategories(spans) {
    return this.taxonomyValidator.getMissingParents(spans);
  }

  /**
   * Validate before adding a category to spans
   * @param {string} categoryId - Category ID to validate
   * @param {Array} existingSpans - Current spans
   * @returns {Object} Validation result with warnings
   */
  validateCategoryBeforeAdd(categoryId, existingSpans) {
    return this.taxonomyValidator.validateBeforeAdd(categoryId, existingSpans);
  }

  /**
   * Get validation statistics for analytics
   * @param {Array} spans - Array of spans
   * @returns {Object} Statistics about validation
   */
  getValidationStats(spans) {
    return this.taxonomyValidator.getValidationStats(spans);
  }
}

