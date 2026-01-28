/**
 * TechStripper Utility
 *
 * Removes placebo tokens that degrade model performance.
 * Model-aware: removes tokens for Runway/Luma, keeps for Kling/Veo.
 *
 * @module TechStripper
 */

/**
 * Placebo tokens that may degrade performance on certain models
 */
const PLACEBO_TOKENS = [
  '4k',
  '8k',
  'trending on artstation',
  'award winning',
  'award-winning',
  'highly detailed',
  'ultra hd',
  'ultra-hd',
  'uhd',
  'hdr',
  'masterpiece',
  'best quality',
] as const;

/**
 * Models where placebo tokens should be REMOVED
 * These models perform better without resolution/quality boosters
 */
const STRIP_MODELS = new Set([
  'runway-gen45',
  'luma-ray3',
]);

/**
 * Models where placebo tokens should be KEPT as boosters
 * These models may benefit from quality descriptors
 */
const KEEP_MODELS = new Set([
  'kling-26',
  'veo-4',
  'sora-2',
]);

/**
 * Result of TechStripper processing
 */
export interface TechStripperResult {
  /** The processed text with tokens removed or preserved */
  text: string;
  /** List of tokens that were stripped */
  strippedTokens: string[];
  /** Whether tokens were stripped (true) or preserved (false) */
  tokensWereStripped: boolean;
}

/**
 * TechStripper removes placebo tokens that degrade model performance
 *
 * Behavior is model-aware:
 * - Runway/Luma: Remove placebo tokens (they degrade A2D/diffusion quality)
 * - Kling/Veo/Sora: Keep placebo tokens (they may act as boosters)
 */
export class TechStripper {
  /**
   * Process text to strip or preserve placebo tokens based on model
   *
   * @param text - Input text to process
   * @param modelId - Target model identifier (e.g., "runway-gen45", "kling-26")
   * @returns Processed result with text and metadata
   */
  strip(text: string, modelId: string): TechStripperResult {
    const shouldStrip = this.shouldStripTokens(modelId);

    if (!shouldStrip) {
      return {
        text,
        strippedTokens: [],
        tokensWereStripped: false,
      };
    }

    const strippedTokens: string[] = [];
    let processedText = text;

    for (const token of PLACEBO_TOKENS) {
      // Create case-insensitive regex with word boundaries
      const regex = new RegExp(`\\b${this.escapeRegex(token)}\\b`, 'gi');
      const matches = processedText.match(regex);

      if (matches) {
        strippedTokens.push(...matches.map((m) => m.toLowerCase()));
        processedText = processedText.replace(regex, '');
      }
    }

    // Clean up extra whitespace from removals
    processedText = this.cleanWhitespace(processedText);

    return {
      text: processedText,
      strippedTokens: [...new Set(strippedTokens)], // Deduplicate
      tokensWereStripped: strippedTokens.length > 0,
    };
  }

  /**
   * Check if a token is a placebo token
   *
   * @param token - Token to check
   * @returns true if the token is a placebo token
   */
  isPlaceboToken(token: string): boolean {
    const normalized = token.toLowerCase().trim();
    return PLACEBO_TOKENS.some(
      (placebo) => placebo.toLowerCase() === normalized
    );
  }

  /**
   * Determine if tokens should be stripped for a given model
   *
   * @param modelId - Model identifier
   * @returns true if tokens should be stripped, false if kept
   */
  shouldStripTokens(modelId: string): boolean {
    const normalizedId = modelId.toLowerCase();

    if (STRIP_MODELS.has(normalizedId)) {
      return true;
    }

    if (KEEP_MODELS.has(normalizedId)) {
      return false;
    }

    // Default: strip tokens for unknown models (safer default)
    return true;
  }

  /**
   * Get list of all placebo tokens
   *
   * @returns Array of placebo token strings
   */
  getPlaceboTokens(): readonly string[] {
    return PLACEBO_TOKENS;
  }

  /**
   * Escape special regex characters in a string
   */
  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Clean up whitespace after token removal
   */
  private cleanWhitespace(text: string): string {
    return text
      .replace(/\s+/g, ' ') // Collapse multiple spaces
      .replace(/\s*,\s*,/g, ',') // Fix double commas
      .replace(/,\s*$/g, '') // Remove trailing comma
      .replace(/^\s*,/g, '') // Remove leading comma
      .replace(/\s*,/g, ',') // Fix space before comma
      .replace(/,\s*/g, ', ') // Normalize comma spacing
      .trim();
  }
}

/**
 * Singleton instance for convenience
 */
export const techStripper = new TechStripper();
