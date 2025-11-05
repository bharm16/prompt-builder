import { VideoPromptDetector } from './services/VideoPromptDetector.js';
import { PhraseRoleAnalyzer } from './services/PhraseRoleAnalyzer.js';
import { ConstraintGenerator } from './services/ConstraintGenerator.js';
import { FallbackStrategyService } from './services/FallbackStrategyService.js';
import { CategoryGuidanceService } from './services/CategoryGuidanceService.js';
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
    this.detector = new VideoPromptDetector();
    this.phraseRoleAnalyzer = new PhraseRoleAnalyzer();
    this.constraintGenerator = new ConstraintGenerator();
    this.fallbackStrategy = new FallbackStrategyService();
    this.categoryGuidance = new CategoryGuidanceService();
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
   * @param {string} phraseRole - Role of the phrase
   * @param {string} categoryHint - Category hint
   * @returns {Array|null} Array of guidance strings or null
   */
  getCategoryFocusGuidance(phraseRole, categoryHint) {
    return this.categoryGuidance.getCategoryFocusGuidance(phraseRole, categoryHint);
  }
}

