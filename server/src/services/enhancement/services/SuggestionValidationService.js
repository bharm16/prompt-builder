import { validateAgainstVideoTemplate, detectSubcategory } from './config/CategoryConstraints.js';

/**
 * SuggestionValidationService
 * 
 * Responsible for validating and sanitizing enhancement suggestions.
 * Ensures suggestions meet requirements and are valid drop-in replacements.
 * 
 * Single Responsibility: Suggestion validation and sanitization
 */
export class SuggestionValidationService {
  constructor(videoService) {
    this.videoService = videoService;
  }

  /**
   * Sanitize suggestions to ensure they are valid drop-in replacements
   * @param {Array} suggestions - Raw suggestions from Claude
   * @param {Object} context - Context for validation
   * @returns {Array} Sanitized suggestions
   */
  sanitizeSuggestions(
    suggestions,
    { highlightedText, isPlaceholder, isVideoPrompt, videoConstraints }
  ) {
    if (!Array.isArray(suggestions) || suggestions.length === 0) {
      return [];
    }

    const sanitized = [];
    const normalizedHighlight = highlightedText?.trim().toLowerCase();
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

    suggestions.forEach((suggestion) => {
      if (!suggestion) {
        return;
      }

      const suggestionObj =
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

      const wordCount = this.videoService.countWords(text);

      if (isPlaceholder) {
        if (wordCount === 0 || wordCount > 4) {
          return;
        }

        if (/[.!?]/.test(text)) {
          return;
        }
      } else if (isVideoPrompt) {
        const constraints = videoConstraints || {
          minWords: 10,
          maxWords: 25,
          maxSentences: 1,
        };

        const minWords = Number.isFinite(constraints.minWords)
          ? constraints.minWords
          : 10;
        const maxWords = Number.isFinite(constraints.maxWords)
          ? constraints.maxWords
          : 25;
        const maxSentences = Number.isFinite(constraints.maxSentences)
          ? constraints.maxSentences
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

          if (/[,:;]/.test(text)) {
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
   * @param {Array} suggestions - Suggestions to validate
   * @param {string} highlightedText - Original highlighted text
   * @param {string} category - Category to validate against
   * @returns {Array} Validated suggestions
   */
  validateSuggestions(suggestions, highlightedText, category) {
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
   * @param {Array} suggestions - Array of suggestions with category field
   * @returns {Array} Grouped suggestions by category
   */
  groupSuggestionsByCategory(suggestions) {
    const grouped = {};

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
