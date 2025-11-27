import { validateAgainstVideoTemplate, detectSubcategory } from '../config/CategoryConstraints.js';
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
    if (!Array.isArray(suggestions) || suggestions.length === 0) {
      return [];
    }

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
      /\bafter\b/i,
      /\bbefore\b/i,
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

      if (!text) {
        return;
      }

      if (normalizedHighlight && text.toLowerCase() === normalizedHighlight) {
        return; // identical to highlight, no improvement
      }

      if (/\r|\n/.test(text)) {
        return; // multi-line response is not a drop-in replacement
      }

      if (disallowedTemplatePatterns.some((pattern) => pattern.test(text))) {
        return;
      }

      const lowerText = text.toLowerCase();
      if (disallowedPrefixes.some((prefix) => lowerText.startsWith(prefix))) {
        return;
      }

      if (context.isVideoPrompt && oneClipPatterns.some((pattern) => pattern.test(text))) {
        return; // violates One Clip, One Action guidance
      }

      const wordCount = this.videoService.countWords(text);

      if (context.isPlaceholder) {
        if (wordCount === 0 || wordCount > 4) {
          return;
        }

        if (/[.!?]/.test(text)) {
          return;
        }
      } else if (context.isVideoPrompt) {
        const constraints = context.videoConstraints || {
          minWords: 10,
          maxWords: 25,
          maxSentences: 1,
        };

        const minWords = Number.isFinite(constraints.minWords)
          ? constraints.minWords!
          : 10;
        const maxWords = Number.isFinite(constraints.maxWords)
          ? constraints.maxWords!
          : 25;
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

      sanitized.push({
        ...suggestionObj,
        text,
      });
    });

    return sanitized;
  }

  /**
   * Validate suggestions against category and template requirements
   * @param suggestions - Suggestions to validate
   * @param highlightedText - Original highlighted text
   * @param category - Category to validate against
   * @returns Validated suggestions
   */
  validateSuggestions(suggestions: Suggestion[], highlightedText: string, category: string): Suggestion[] {
    if (!suggestions || !Array.isArray(suggestions)) return [];

    const subcategory = detectSubcategory(highlightedText, category);

    return suggestions.filter(suggestion => {
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

