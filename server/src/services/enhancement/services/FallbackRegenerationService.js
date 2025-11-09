import { logger } from '../../../infrastructure/Logger.js';
import { StructuredOutputEnforcer } from '../../../utils/StructuredOutputEnforcer.js';

/**
 * Service responsible for fallback regeneration when initial suggestions fail validation
 * Implements iterative fallback strategy for video prompts
 */
export class FallbackRegenerationService {
  constructor(videoService, promptBuilder, validationService, diversityEnforcer) {
    this.videoService = videoService;
    this.promptBuilder = promptBuilder;
    this.validationService = validationService;
    this.diversityEnforcer = diversityEnforcer;
  }

  /**
   * Attempt fallback regeneration with different constraint modes
   * @param {Object} params - Regeneration parameters
   * @returns {Promise<Object>} Regeneration result with suggestions and metadata
   */
  async attemptFallbackRegeneration({
    sanitizedSuggestions,
    isVideoPrompt,
    isPlaceholder,
    videoConstraints,
    regenerationDetails,
    requestParams,
    claudeClient,
    groqClient,
    schema,
    temperature,
  }) {
    // Early return if not applicable
    if (sanitizedSuggestions.length > 0 || !isVideoPrompt || isPlaceholder) {
      return {
        suggestions: sanitizedSuggestions,
        constraints: videoConstraints,
        usedFallback: false,
        sourceCount: 0,
      };
    }

    logger.warn('All suggestions removed during sanitization', {
      highlightWordCount: regenerationDetails.highlightWordCount,
      phraseRole: regenerationDetails.phraseRole,
      constraintMode: videoConstraints?.mode || null,
    });

    // Initialize fallback state
    const attemptedModes = new Set();
    if (videoConstraints?.mode) {
      attemptedModes.add(videoConstraints.mode);
    }

    let currentConstraints = videoConstraints;
    let fallbackConstraints = this.videoService.getVideoFallbackConstraints(
      currentConstraints,
      regenerationDetails,
      attemptedModes
    );

    // Iterative fallback loop
    while (fallbackConstraints) {
      try {
        // Try regeneration with fallback constraints
        const result = await this._attemptSingleFallback({
          fallbackConstraints,
          requestParams,
          claudeClient,
          groqClient,
          schema,
          temperature,
          isPlaceholder,
          isVideoPrompt,
        });

        if (result.suggestions.length > 0) {
          return result;
        }

        // Log unsuccessful attempt
        logger.warn('Fallback attempt yielded no compliant suggestions', {
          modeTried: fallbackConstraints.mode,
          generatedCount: result.rawCount,
          sanitizedCount: result.suggestions.length,
        });
      } catch (error) {
        logger.warn('Fallback regeneration failed', {
          mode: fallbackConstraints.mode,
          error: error.message,
        });
      }

      // Move to next fallback
      attemptedModes.add(fallbackConstraints.mode);
      currentConstraints = fallbackConstraints;
      fallbackConstraints = this.videoService.getVideoFallbackConstraints(
        currentConstraints,
        regenerationDetails,
        attemptedModes
      );
    }

    // No successful fallback found
    return {
      suggestions: [],
      constraints: videoConstraints,
      usedFallback: false,
      sourceCount: 0,
    };
  }

  /**
   * Attempt a single fallback regeneration
   * @private
   */
  async _attemptSingleFallback({
    fallbackConstraints,
    requestParams,
    claudeClient,
    groqClient,
    schema,
    temperature,
    isPlaceholder,
    isVideoPrompt,
  }) {
    // Build fallback prompt
    const fallbackPrompt = this.promptBuilder.buildRewritePrompt({
      ...requestParams,
      videoConstraints: fallbackConstraints,
    });

    // Generate suggestions
    const fallbackSuggestions = await StructuredOutputEnforcer.enforceJSON(
      groqClient || claudeClient,
      fallbackPrompt,
      {
        schema,
        isArray: true,
        maxTokens: 2048,
        maxRetries: 1,
        temperature,
      }
    );

    // Process suggestions
    const fallbackDiverse = await this.diversityEnforcer.ensureDiverseSuggestions(
      fallbackSuggestions
    );
    const fallbackSanitized = this.validationService.sanitizeSuggestions(fallbackDiverse, {
      highlightedText: requestParams.highlightedText,
      isPlaceholder,
      isVideoPrompt,
      videoConstraints: fallbackConstraints,
    });

    return {
      suggestions: fallbackSanitized,
      constraints: fallbackConstraints,
      usedFallback: fallbackSanitized.length > 0,
      sourceCount: Array.isArray(fallbackSuggestions) ? fallbackSuggestions.length : 0,
      rawCount: Array.isArray(fallbackSuggestions) ? fallbackSuggestions.length : 0,
    };
  }
}

