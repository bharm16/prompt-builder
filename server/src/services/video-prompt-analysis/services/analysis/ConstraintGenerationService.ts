import { logger } from '@infrastructure/Logger';
import { CONSTRAINT_MODES, CONSTRAINT_THRESHOLDS } from '@services/video-prompt-analysis/config/constraintModes';
import { countWords, isSentence } from '@services/video-prompt-analysis/utils/textHelpers';
import type { ConstraintConfig, ConstraintDetails, ConstraintOptions } from '@services/video-prompt-analysis/types';

/**
 * Service responsible for generating replacement constraints for video prompts
 */
export class ConstraintGenerationService {
  private readonly log = logger.child({ service: 'ConstraintGenerationService' });

  /**
   * Resolve video replacement constraints based on highlight context
   */
  getVideoReplacementConstraints(
    details: ConstraintDetails = {},
    options: ConstraintOptions = {}
  ): ConstraintConfig {
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

    const baseConstraints = forceMode
      ? this._getConstraintByMode(forceMode, highlightWordCountSafe, slotDescriptor)
      : this._autoSelectConstraint(
          categorySource,
          highlightWordCountSafe,
          highlightIsSentence,
          slotDescriptor
        );

    return this._applyCategorySpecificOverrides(baseConstraints, trustedCategory, categorySource);
  }

  /**
   * Check if category confidence is reliable
   */
  private _isCategoryReliable(confidence: number | null | undefined): boolean {
    if (confidence === undefined || confidence === null) return true;
    if (!Number.isFinite(confidence)) return true;
    return confidence >= CONSTRAINT_THRESHOLDS.MIN_CATEGORY_CONFIDENCE;
  }

  /**
   * Get slot descriptor for the highlight
   */
  private _getSlotDescriptor(
    phraseRole: string | null | undefined,
    highlightedCategory: string | null | undefined
  ): string {
    if (phraseRole) return phraseRole;
    if (highlightedCategory) return `${highlightedCategory} detail`;
    return 'visual detail';
  }

  /**
   * Get constraint by mode name
   */
  private _getConstraintByMode(mode: string, highlightWordCount: number, slotDescriptor: string): ConstraintConfig {
    const generator = CONSTRAINT_MODES[mode as keyof typeof CONSTRAINT_MODES];
    if (!generator) {
      // Fallback to phrase if mode not found
      return CONSTRAINT_MODES.phrase(highlightWordCount, slotDescriptor);
    }
    return generator(highlightWordCount, slotDescriptor);
  }

  /**
   * Auto-select appropriate constraint mode based on context
   */
  private _autoSelectConstraint(
    categorySource: string,
    highlightWordCount: number,
    highlightIsSentence: boolean,
    slotDescriptor: string
  ): ConstraintConfig {
    const highlightIsVeryShort = highlightWordCount <= CONSTRAINT_THRESHOLDS.VERY_SHORT_WORDS;

    // Check category-specific constraints
    const isSubject = categorySource.includes('subject') || categorySource.includes('character');
    const isLighting = categorySource.includes('lighting');
    const isShot = categorySource.includes('shot');
    const isCamera = categorySource.includes('camera') || categorySource.includes('framing');
    const isLocation = categorySource.includes('location') || 
                       categorySource.includes('environment') || 
                       categorySource.includes('setting');
    const isStyle = categorySource.includes('style') || 
                    categorySource.includes('tone') || 
                    categorySource.includes('aesthetic');
    const isAudio = categorySource.includes('audio') || categorySource.includes('score');

    // Grammar-aware routing: action/movement → verb mode, short style → adjective mode
    // Guard: "camera movement" / "camera.movement" is a camera concept, not an action
    const isAction = categorySource.includes('action') ||
                     (!isCamera && categorySource.includes('movement')) ||
                     categorySource.includes('gesture');
    if (isAction) {
      return CONSTRAINT_MODES.verb(highlightWordCount, slotDescriptor);
    }

    if (highlightIsVeryShort && isStyle) {
      return CONSTRAINT_MODES.adjective(highlightWordCount, slotDescriptor);
    }

    // Apply category-based rules — subject always gets noun-phrase mode
    if (isSubject) {
      return CONSTRAINT_MODES.micro(highlightWordCount, slotDescriptor);
    }

    // Short lighting spans (1-3 words like "Warm", "golden hour") need adjective mode;
    // the full lighting mode expects 6-14 word clauses
    if (isLighting) {
      if (highlightIsVeryShort) {
        return CONSTRAINT_MODES.adjective(highlightWordCount, slotDescriptor);
      }
      return CONSTRAINT_MODES.lighting(highlightWordCount, slotDescriptor);
    }

    if (isShot) {
      return CONSTRAINT_MODES.micro(highlightWordCount, slotDescriptor);
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

    // Fallback: unknown-category short spans get noun-phrase mode
    if (highlightIsVeryShort) {
      return CONSTRAINT_MODES.micro(highlightWordCount, slotDescriptor);
    }

    // Default rules based on length
    if (!highlightIsSentence && highlightWordCount <= CONSTRAINT_THRESHOLDS.PHRASE_MAX_WORDS) {
      return CONSTRAINT_MODES.phrase(highlightWordCount, slotDescriptor);
    }

    return CONSTRAINT_MODES.sentence(highlightWordCount, slotDescriptor);
  }

  private _applyCategorySpecificOverrides(
    constraints: ConstraintConfig,
    trustedCategory: string,
    categorySource: string
  ): ConstraintConfig {
    let updatedConstraints = { ...constraints };

    // Keep short style spans in adjective mode, but allow richer style phrases.
    if (updatedConstraints.mode === 'adjective' && trustedCategory.startsWith('style.')) {
      updatedConstraints = {
        ...updatedConstraints,
        maxWords: Math.max(updatedConstraints.maxWords, 8),
        formRequirement: '1-8 word adjective or participial phrase',
      };
    }

    // Shot type/framing needs explicit alternatives, not additive embellishments.
    if (this._isShotTypeCategory(trustedCategory, categorySource)) {
      updatedConstraints = {
        ...updatedConstraints,
        formRequirement:
          'Shot-size or framing phrase that REPLACES the current shot type (not additive lens/movement details)',
        focusGuidance: [
          'Suggest a DIFFERENT shot size or framing (ECU, CU, MCU, MS, MWS, WS, EWS, OTS, bird\'s-eye, worm\'s-eye)',
          'Do NOT keep the same shot type and add lens, focus, or camera movement modifiers',
        ],
        extraRequirements: [
          'Change the shot size or framing itself',
          'Do not produce additive "same shot + modifier" phrasing',
        ],
      };
    }

    return updatedConstraints;
  }

  private _isShotTypeCategory(trustedCategory: string, categorySource: string): boolean {
    return (
      trustedCategory === 'shot.type' ||
      trustedCategory === 'shot.framing' ||
      categorySource.includes('shot type or framing')
    );
  }
}
