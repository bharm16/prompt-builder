/**
 * TechStripper Utility
 *
 * Removes tokens that degrade model performance in two tiers:
 * 1. Universal: camera spec tokens (f-stop, ISO) stripped for ALL models
 * 2. Model-aware: placebo quality tokens stripped for Runway/Luma, kept for Kling/Veo
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
 * Camera specification patterns universally ignored by ALL video generation models.
 * No diffusion or transformer video model uses aperture, ISO, or sensor-size values.
 * Each entry creates a fresh RegExp per call to avoid global-regex lastIndex issues.
 */
const CAMERA_SPEC_PATTERNS: readonly { label: string; source: string; flags: string }[] = [
  // f-stop values: f/1.8, f/2.8, (f/1.8-f/2.8), f / 2.8
  { label: 'f-stop', source: '\\(?\\s*f\\s*\\/\\s*\\d+(?:\\.\\d+)?(?:\\s*[-\\u2013]\\s*f\\s*\\/\\s*\\d+(?:\\.\\d+)?)?\\s*\\)?', flags: 'gi' },
  // ISO values: ISO 800, ISO3200
  { label: 'ISO', source: '\\bISO\\s*\\d+', flags: 'gi' },
];

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
 * TechStripper removes tokens that degrade model performance
 *
 * Two-tier stripping:
 * - Universal: camera specs (f-stop, ISO) are always stripped — no video model uses them
 * - Model-aware: placebo quality tokens (4k, masterpiece) stripped for Runway/Luma, kept for Kling/Veo
 */
export class TechStripper {
  /**
   * Process text to strip technical and placebo tokens
   *
   * @param text - Input text to process
   * @param modelId - Target model identifier (e.g., "runway-gen45", "kling-26")
   * @returns Processed result with text and metadata
   */
  strip(text: string, modelId: string): TechStripperResult {
    const strippedTokens: string[] = [];
    let processedText = text;

    // Tier 1: Universal — strip camera specs (all video models ignore these)
    for (const { label, source, flags } of CAMERA_SPEC_PATTERNS) {
      const pattern = new RegExp(source, flags);
      const before = processedText;
      processedText = processedText.replace(pattern, '');
      if (processedText !== before) {
        strippedTokens.push(label);
      }
    }

    // Tier 2: Model-aware — strip placebo tokens for models that don't benefit
    const shouldStrip = this.shouldStripTokens(modelId);
    if (shouldStrip) {
      for (const token of PLACEBO_TOKENS) {
        const regex = new RegExp(`\\b${this.escapeRegex(token)}\\b`, 'gi');
        const matches = processedText.match(regex);

        if (matches) {
          strippedTokens.push(...matches.map((m) => m.toLowerCase()));
          processedText = processedText.replace(regex, '');
        }
      }
    }

    if (strippedTokens.length === 0) {
      return { text, strippedTokens: [], tokensWereStripped: false };
    }

    // Clean up extra whitespace from removals
    processedText = this.cleanWhitespace(processedText);

    return {
      text: processedText,
      strippedTokens: [...new Set(strippedTokens)], // Deduplicate
      tokensWereStripped: true,
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
