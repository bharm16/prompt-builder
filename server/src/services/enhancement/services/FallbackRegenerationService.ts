import { logger } from '@infrastructure/Logger';
import { StructuredOutputEnforcer } from '@utils/StructuredOutputEnforcer';
import type {
  Suggestion,
  VideoService,
  AIService,
  FallbackRegenerationParams,
  FallbackRegenerationResult,
  PromptBuildParams,
  VideoConstraints,
  OutputSchema,
} from './types.js';

/**
 * Interface for prompt builder
 */
interface PromptBuilder {
  buildRewritePrompt(params: PromptBuildParams): string;
}

/**
 * Interface for validation service
 */
interface ValidationService {
  sanitizeSuggestions(suggestions: Suggestion[], context: {
    highlightedText?: string;
    isPlaceholder?: boolean;
    isVideoPrompt?: boolean;
    videoConstraints?: VideoConstraints;
  }): Suggestion[];
}

/**
 * Interface for diversity enforcer
 */
interface DiversityEnforcer {
  ensureDiverseSuggestions(suggestions: Suggestion[]): Promise<Suggestion[]>;
}

/**
 * Service responsible for fallback regeneration when initial suggestions fail validation
 * Implements iterative fallback strategy for video prompts
 */
export class FallbackRegenerationService {
  constructor(
    private readonly videoService: VideoService,
    private readonly promptBuilder: PromptBuilder,
    private readonly validationService: ValidationService,
    private readonly diversityEnforcer: DiversityEnforcer
  ) {}

  /**
   * Attempt fallback regeneration with different constraint modes
   * @param params - Regeneration parameters
   * @returns Regeneration result with suggestions and metadata
   */
  async attemptFallbackRegeneration(params: FallbackRegenerationParams): Promise<FallbackRegenerationResult> {
    const {
      sanitizedSuggestions,
      isVideoPrompt,
      isPlaceholder,
      videoConstraints,
      lockedSpanCategories,
      regenerationDetails,
      requestParams,
      aiService,
      schema,
      temperature,
    } = params;

    // Early return if we have valid suggestions or this isn't a video prompt
    if (sanitizedSuggestions.length > 0 || !isVideoPrompt) {
      const result: FallbackRegenerationResult = {
        suggestions: sanitizedSuggestions,
        usedFallback: false,
        sourceCount: 0,
      };
      if (videoConstraints) {
        result.constraints = videoConstraints;
      }
      return result;
    }
    
    // For placeholders: only skip fallback if we actually have suggestions
    // If placeholder generation failed (0 suggestions), allow fallback to try
    if (isPlaceholder && sanitizedSuggestions.length > 0) {
      const result: FallbackRegenerationResult = {
        suggestions: sanitizedSuggestions,
        usedFallback: false,
        sourceCount: 0,
      };
      if (videoConstraints) {
        result.constraints = videoConstraints;
      }
      return result;
    }

    logger.warn('All suggestions removed during sanitization', {
      highlightWordCount: regenerationDetails.highlightWordCount,
      phraseRole: regenerationDetails.phraseRole ?? null,
      constraintMode: videoConstraints?.mode ?? null,
    });

    // Initialize fallback state
    const attemptedModes = new Set<string>();
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
          aiService,
          schema,
          temperature,
          isPlaceholder,
          isVideoPrompt,
          ...(lockedSpanCategories !== undefined ? { lockedSpanCategories } : {}),
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
          error: error instanceof Error ? error.message : String(error),
        });
      }

      // Move to next fallback
      attemptedModes.add(fallbackConstraints.mode || '');
      currentConstraints = fallbackConstraints;
      fallbackConstraints = this.videoService.getVideoFallbackConstraints(
        currentConstraints,
        regenerationDetails,
        attemptedModes
      );
    }

    // No successful fallback found
    const result: FallbackRegenerationResult = {
      suggestions: [],
      usedFallback: false,
      sourceCount: 0,
    };
    if (videoConstraints) {
      result.constraints = videoConstraints;
    }
    return result;
  }

  /**
   * Attempt a single fallback regeneration
   * @private
   */
  private async _attemptSingleFallback({
    fallbackConstraints,
    requestParams,
    aiService,
    schema,
    temperature,
    isPlaceholder,
    isVideoPrompt,
    lockedSpanCategories,
  }: {
    fallbackConstraints: VideoConstraints;
    requestParams: PromptBuildParams;
    aiService: AIService;
    schema: OutputSchema;
    temperature: number;
    isPlaceholder: boolean;
    isVideoPrompt: boolean;
    lockedSpanCategories?: string[];
  }): Promise<FallbackRegenerationResult> {
    // Build fallback prompt
    const fallbackPrompt = this.promptBuilder.buildRewritePrompt({
      ...requestParams,
      videoConstraints: fallbackConstraints,
    });

    // Generate suggestions using aiService
    const fallbackSuggestions = await StructuredOutputEnforcer.enforceJSON(
      aiService,
      fallbackPrompt,
      {
        operation: 'enhance_fallback',
        schema,
        isArray: true,
        maxTokens: 2048,
        maxRetries: 1,
        temperature,
      }
    ) as Suggestion[];

    // Process suggestions
    const fallbackDiverse = await this.diversityEnforcer.ensureDiverseSuggestions(
      fallbackSuggestions
    );
    
    // Build sanitization context, only including defined values
    const sanitizationContext: {
      highlightedText?: string;
      isPlaceholder?: boolean;
      isVideoPrompt?: boolean;
      videoConstraints?: VideoConstraints;
      highlightedCategory?: string | null;
      lockedSpanCategories?: string[];
    } = {
      isPlaceholder,
      isVideoPrompt,
      videoConstraints: fallbackConstraints,
    };
    if (requestParams.highlightedText !== undefined) {
      sanitizationContext.highlightedText = requestParams.highlightedText;
    }
    if (requestParams.highlightedCategory !== undefined) {
      sanitizationContext.highlightedCategory = requestParams.highlightedCategory;
    }
    if (lockedSpanCategories && lockedSpanCategories.length > 0) {
      sanitizationContext.lockedSpanCategories = lockedSpanCategories;
    }
    
    const fallbackSanitized = this.validationService.sanitizeSuggestions(
      fallbackDiverse,
      sanitizationContext
    );

    return {
      suggestions: fallbackSanitized,
      constraints: fallbackConstraints,
      usedFallback: fallbackSanitized.length > 0,
      sourceCount: Array.isArray(fallbackSuggestions) ? fallbackSuggestions.length : 0,
      rawCount: Array.isArray(fallbackSuggestions) ? fallbackSuggestions.length : 0,
    };
  }
}
