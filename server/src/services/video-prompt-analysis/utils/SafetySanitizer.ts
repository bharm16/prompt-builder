/**
 * SafetySanitizer Utility
 *
 * Pre-flight safety check utility to prevent API rejections and account bans.
 * Sanitizes prompts by replacing blocked terms with generic descriptors.
 *
 * @module SafetySanitizer
 */

/**
 * Represents a replacement made during sanitization
 */
export interface SanitizationReplacement {
  /** The original blocked term that was found */
  original: string;
  /** The generic descriptor that replaced it */
  replacement: string;
  /** Category of the blocked term */
  category: 'celebrity' | 'nsfw' | 'violence' | 'other';
}

/**
 * Result of SafetySanitizer processing
 */
export interface SafetySanitizerResult {
  /** The sanitized text with blocked terms replaced */
  text: string;
  /** List of replacements made */
  replacements: SanitizationReplacement[];
  /** Whether any replacements were made */
  wasModified: boolean;
}

/**
 * Celebrity names that should be replaced with physical descriptions
 * This is a representative sample - production would use a more comprehensive list
 */
const CELEBRITY_REPLACEMENTS: Record<string, string> = {
  'taylor swift': 'a pop star with blonde hair',
  'beyonce': 'a singer with dark curly hair',
  'beyoncé': 'a singer with dark curly hair',
  'elon musk': 'a businessman with short brown hair',
  'donald trump': 'an older man with blonde hair',
  'joe biden': 'an elderly man with white hair',
  'kim kardashian': 'a woman with long dark hair',
  'kanye west': 'a man with short dark hair',
  'ye': 'a man with short dark hair',
  'rihanna': 'a singer with dark hair',
  'drake': 'a man with a beard',
  'ariana grande': 'a young woman with a ponytail',
  'justin bieber': 'a young man with light brown hair',
  'selena gomez': 'a young woman with dark hair',
  'dwayne johnson': 'a muscular bald man',
  'the rock': 'a muscular bald man',
  'tom cruise': 'a man with dark hair',
  'brad pitt': 'a man with blonde hair',
  'angelina jolie': 'a woman with dark hair',
  'jennifer lawrence': 'a woman with blonde hair',
  'leonardo dicaprio': 'a man with light brown hair',
  'scarlett johansson': 'a woman with blonde hair',
  'chris hemsworth': 'a tall man with blonde hair',
  'robert downey jr': 'a man with dark hair and goatee',
  'keanu reeves': 'a man with long dark hair',
  'zendaya': 'a young woman with curly hair',
  'timothee chalamet': 'a young man with curly dark hair',
  'timothée chalamet': 'a young man with curly dark hair',
  'billie eilish': 'a young woman with dyed hair',
  'harry styles': 'a young man with curly hair',
  'emma watson': 'a woman with brown hair',
  'chris evans': 'a man with short brown hair',
  'mark zuckerberg': 'a man with short curly hair',
  'jeff bezos': 'a bald man',
  'bill gates': 'a man with glasses',
  'oprah winfrey': 'a woman with dark hair',
  'barack obama': 'a man with short dark hair',
  'michelle obama': 'a woman with dark hair',
  'lebron james': 'a professional basketball player',
};

/**
 * NSFW terms that should be blocked
 * Using generic placeholders - production would use comprehensive list
 */
const NSFW_TERMS = new Set([
  'nude',
  'naked',
  'nsfw',
  'explicit',
  'pornographic',
  'sexual',
  'erotic',
  'xxx',
  'adult content',
  'obscene',
  'indecent',
]);

/**
 * Violence-related terms that should be blocked
 */
const VIOLENCE_TERMS = new Set([
  'murder',
  'killing',
  'torture',
  'gore',
  'dismember',
  'decapitate',
  'mutilate',
  'massacre',
  'slaughter',
  'bloodbath',
  'execution',
  'assassination',
  'terrorist',
  'terrorism',
  'bomb making',
  'mass shooting',
]);

/**
 * Generic replacements for blocked categories
 */
const CATEGORY_REPLACEMENTS: Record<string, string> = {
  nsfw: '[content removed]',
  violence: '[content removed]',
  other: '[content removed]',
};

/**
 * SafetySanitizer sanitizes prompts for safety compliance
 *
 * Features:
 * - Replaces celebrity names with physical descriptions
 * - Removes NSFW terms
 * - Removes violence-related terms
 * - Returns detailed replacement information
 */
export class SafetySanitizer {
  private celebrityPatterns: Map<RegExp, string>;

  constructor() {
    // Pre-compile celebrity patterns for efficiency
    this.celebrityPatterns = new Map();
    for (const [name, replacement] of Object.entries(CELEBRITY_REPLACEMENTS)) {
      const pattern = new RegExp(`\\b${this.escapeRegex(name)}\\b`, 'gi');
      this.celebrityPatterns.set(pattern, replacement);
    }
  }

  /**
   * Sanitize text by replacing blocked terms with generic descriptors
   *
   * @param text - Input text to sanitize
   * @returns Sanitized result with text and replacement metadata
   */
  sanitize(text: string): SafetySanitizerResult {
    const replacements: SanitizationReplacement[] = [];
    let processedText = text;

    // Process celebrity names
    processedText = this.sanitizeCelebrities(processedText, replacements);

    // Process NSFW terms
    processedText = this.sanitizeTerms(
      processedText,
      NSFW_TERMS,
      'nsfw',
      replacements
    );

    // Process violence terms
    processedText = this.sanitizeTerms(
      processedText,
      VIOLENCE_TERMS,
      'violence',
      replacements
    );

    // Clean up whitespace
    processedText = this.cleanWhitespace(processedText);

    return {
      text: processedText,
      replacements,
      wasModified: replacements.length > 0,
    };
  }

  /**
   * Check if text contains any blocked terms
   *
   * @param text - Text to check
   * @returns true if blocked terms are found
   */
  containsBlockedTerms(text: string): boolean {
    const lowerText = text.toLowerCase();

    // Check celebrities
    for (const name of Object.keys(CELEBRITY_REPLACEMENTS)) {
      if (lowerText.includes(name)) {
        return true;
      }
    }

    // Check NSFW
    for (const term of NSFW_TERMS) {
      if (this.containsWord(lowerText, term)) {
        return true;
      }
    }

    // Check violence
    for (const term of VIOLENCE_TERMS) {
      if (this.containsWord(lowerText, term)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Check if a specific term is blocked
   *
   * @param term - Term to check
   * @returns true if the term is blocked
   */
  isBlockedTerm(term: string): boolean {
    const lowerTerm = term.toLowerCase();

    return (
      CELEBRITY_REPLACEMENTS.hasOwnProperty(lowerTerm) ||
      NSFW_TERMS.has(lowerTerm) ||
      VIOLENCE_TERMS.has(lowerTerm)
    );
  }

  /**
   * Get the replacement for a celebrity name
   *
   * @param name - Celebrity name
   * @returns Physical description replacement or undefined
   */
  getCelebrityReplacement(name: string): string | undefined {
    return CELEBRITY_REPLACEMENTS[name.toLowerCase()];
  }

  /**
   * Sanitize celebrity names in text
   */
  private sanitizeCelebrities(
    text: string,
    replacements: SanitizationReplacement[]
  ): string {
    let result = text;

    for (const [pattern, replacement] of this.celebrityPatterns) {
      const matches = result.match(pattern);
      if (matches) {
        for (const match of matches) {
          replacements.push({
            original: match,
            replacement,
            category: 'celebrity',
          });
        }
        result = result.replace(pattern, replacement);
      }
    }

    return result;
  }

  /**
   * Sanitize terms from a blocklist
   */
  private sanitizeTerms(
    text: string,
    terms: Set<string>,
    category: 'nsfw' | 'violence' | 'other',
    replacements: SanitizationReplacement[]
  ): string {
    let result = text;
    const replacement = CATEGORY_REPLACEMENTS[category] ?? '[content removed]';

    for (const term of terms) {
      const pattern = new RegExp(`\\b${this.escapeRegex(term)}\\b`, 'gi');
      const matches = result.match(pattern);

      if (matches) {
        for (const match of matches) {
          replacements.push({
            original: match,
            replacement,
            category,
          });
        }
        result = result.replace(pattern, replacement);
      }
    }

    return result;
  }

  /**
   * Check if text contains a word (with word boundaries)
   */
  private containsWord(text: string, word: string): boolean {
    const pattern = new RegExp(`\\b${this.escapeRegex(word)}\\b`, 'i');
    return pattern.test(text);
  }

  /**
   * Escape special regex characters
   */
  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Clean up whitespace after replacements
   */
  private cleanWhitespace(text: string): string {
    return text
      .replace(/\s+/g, ' ')
      .replace(/\s*,\s*,/g, ',')
      .replace(/,\s*$/g, '')
      .replace(/^\s*,/g, '')
      .trim();
  }
}

/**
 * Singleton instance for convenience
 */
export const safetySanitizer = new SafetySanitizer();
