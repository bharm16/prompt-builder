import { CONSTRAINT_MODES, CONSTRAINT_THRESHOLDS } from '../../config/constraintModes.js';
import { countWords, isSentence } from '../../utils/textHelpers.js';

/**
 * Service responsible for generating replacement constraints for video prompts
 */
export class ConstraintGenerationService {
  /**
   * Resolve video replacement constraints based on highlight context
   * @param {Object} details - Details about the highlight
   * @param {Object} options - Options like forceMode
   * @returns {Object} Constraint configuration
   */
  getVideoReplacementConstraints(details = {}, options = {}) {
    const {
      highlightWordCount = 0,
      phraseRole,
      highlightedText,
      highlightedCategory,
      highlightedCategoryConfidence,
    } = details;
    const { forceMode } = options;

    // Calculate derived properties
    const trimmedText = (highlightedText || '').trim();
    const highlightWordCountSafe = Number.isFinite(highlightWordCount)
      ? Math.max(0, Math.floor(highlightWordCount))
      : countWords(trimmedText);
    
    const highlightIsSentence = isSentence(trimmedText, highlightWordCountSafe);
    const categoryIsReliable = this._isCategoryReliable(highlightedCategoryConfidence);

    // Determine slot descriptor
    const slotDescriptor = this._getSlotDescriptor(phraseRole, highlightedCategory);

    // Determine category source for decision making
    const trustedCategory = highlightedCategory && categoryIsReliable
      ? highlightedCategory.toLowerCase()
      : '';
    const categorySource = trustedCategory || (phraseRole || '').toLowerCase();

    // Handle forced modes
    if (forceMode) {
      return this._getConstraintByMode(forceMode, highlightWordCountSafe, slotDescriptor);
    }

    // Auto-detect appropriate constraint mode
    return this._autoSelectConstraint(
      categorySource,
      highlightWordCountSafe,
      highlightIsSentence,
      slotDescriptor
    );
  }

  /**
   * Check if category confidence is reliable
   * @private
   */
  _isCategoryReliable(confidence) {
    if (confidence === undefined || confidence === null) return true;
    if (!Number.isFinite(confidence)) return true;
    return confidence >= CONSTRAINT_THRESHOLDS.MIN_CATEGORY_CONFIDENCE;
  }

  /**
   * Get slot descriptor for the highlight
   * @private
   */
  _getSlotDescriptor(phraseRole, highlightedCategory) {
    if (phraseRole) return phraseRole;
    if (highlightedCategory) return `${highlightedCategory} detail`;
    return 'visual detail';
  }

  /**
   * Get constraint by mode name
   * @private
   */
  _getConstraintByMode(mode, highlightWordCount, slotDescriptor) {
    const generator = CONSTRAINT_MODES[mode];
    if (!generator) {
      // Fallback to phrase if mode not found
      return CONSTRAINT_MODES.phrase(highlightWordCount, slotDescriptor);
    }
    return generator(highlightWordCount, slotDescriptor);
  }

  /**
   * Auto-select appropriate constraint mode based on context
   * @private
   */
  _autoSelectConstraint(categorySource, highlightWordCount, highlightIsSentence, slotDescriptor) {
    const highlightIsVeryShort = highlightWordCount <= CONSTRAINT_THRESHOLDS.VERY_SHORT_WORDS;

    // Check category-specific constraints
    const isSubject = categorySource.includes('subject') || categorySource.includes('character');
    const isLighting = categorySource.includes('lighting');
    const isCamera = categorySource.includes('camera') || 
                     categorySource.includes('framing') || 
                     categorySource.includes('shot');
    const isLocation = categorySource.includes('location') || 
                       categorySource.includes('environment') || 
                       categorySource.includes('setting');
    const isStyle = categorySource.includes('style') || 
                    categorySource.includes('tone') || 
                    categorySource.includes('aesthetic');
    const isAudio = categorySource.includes('audio') || categorySource.includes('score');

    // Apply category-based rules
    if (isSubject || highlightIsVeryShort) {
      return CONSTRAINT_MODES.micro(highlightWordCount, slotDescriptor);
    }

    if (isLighting) {
      return CONSTRAINT_MODES.lighting(highlightWordCount, slotDescriptor);
    }

    if (isCamera) {
      return CONSTRAINT_MODES.camera(highlightWordCount, slotDescriptor);
    }

    if (isLocation) {
      return CONSTRAINT_MODES.location(highlightWordCount, slotDescriptor);
    }

    if (isStyle || isAudio) {
      return CONSTRAINT_MODES.style(highlightWordCount, slotDescriptor);
    }

    // Default rules based on length
    if (!highlightIsSentence && highlightWordCount <= CONSTRAINT_THRESHOLDS.PHRASE_MAX_WORDS) {
      return CONSTRAINT_MODES.phrase(highlightWordCount, slotDescriptor);
    }

    return CONSTRAINT_MODES.sentence(highlightWordCount, slotDescriptor);
  }
}

