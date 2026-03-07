import { logger } from '@infrastructure/Logger';
import { validateAgainstVideoTemplate } from '../config/CategoryConstraints.js';
import { getParentCategory } from '@shared/taxonomy';
import { getAllExampleTexts } from '../config/EnhancementExamples';
import type { Suggestion, SanitizationContext, GroupedSuggestions, VideoService } from './types.js';

type ExtendedSanitizationContext = SanitizationContext & {
  contextBefore?: string;
  contextAfter?: string;
  spanAnchors?: string;
  nearbySpanHints?: string;
};

/**
 * SuggestionValidationService
 * 
 * Responsible for validating and sanitizing enhancement suggestions.
 * Ensures suggestions meet requirements and are valid drop-in replacements.
 * 
 * Single Responsibility: Suggestion validation and sanitization
 */
export class SuggestionValidationService {
  private readonly log = logger.child({ service: 'SuggestionValidationService' });
  private readonly exampleTexts = getAllExampleTexts();
  private readonly compatibleLockedCategories: Record<string, Set<string>> = {
    camera: new Set(['shot']),
    shot: new Set(['camera']),
  };
  private readonly deprioritizedMarker = '__deprioritized';
  private readonly lockedCategoryPatterns: Record<string, RegExp> = {
    camera: /\b(dolly|track(ing)?|pan|tilt|crane|zoom|handheld|static|lens|mm|wide shot|close[-\s]?up|over[-\s]?the[-\s]?shoulder|angle|framing)\b/i,
    shot: /\b(wide shot|medium shot|close[-\s]?up|extreme close[-\s]?up|over[-\s]?the[-\s]?shoulder|shot|angle)\b/i,
    lighting: /\b(lighting|shadow|glow|illuminat|backlight|rim light|key light|fill light|high[-\s]?key|low[-\s]?key|sunlight|moonlight)\b/i,
    technical: /\b(\d+fps|frame rate|aspect ratio|\d+:\d+|4k|8k|resolution|duration|mm film|film format)\b/i,
  };
  private readonly cameraMovementTerms =
    /\b(dolly|track(ing)?|pan|tilt|crane|zoom|handheld|static|push[-\s]?in|pull[-\s]?out|arc)\b/i;
  private readonly cameraAngleTerms =
    /\b(eye[-\s]?level|low[-\s]?angle|high[-\s]?angle|overhead|bird'?s[-\s]?eye|worm'?s[-\s]?eye|dutch tilt|profile|point[-\s]?of[-\s]?view|pov)\b/i;
  private readonly shotFramingTerms =
    /\b(shot|close[-\s]?up|medium shot|wide shot|extreme close[-\s]?up|over[-\s]?the[-\s]?shoulder|high[-\s]?angle|low[-\s]?angle|bird'?s[-\s]?eye|worm'?s[-\s]?eye|dutch tilt)\b/i;
  private readonly cameraFocusTerms =
    /\b(focus|depth of field|dof|bokeh|defocus|blur|shallow|rack focus|selective focus)\b/i;
  private readonly lensApertureTerms =
    /\b(\d+mm|lens|prime|telephoto|wide[-\s]?angle|anamorphic|macro|aperture|f\/\d(?:\.\d+)?|iris)\b/i;
  private readonly cameraTechniqueTerms =
    /\b(dolly|track(ing)?|pan|tilt|crane|zoom|handheld|steadicam|shot|close[-\s]?up|wide[-\s]?angle|high[-\s]?angle|low[-\s]?angle|bird'?s[-\s]?eye|lens|mm|framing)\b/i;
  private readonly lightSourceClauseTerms =
    /\b(from|through|window|rear window|windshield|backseat|overhead|side[-\s]?light(?:ing)?|back[-\s]?light(?:ing)?|front[-\s]?light(?:ing)?|key light|rim light|sunlight|neon|candlelight)\b/i;
  private readonly lightingClauseVerbTerms =
    /\b(create|creating|casting|streams?|streaming|pouring|bouncing|to create)\b/i;
  private readonly timeOfDayTerms =
    /\b(dawn|sunrise|morning|midday|noon|afternoon|golden hour|sunset|dusk|twilight|blue hour|night|moonlit|daylight|daytime|evening)\b/i;
  private readonly styleStrongCueTerms =
    /\b(style|aesthetic|look|tone|palette|grade|grading|grain|noir|neo-noir|documentary|verit[eé]|retro|vintage|kodachrome|8mm|16mm|35mm|cinematic|painterly|watercolor|impressionist|oil|ink|sepia|chiaroscuro|hyperreal|surreal|cyberpunk|cartoon|animation|diorama|pastel|monochrome|technicolor|dream(?:like)?|fantasy|whimsy|wonder|nostalg(?:ia|ic)|realism)\b/i;
  private readonly lightingQualityCueTerms =
    /\b(light|lighting|shadow|glow|lumin(?:ous|ance)|radian(?:t|ce)|illuminat|warmth|brightness|dim(?:ness)?|diffus(?:e|ed|ion)|ambient|backlit|rim[-\s]?lit|high[-\s]?key|low[-\s]?key|sunlit|moonlit|golden[-\s]?hour)\b/i;
  private readonly lightingDirectionTerms =
    /\b(left|right|front|rear|back|overhead|top[-\s]?lit|under[-\s]?lit|side[-\s]?lit|back[-\s]?lit|key|rim)\b/i;
  private readonly externalLocationTerms =
    /\b(park|street|forest|beach|shoreline|lake|lakeside|dock|meadow|grove|city|cityscape|alley|playground|vineyard|field|trail|road|suburban|mountain|desert|plaza|garden|shore|coast|cliff|waterfront|courtyard|market|boardwalk|turnout|boulevard)\b/i;
  private readonly environmentContextTerms =
    /\b(window|windshield|glass|dashboard|cabin|cockpit|seat|upholstery|interior|rearview|mirror|condensation|reflection|dust|raindrops|fogged|haze|air|smoke|shadow|sunbeam|glare|trim|console)\b/i;
  private readonly vehicleInteriorTerms =
    /\b(car|vehicle|driver|seat|steering|wheel|window|windows|dashboard|cockpit|cabin|front seat|backseat|passenger seat|truck|van|bus|kart|go-kart|convertible|tractor|train|boat|airplane|stroller|tricycle)\b/i;
  private readonly vehicleInteriorAnchorTerms =
    /\b(driver'?s seat|passenger seat|front seat|backseat|dashboard|steering wheel|cockpit|cabin|car interior|inside the car|inside the vehicle)\b/i;
  private readonly environmentMotionSubjectTerms =
    /\b(tree|trees|leaf|leaves|branch|branches|grass|waves?|water|wind|breeze|clouds?|rain|snow|mist|fog)\b/i;
  private readonly humanSubjectTerms =
    /\b(baby|infant|toddler|child|kid|boy|girl|person|man|woman|human)\b/i;
  private readonly nonHumanIdentityTerms =
    /\b(puppy|dog|kitten|cat|bunny|rabbit|duckling|duck|bird|animal|creature|elephant|horse|bear|wolf|fox|lion|tiger|deer)\b/i;
  private readonly fantasyOrRoleShiftTerms =
    /\b(cartoon|anime|mascot|puppet|doll|clown|robot|android|alien|monster)\b/i;
  private readonly weatherGentleAirTerms =
    /\b(breeze|wind|air current|draft|gust|zephyr)\b/i;
  private readonly weatherDisruptiveTerms =
    /\b(snow|snowfall|blizzard|hail|storm|thunder|rain|downpour|fog|mist|hurricane|tornado)\b/i;
  private readonly humanBodyActionTerms =
    /\b(clapping|grinning|smiling|waving|nodding|laughing|twisting body|look behind|reaching out|bouncing|tapping|tap(?:s|ping)?|reaching|reach(?:es|ing)?|wriggling|wriggle(?:s|ing)?|tiny fingers?|dashboard|steering wheel|hands?|arms?|feet)\b/i;

  constructor(private readonly videoService: VideoService) {}

  /**
   * Sanitize suggestions to ensure they are valid drop-in replacements
   * @param suggestions - Raw suggestions from Claude
   * @param context - Context for validation
   * @returns Sanitized suggestions
   */
  sanitizeSuggestions(
    suggestions: Suggestion[] | string[],
    context: SanitizationContext
  ): Suggestion[] {
    const startTime = performance.now();
    const operation = 'sanitizeSuggestions';
    
    if (!Array.isArray(suggestions) || suggestions.length === 0) {
      this.log.debug('Empty suggestions array, returning empty', {
        operation,
      });
      return [];
    }
    
    this.log.debug('Sanitizing suggestions', {
      operation,
      inputCount: suggestions.length,
      isVideoPrompt: context.isVideoPrompt,
      isPlaceholder: context.isPlaceholder,
    });

    const primary: Suggestion[] = [];
    const deprioritized: Suggestion[] = [];
    const extendedContext = context as ExtendedSanitizationContext;
    const normalizedHighlight = context.highlightedText?.trim().toLowerCase();
    const disallowedTemplatePatterns = [
      /\bmain prompt\b/i,
      /\btechnical specs?\b/i,
      /\balternative approaches\b/i,
    ];
    const disallowedPrefixes = [
      'consider',
      'try',
      'maybe',
      'you could',
      'focus on',
      'rewrite',
      'update',
      'suggest',
      'recommend',
    ];
    const oneClipPatterns = [
      /\band then\b/i,
      /\bstarts?\s+to\b/i,
      /\bbegins?\s+to\b/i,
      /\bnext\b/i,
    ];

    suggestions.forEach((suggestion) => {
      if (!suggestion) {
        return;
      }

      const suggestionObj: Suggestion =
        typeof suggestion === 'string'
          ? { text: suggestion, explanation: '' }
          : { ...suggestion };

      if (typeof suggestionObj.text !== 'string') {
        return;
      }

      let text = suggestionObj.text.replace(/^[0-9]+\.\s*/, '');
      text = text.replace(/\s+/g, ' ').trim();
      const lowerText = text.toLowerCase();

      if (!text) {
        return;
      }

      if (normalizedHighlight && lowerText === normalizedHighlight) {
        return; // identical to highlight, no improvement
      }

      if (this.exampleTexts.has(lowerText)) {
        return;
      }

      if (/\r|\n/.test(text)) {
        return; // multi-line response is not a drop-in replacement
      }

      if (disallowedTemplatePatterns.some((pattern) => pattern.test(text))) {
        return;
      }

      // Strip conversational prefixes instead of rejecting
      const foundPrefix = disallowedPrefixes.find((prefix) => lowerText.startsWith(prefix));
      if (foundPrefix) {
        text = text.substring(foundPrefix.length).trim();
        // Re-check validity after stripping
        if (!text) return;
      }

      // Strip trailing object overlap for action spans
      text = this._stripContinuationOverlap(text, extendedContext);

      if (context.isVideoPrompt && oneClipPatterns.some((pattern) => pattern.test(text))) {
        return; // violates One Clip, One Action guidance
      }

      const wordCount = this.videoService.countWords(text);

      if (context.isPlaceholder) {
        const fallbackVideoConstraints =
          context.isVideoPrompt && !context.videoConstraints
            ? this._getVideoPlaceholderFallbackConstraints(context.highlightedText)
            : undefined;
        const constraints = {
          minWords: 1,
          maxWords: 4,
          maxSentences: 1,
          disallowTerminalPunctuation: true,
          ...(fallbackVideoConstraints || {}),
          ...(context.videoConstraints || {}),
        };

        const minWords = Number.isFinite(constraints.minWords)
          ? constraints.minWords!
          : 1;
        const maxWords = Number.isFinite(constraints.maxWords)
          ? constraints.maxWords!
          : 4;
        const maxSentences = Number.isFinite(constraints.maxSentences)
          ? constraints.maxSentences!
          : 1;

        if (wordCount < minWords || wordCount > maxWords) {
          return;
        }

        const sentenceCount = (text.match(/[.!?]/g) || []).length;
        if (maxSentences > 0 && sentenceCount > maxSentences) {
          return;
        }

        if (constraints.disallowTerminalPunctuation && /[.!?]$/.test(text)) {
          return;
        }

        if (constraints.mode === 'micro') {
          if (/[.!?]/.test(text)) {
            return;
          }

          const commaCount = (text.match(/,/g) || []).length;
          if (commaCount > 1 || /[:;]/.test(text)) {
            return;
          }

          if (/\b(is|are|was|were|be|being|been|am)\b/i.test(lowerText)) {
            return;
          }
        }
      } else if (context.isVideoPrompt) {
        const constraints = context.videoConstraints || {
          minWords: 2,
          maxWords: 50,
          maxSentences: 1,
        };

        const minWords = Number.isFinite(constraints.minWords)
          ? constraints.minWords!
          : 2;
        const maxWords = Number.isFinite(constraints.maxWords)
          ? constraints.maxWords!
          : 50;
        const maxSentences = Number.isFinite(constraints.maxSentences)
          ? constraints.maxSentences!
          : 1;

        if (wordCount < minWords || wordCount > maxWords) {
          return;
        }

        const sentenceCount = (text.match(/[.!?]/g) || []).length;
        if (maxSentences > 0 && sentenceCount > maxSentences) {
          return;
        }

        if (constraints.disallowTerminalPunctuation && /[.!?]$/.test(text)) {
          return;
        }

        if (constraints.mode === 'micro') {
          if (/[.!?]/.test(text)) {
            return;
          }

          // Allow single comma for camera specs like "50mm lens, shallow DOF"
          // but still reject colons and semicolons
          const commaCount = (text.match(/,/g) || []).length;
          if (commaCount > 1 || /[:;]/.test(text)) {
            return;
          }

          if (/\b(is|are|was|were|be|being|been|am)\b/i.test(lowerText)) {
            return;
          }
        }

        if (/\b(prompt|section|paragraph|rewrite|entire|overall)\b/i.test(text)) {
          return;
        }
      }

      if (context.lockedSpanCategories && context.lockedSpanCategories.length > 0) {
        const targetParent =
          (getParentCategory(context.highlightedCategory) || context.highlightedCategory || '').toLowerCase();
        const compatibleSiblings = this.compatibleLockedCategories[targetParent] || new Set<string>();
        const lockedParents = Array.from(
          new Set(
            context.lockedSpanCategories
              .map((category) => (getParentCategory(category) || category).toLowerCase())
              .filter(Boolean)
          )
        ).filter(
          (category) =>
            category && category !== targetParent && !compatibleSiblings.has(category)
        );

        const hasConflict = lockedParents.some((category) => {
          const pattern = this.lockedCategoryPatterns[category];
          return pattern ? pattern.test(text) : false;
        });

        if (hasConflict) {
          return;
        }
      }

      const hardRejectReason = this._getHardRejectReason(text, extendedContext);
      if (hardRejectReason) {
        return;
      }

      const shouldDeprioritize = this._shouldDeprioritize(text, extendedContext);
      const target = shouldDeprioritize ? deprioritized : primary;
      target.push(
        shouldDeprioritize
          ? {
              ...suggestionObj,
              text,
              [this.deprioritizedMarker]: true,
            }
          : {
              ...suggestionObj,
              text,
            }
      );
    });

    const duration = Math.round(performance.now() - startTime);

    this.log.info('Suggestions sanitized', {
      operation,
      duration,
      inputCount: suggestions.length,
      primaryCount: primary.length,
      deprioritizedCount: deprioritized.length,
      filteredCount: suggestions.length - primary.length - deprioritized.length,
    });

    // Apply word count heuristics to primary suggestions only;
    // deprioritized suggestions always sort to the end
    const primaryRanked = this._applyPreferredWordCountHeuristics(primary, context);
    return [...primaryRanked, ...deprioritized];
  }

  /**
   * Validate suggestions against category and template requirements
   * @param suggestions - Suggestions to validate
   * @param highlightedText - Original highlighted text
   * @param category - Category to validate against
   * @returns Validated suggestions
   */
  validateSuggestions(suggestions: Suggestion[], highlightedText: string, category: string): Suggestion[] {
    const operation = 'validateSuggestions';
    
    if (!suggestions || !Array.isArray(suggestions)) {
      this.log.debug('Invalid suggestions input, returning empty', {
        operation,
      });
      return [];
    }
    
    this.log.debug('Validating suggestions', {
      operation,
      suggestionCount: suggestions.length,
      category,
      highlightLength: highlightedText.length,
    });

    const validationContext: ExtendedSanitizationContext = {
      highlightedText,
      highlightedCategory: category,
      isPlaceholder: false,
      isVideoPrompt: true,
    };

    const validated = suggestions.filter(suggestion => {
      // Basic validation
      if (!suggestion.text || typeof suggestion.text !== 'string') return false;

      // Skip audio suggestions for non-audio categories
      if (['technical', 'framing', 'lighting', 'descriptive'].includes(category)) {
        if (/audio|sound|music|score|orchestra/i.test(suggestion.text)) {
          return false;
        }
      }

      if (this._getHardRejectReason(suggestion.text, validationContext)) {
        return false;
      }

      // Validate against video template requirements using taxonomy ID directly
      return validateAgainstVideoTemplate(suggestion, category);
    });
    
    this.log.info('Suggestions validated', {
      operation,
      inputCount: suggestions.length,
      outputCount: validated.length,
      category,
    });
    
    return validated;
  }

  private _getVideoPlaceholderFallbackConstraints(
    highlightedText: string | undefined
  ): ReturnType<VideoService['getVideoReplacementConstraints']> | undefined {
    const highlightWordCount = highlightedText
      ? this.videoService.countWords(highlightedText)
      : undefined;

    try {
      return this.videoService.getVideoReplacementConstraints({
        ...(highlightWordCount !== undefined ? { highlightWordCount } : {}),
        ...(highlightedText ? { highlightedText } : {}),
      });
    } catch (error) {
      this.log.warn('Failed to derive fallback video constraints for placeholder sanitization', {
        error: error instanceof Error ? error.message : String(error),
      });
      return undefined;
    }
  }

  private _applyPreferredWordCountHeuristics(
    suggestions: Suggestion[],
    context: SanitizationContext
  ): Suggestion[] {
    if (!context.isVideoPrompt || suggestions.length === 0 || !context.highlightedText) {
      return suggestions;
    }

    const targetWords = this.videoService.countWords(context.highlightedText);
    if (targetWords <= 0) {
      return suggestions;
    }

    const preferredMin = Math.max(1, Math.floor(targetWords * 0.5));
    const preferredMax = Math.max(preferredMin, Math.ceil(targetWords * 1.5));

    const ranked = suggestions
      .map((suggestion, index) => {
        const suggestionWordCount = this.videoService.countWords(suggestion.text);
        const distance = Math.abs(suggestionWordCount - targetWords) / Math.max(targetWords, 1);
        return { suggestion, index, suggestionWordCount, distance };
      })
      .sort((a, b) => a.distance - b.distance || a.index - b.index);

    if (ranked.length > 3) {
      const inPreferredRange = ranked.filter(
        (entry) =>
          entry.suggestionWordCount >= preferredMin &&
          entry.suggestionWordCount <= preferredMax
      );

      if (inPreferredRange.length >= 3) {
        // Keep out-of-range suggestions at the end instead of dropping them
        const outOfRange = ranked.filter(
          (entry) =>
            entry.suggestionWordCount < preferredMin ||
            entry.suggestionWordCount > preferredMax
        );
        return [...inPreferredRange, ...outOfRange].map((entry) => entry.suggestion);
      }
    }

    return ranked.map((entry) => entry.suggestion);
  }

  /**
   * Group suggestions by their categories
   * @param suggestions - Array of suggestions with category field
   * @returns Grouped suggestions by category
   */
  groupSuggestionsByCategory(suggestions: Suggestion[]): GroupedSuggestions[] {
    const grouped: Record<string, Suggestion[]> = {};

    suggestions.forEach(suggestion => {
      const category = suggestion.category || 'Other';
      if (!grouped[category]) {
        grouped[category] = [];
      }
      grouped[category].push(suggestion);
    });

    // Convert to array format for easier frontend handling
    return Object.entries(grouped).map(([category, items]) => ({
      category,
      suggestions: items
    }));
  }

  private _getHardRejectReason(
    text: string,
    context: ExtendedSanitizationContext
  ): string | null {
    if (this._violatesArticleAgreement(text, context)) {
      return 'article-agreement';
    }

    if (this._failsSlotFitGuard(text, context)) {
      return 'slot-fit';
    }

    if (this._hasActorDrift(text, context)) {
      return 'actor-drift';
    }

    if (this._hasSubjectClassDrift(text, context)) {
      return 'subject-class-drift';
    }

    return null;
  }

  private _shouldDeprioritize(text: string, context: ExtendedSanitizationContext): boolean {
    void text;
    void context;
    return false;
  }

  private _failsSlotFitGuard(text: string, context: ExtendedSanitizationContext): boolean {
    const category = this._normalizeCategoryKey(context.highlightedCategory || '');
    const lowerText = text.toLowerCase();

    if (category === 'camera.angle') {
      if (
        this.cameraMovementTerms.test(text) ||
        this.lensApertureTerms.test(text) ||
        this.cameraFocusTerms.test(text)
      ) {
        return true;
      }
      return !this.cameraAngleTerms.test(text);
    }

    if (category === 'camera.movement') {
      if (
        this.lensApertureTerms.test(text) ||
        this.cameraFocusTerms.test(text) ||
        this.shotFramingTerms.test(text)
      ) {
        return true;
      }
      return !this.cameraMovementTerms.test(text);
    }

    if (category === 'camera.focus') {
      if (
        this.cameraMovementTerms.test(text) ||
        this.lensApertureTerms.test(text) ||
        this.shotFramingTerms.test(text)
      ) {
        return true;
      }
      return !this.cameraFocusTerms.test(text);
    }

    if (category === 'camera.lens') {
      if (
        this.cameraMovementTerms.test(text) ||
        this.cameraFocusTerms.test(text) ||
        this.shotFramingTerms.test(text)
      ) {
        return true;
      }
      return !this.lensApertureTerms.test(text);
    }

    if (category === 'shot.type') {
      const hasShotFraming = this.shotFramingTerms.test(text);
      const hasMovementLanguage = this.cameraMovementTerms.test(text);
      if (!hasShotFraming) {
        return true;
      }
      return hasMovementLanguage || this.lensApertureTerms.test(text) || this.cameraFocusTerms.test(text);
    }

    const highlightedWordCount = this.videoService.countWords(context.highlightedText || '');
    const suggestionWordCount = this.videoService.countWords(text);
    const isAdjectiveLikeLightingSlot =
      category === 'lighting.quality' ||
      (category.startsWith('lighting.') &&
        highlightedWordCount <= 2 &&
        typeof context.contextAfter === 'string' &&
        context.contextAfter.trim().startsWith(','));

    if (isAdjectiveLikeLightingSlot) {
      if (this.cameraTechniqueTerms.test(text) || this.cameraFocusTerms.test(text)) {
        return true;
      }
      const looksLikeSourceClause =
        this.lightSourceClauseTerms.test(text) &&
        (suggestionWordCount >= 4 || this.lightingClauseVerbTerms.test(text));
      if (looksLikeSourceClause) {
        return true;
      }
      if (!this.lightingQualityCueTerms.test(text)) {
        return true;
      }
    }

    if (category === 'lighting.timeofday') {
      if (
        this.cameraTechniqueTerms.test(text) ||
        this.cameraFocusTerms.test(text) ||
        this.lightSourceClauseTerms.test(text) ||
        this.lightingClauseVerbTerms.test(text) ||
        this.lightingDirectionTerms.test(text)
      ) {
        return true;
      }
      return !this.timeOfDayTerms.test(text);
    }

    if (category === 'lighting.source') {
      if (this.cameraTechniqueTerms.test(text) || this.cameraFocusTerms.test(text)) {
        return true;
      }
      if (!this.lightingQualityCueTerms.test(text)) {
        return true;
      }
      const hasSourceOrDirection =
        this.lightSourceClauseTerms.test(text) || this.lightingDirectionTerms.test(text);
      if (!hasSourceOrDirection) {
        return true;
      }
    }

    if (category === 'style.aesthetic') {
      if (
        this.cameraTechniqueTerms.test(text) ||
        this.cameraMovementTerms.test(text) ||
        this.lightSourceClauseTerms.test(text) ||
        this.lightingDirectionTerms.test(text)
      ) {
        return true;
      }
      if (!this.styleStrongCueTerms.test(text)) {
        return true;
      }
    }

    if (category === 'environment.location') {
      if (this.environmentContextTerms.test(text) || this.vehicleInteriorTerms.test(text)) {
        return true;
      }
      return !this.externalLocationTerms.test(text);
    }

    if (category === 'environment.context') {
      if (this.externalLocationTerms.test(text)) {
        return true;
      }
      return !this.environmentContextTerms.test(text);
    }

    if (category === 'environment.weather') {
      const highlighted = (context.highlightedText || '').toLowerCase();
      if (
        this.weatherGentleAirTerms.test(highlighted) &&
        this.weatherDisruptiveTerms.test(lowerText)
      ) {
        return true;
      }
    }

    return false;
  }

  private _hasActorDrift(text: string, context: ExtendedSanitizationContext): boolean {
    const category = this._normalizeCategoryKey(context.highlightedCategory || '');
    if (!category.startsWith('action')) {
      return false;
    }

    const localContext = [
      context.contextBefore || '',
      context.contextAfter || '',
      context.spanAnchors || '',
      context.nearbySpanHints || '',
    ]
      .join(' ')
      .toLowerCase();

    if (!this.environmentMotionSubjectTerms.test(localContext)) {
      return false;
    }

    return (
      this.humanBodyActionTerms.test(text.toLowerCase()) ||
      this.humanSubjectTerms.test(text.toLowerCase())
    );
  }

  /**
   * Strip trailing tokens from a suggestion that overlap with the start of contextAfter.
   * Only applies to action-category spans where the LLM may absorb the trailing object.
   */
  _stripContinuationOverlap(text: string, context: ExtendedSanitizationContext): string {
    const category = (context.highlightedCategory || '').toLowerCase();
    if (!category.startsWith('action')) return text;

    const after = context.contextAfter?.trim();
    if (!after) return text;

    const afterTokens = after.toLowerCase().split(/\s+/).slice(0, 6);
    const suggestionTokens = text.toLowerCase().split(/\s+/);

    if (afterTokens.length < 2 || suggestionTokens.length < 2) return text;

    // Check if the suggestion's tail matches the continuation's head
    // Try match lengths from 5 down to 2
    const maxMatch = Math.min(5, afterTokens.length, suggestionTokens.length - 1);
    for (let n = maxMatch; n >= 2; n--) {
      const suggestionTail = suggestionTokens.slice(-n);
      const continuationHead = afterTokens.slice(0, n);
      if (suggestionTail.every((t, i) => t === continuationHead[i])) {
        // Strip the overlapping tail, preserving original casing
        const originalTokens = text.split(/\s+/);
        const stripped = originalTokens.slice(0, originalTokens.length - n).join(' ').trim();
        if (stripped) return stripped;
      }
    }

    return text;
  }

  private _hasSubjectClassDrift(text: string, context: ExtendedSanitizationContext): boolean {
    const category = this._normalizeCategoryKey(context.highlightedCategory || '');
    if (!category.startsWith('subject.')) {
      return false;
    }

    const localContext = [
      context.highlightedText || '',
      context.contextBefore || '',
      context.contextAfter || '',
      context.spanAnchors || '',
      context.nearbySpanHints || '',
    ]
      .join(' ')
      .toLowerCase();

    const hasHumanIdentityContext = this.humanSubjectTerms.test(localContext);
    if (!hasHumanIdentityContext) {
      return false;
    }

    const lowerText = text.toLowerCase();
    return (
      this.nonHumanIdentityTerms.test(lowerText) ||
      this.fantasyOrRoleShiftTerms.test(lowerText)
    );
  }

  private _violatesArticleAgreement(text: string, context: ExtendedSanitizationContext): boolean {
    const prefix = (context.contextBefore || '').trimEnd();
    const articleMatch = prefix.match(/\b(a|an)\s*$/i);
    if (!articleMatch) {
      return false;
    }

    const lowerText = text.toLowerCase();
    if (/^[a-z]+['’]s\b/i.test(text) || /^(his|her|their|its)\b/i.test(lowerText)) {
      return true;
    }

    const firstWord = lowerText.match(/^[a-z]+/)?.[0];
    if (!firstWord) {
      return false;
    }

    const article = articleMatch[1]!.toLowerCase();
    const vowelSound =
      /^[aeiou]/.test(firstWord) || /^(honest|hour|heir|honor)/.test(firstWord);
    const consonantSound =
      /^[^aeiou]/.test(firstWord) || /^(uni([^n]|$)|use|euro|one|ubiq)/.test(firstWord);

    if (article === 'a' && vowelSound) {
      return true;
    }

    if (article === 'an' && consonantSound) {
      return true;
    }

    return false;
  }

  private _normalizeCategoryKey(category: string): string {
    return category.toLowerCase().replace(/[_-]/g, '');
  }
}
