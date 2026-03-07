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

    return this._applyCategorySpecificOverrides(
      baseConstraints,
      trustedCategory,
      categorySource,
      highlightWordCountSafe,
      slotDescriptor
    );
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
    categorySource: string,
    highlightWordCount: number,
    slotDescriptor: string
  ): ConstraintConfig {
    let updatedConstraints = { ...constraints };

    if (this._isCameraAngleCategory(trustedCategory, categorySource)) {
      const angleConstraints = CONSTRAINT_MODES.micro(highlightWordCount, slotDescriptor);
      updatedConstraints = {
        ...angleConstraints,
        minWords: 1,
        maxWords: Math.min(6, Math.max(3, highlightWordCount + 2)),
        formRequirement: '1-6 word camera angle or viewpoint phrase only',
        focusGuidance: [
          'Suggest only camera angle or viewpoint changes (eye-level, low-angle, high-angle, overhead, Dutch tilt)',
          'Do not add movement, lens, focus, or shot-size details',
        ],
        extraRequirements: [
          'Output an angle/viewpoint phrase only',
          'Do not mention focal length, camera movement, or lighting',
        ],
      };
    }

    if (this._isCameraMovementCategory(trustedCategory, categorySource)) {
      const movementConstraints = CONSTRAINT_MODES.phrase(highlightWordCount, slotDescriptor);
      updatedConstraints = {
        ...movementConstraints,
        minWords: 1,
        maxWords: Math.min(6, Math.max(4, highlightWordCount + 2)),
        disallowTerminalPunctuation: true,
        formRequirement: '1-6 word camera movement phrase only',
        focusGuidance: [
          'Suggest a single camera move or stabilization approach',
          'Do not add lens, shot-size, focus, or lighting details',
        ],
        extraRequirements: [
          'Reference camera movement or support style only',
          'Do not mention focal length or framing',
        ],
      };
    }

    if (this._isCameraFocusCategory(trustedCategory, categorySource)) {
      const focusConstraints = CONSTRAINT_MODES.micro(highlightWordCount, slotDescriptor);
      updatedConstraints = {
        ...focusConstraints,
        minWords: 2,
        maxWords: Math.min(8, Math.max(4, highlightWordCount + 2)),
        formRequirement: '2-8 word focus or depth-of-field phrase only',
        focusGuidance: [
          'Describe focus plane, blur, bokeh, or depth-of-field treatment only',
          'Do not add movement, angle, lens, or shot-size details',
        ],
        extraRequirements: [
          'Keep it to focus, blur, bokeh, or depth-of-field language only',
          'Do not mention camera movement or focal length',
        ],
      };
    }

    if (this._isCameraLensCategory(trustedCategory, categorySource)) {
      const lensConstraints = CONSTRAINT_MODES.phrase(highlightWordCount, slotDescriptor);
      updatedConstraints = {
        ...lensConstraints,
        minWords: 1,
        maxWords: Math.min(6, Math.max(3, highlightWordCount + 2)),
        disallowTerminalPunctuation: true,
        formRequirement: '1-6 word lens or aperture phrase only',
        focusGuidance: [
          'Suggest focal length, lens family, or aperture only',
          'Do not add movement, framing, focus pulls, or lighting details',
        ],
        extraRequirements: [
          'Keep the output to lens or aperture language only',
          'Do not mention camera movement or shot size',
        ],
      };
    }

    if (this._isLightingQualityCategory(trustedCategory, categorySource)) {
      const lightingQualityConstraints = CONSTRAINT_MODES.adjective(
        highlightWordCount,
        slotDescriptor
      );
      updatedConstraints = {
        ...lightingQualityConstraints,
        maxWords: Math.min(6, Math.max(5, highlightWordCount + 2)),
        formRequirement: '1-6 word lighting-quality adjective or adverb phrase',
        focusGuidance: [
          'Describe light quality, contrast, warmth, or diffusion only',
          'Do not introduce source direction, lens effects, or new scene content',
        ],
        extraRequirements: [
          'Output a lighting-quality modifier or short phrase only',
          'Do not mention light source direction or camera technique',
        ],
      };
    }

    if (this._isLightingTimeOfDayCategory(trustedCategory, categorySource)) {
      const timeOfDayConstraints = CONSTRAINT_MODES.adjective(highlightWordCount, slotDescriptor);
      updatedConstraints = {
        ...timeOfDayConstraints,
        maxWords: Math.min(5, Math.max(4, highlightWordCount + 1)),
        formRequirement: '1-5 word time-of-day or daylight phrase only',
        focusGuidance: [
          'Suggest a different time period or daylight condition only',
          'Do not describe source direction, flare, lensing, or shadow behavior',
        ],
        extraRequirements: [
          'Output a time-of-day or daylight phrase only',
          'Do not mention windows, backlight, or left/right lighting',
        ],
      };
    }

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

    if (this._isEnvironmentLocationCategory(trustedCategory, categorySource)) {
      const locationConstraints = CONSTRAINT_MODES.location(highlightWordCount, slotDescriptor);
      updatedConstraints = {
        ...locationConstraints,
        maxWords: Math.min(9, Math.max(6, highlightWordCount + 2)),
        formRequirement: 'Concise external location beat with atmosphere or time-of-day',
        focusGuidance: [
          'Describe the place beyond the frame or outside the current subject focus',
          'Keep it to location and atmosphere, not props or interior surfaces',
        ],
        extraRequirements: [
          'Anchor the setting with environmental specifics',
          'Avoid interior object details or camera instructions',
        ],
      };
    }

    if (this._isEnvironmentContextCategory(trustedCategory, categorySource)) {
      const contextConstraints = CONSTRAINT_MODES.phrase(highlightWordCount, slotDescriptor);
      updatedConstraints = {
        ...contextConstraints,
        minWords: 2,
        maxWords: Math.min(8, Math.max(4, highlightWordCount + 2)),
        disallowTerminalPunctuation: true,
        formRequirement: '2-8 word in-scene environmental context phrase',
        focusGuidance: [
          'Stay with objects, surfaces, atmosphere, or spatial context already in the scene',
          'Do not swap to a new external location or time-of-day',
        ],
        extraRequirements: [
          'Reference in-scene context rather than a new destination',
          'Do not introduce a new setting beyond the current scene',
        ],
      };
    }

    if (this._isStyleAestheticCategory(trustedCategory, categorySource)) {
      updatedConstraints = {
        ...updatedConstraints,
        focusGuidance: [
          'Describe visual treatment, film medium, color grade, or post-processing only',
          'Do not add camera movement, shot size, or lighting direction',
        ],
        extraRequirements: [
          ...new Set([
            ...(updatedConstraints.extraRequirements || []),
            'Keep the output scoped to visual treatment rather than staging or lighting direction',
          ]),
        ],
      };
    }

    return updatedConstraints;
  }

  private _isShotTypeCategory(trustedCategory: string, categorySource: string): boolean {
    const normalizedCategory = this._normalizeCategoryKey(trustedCategory);
    return (
      normalizedCategory === 'shot.type' ||
      normalizedCategory === 'shot.framing' ||
      categorySource.includes('shot type or framing')
    );
  }

  private _isCameraAngleCategory(trustedCategory: string, categorySource: string): boolean {
    return (
      this._normalizeCategoryKey(trustedCategory) === 'camera.angle' ||
      categorySource.includes('camera angle')
    );
  }

  private _isCameraMovementCategory(trustedCategory: string, categorySource: string): boolean {
    return (
      this._normalizeCategoryKey(trustedCategory) === 'camera.movement' ||
      categorySource.includes('camera movement')
    );
  }

  private _isCameraFocusCategory(trustedCategory: string, categorySource: string): boolean {
    return (
      this._normalizeCategoryKey(trustedCategory) === 'camera.focus' ||
      categorySource.includes('depth of field')
    );
  }

  private _isCameraLensCategory(trustedCategory: string, categorySource: string): boolean {
    return (
      this._normalizeCategoryKey(trustedCategory) === 'camera.lens' ||
      categorySource.includes('lens')
    );
  }

  private _isLightingQualityCategory(trustedCategory: string, categorySource: string): boolean {
    return (
      this._normalizeCategoryKey(trustedCategory) === 'lighting.quality' ||
      categorySource.includes('lighting quality')
    );
  }

  private _isLightingTimeOfDayCategory(trustedCategory: string, categorySource: string): boolean {
    return (
      this._normalizeCategoryKey(trustedCategory) === 'lighting.timeofday' ||
      categorySource.includes('time of day') ||
      categorySource.includes('daylight')
    );
  }

  private _isEnvironmentLocationCategory(trustedCategory: string, categorySource: string): boolean {
    return (
      this._normalizeCategoryKey(trustedCategory) === 'environment.location' ||
      categorySource.includes('environment location')
    );
  }

  private _isEnvironmentContextCategory(trustedCategory: string, categorySource: string): boolean {
    return (
      this._normalizeCategoryKey(trustedCategory) === 'environment.context' ||
      categorySource.includes('environment context')
    );
  }

  private _isStyleAestheticCategory(trustedCategory: string, categorySource: string): boolean {
    return (
      this._normalizeCategoryKey(trustedCategory) === 'style.aesthetic' ||
      categorySource.includes('style aesthetic')
    );
  }

  private _normalizeCategoryKey(category: string): string {
    return category.toLowerCase().replace(/[-_]/g, '');
  }
}
