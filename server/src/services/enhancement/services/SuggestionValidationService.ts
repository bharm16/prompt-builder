import { logger } from '@infrastructure/Logger';
import { validateAgainstVideoTemplate, detectSubcategory } from '../config/CategoryConstraints.js';
import { getParentCategory } from '@shared/taxonomy';
import { getAllExampleTexts } from '../config/EnhancementExamples';
import type { Suggestion, SanitizationContext, GroupedSuggestions, VideoService } from './types.js';

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
  private readonly lockedCategoryPatterns: Record<string, RegExp> = {
    camera: /\b(dolly|track(ing)?|pan|tilt|crane|zoom|handheld|static|lens|mm|wide shot|close[-\s]?up|over[-\s]?the[-\s]?shoulder|angle|framing)\b/i,
    shot: /\b(wide shot|medium shot|close[-\s]?up|extreme close[-\s]?up|over[-\s]?the[-\s]?shoulder|shot|angle)\b/i,
    lighting: /\b(lighting|shadow|glow|illuminat|backlight|rim light|key light|fill light|high[-\s]?key|low[-\s]?key|sunlight|moonlight)\b/i,
    technical: /\b(\d+fps|frame rate|aspect ratio|\d+:\d+|4k|8k|resolution|duration|mm film|film format)\b/i,
  };

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

    const sanitized: Suggestion[] = [];
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
          getParentCategory(context.highlightedCategory) ||
          context.highlightedCategory ||
          '';
        const lockedParents = Array.from(
          new Set(
            context.lockedSpanCategories
              .map((category) => getParentCategory(category) || category)
              .filter(Boolean)
          )
        ).filter((category) => category && category !== targetParent);

        const hasConflict = lockedParents.some((category) => {
          const pattern = this.lockedCategoryPatterns[category];
          return pattern ? pattern.test(text) : false;
        });

        if (hasConflict) {
          return;
        }
      }

      sanitized.push({
        ...suggestionObj,
        text,
      });
    });

    const duration = Math.round(performance.now() - startTime);
    
    this.log.info('Suggestions sanitized', {
      operation,
      duration,
      inputCount: suggestions.length,
      outputCount: sanitized.length,
      filteredCount: suggestions.length - sanitized.length,
    });

    return this._applyPreferredWordCountHeuristics(sanitized, context);
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

    const subcategory = detectSubcategory(highlightedText, category);

    const validated = suggestions.filter(suggestion => {
      // Basic validation
      if (!suggestion.text || typeof suggestion.text !== 'string') return false;

      // Skip audio suggestions for non-audio categories
      if (['technical', 'framing', 'lighting', 'descriptive'].includes(category)) {
        if (/audio|sound|music|score|orchestra/i.test(suggestion.text)) {
          return false;
        }
      }

      // Validate against video template requirements
      return validateAgainstVideoTemplate(suggestion, category, subcategory);
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
        return inPreferredRange.map((entry) => entry.suggestion);
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
}
