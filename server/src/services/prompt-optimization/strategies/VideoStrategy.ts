import { logger } from '@infrastructure/Logger';
import OptimizationConfig from '@config/OptimizationConfig';
import { ModelConfig } from '@config/modelConfig';
// Import the examples along with the generator
import { generateUniversalVideoPrompt, generateUniversalVideoPromptWithLockedSpans, VIDEO_FEW_SHOT_EXAMPLES } from './videoPromptOptimizationTemplate';
import { StructuredOutputEnforcer } from '@utils/StructuredOutputEnforcer';
import { getVideoTemplateBuilder } from './video-templates/index';
import { getVideoOptimizationSchema } from '@utils/provider/SchemaFactory';
import { detectProvider } from '@utils/provider/ProviderDetector';
import type { CapabilityValues } from '@shared/capabilities';
import type { AIService, TemplateService, OptimizationRequest, ShotPlan, OptimizationStrategy } from '../types';
import type { VideoPromptStructuredResponse } from './videoPromptTypes';
import { lintVideoPromptSlots } from './videoPromptLinter';
import { renderAlternativeApproaches, renderMainVideoPrompt, renderPreviewPrompt } from './videoPromptRenderer';
import { buildStreamingPrompt } from './video/prompts/buildStreamingPrompt';
import { normalizeSlots } from './video/slots/normalizeSlots';
import { rerollSlots } from './video/slots/rerollSlots';

function isCriticalVideoPromptLintError(error: string): boolean {
  return (
    /Missing `shot_framing`/i.test(error) ||
    /`shot_framing` looks like an angle/i.test(error) ||
    /Missing `camera_angle`/i.test(error) ||
    /If `subject` is null, `subject_details` must be null/i.test(error)
  );
}

/**
 * Strategy for optimizing video generation prompts
 * Uses specialized video prompt template with Chain-of-Thought reasoning
 * Returns structured JSON internally but assembles to text for backward compatibility
 */
export class VideoStrategy implements OptimizationStrategy {
  readonly name = 'video';
  private readonly ai: AIService;
  private readonly templateService: TemplateService;

  constructor(aiService: AIService, templateService: TemplateService) {
    this.ai = aiService;
    this.templateService = templateService;
  }

  private _hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash |= 0;
    }
    return Math.abs(hash);
  }

  /**
   * Optimize prompt for video generation
   *
   * Provider-Aware Optimization (NEW):
   * - Detects provider (OpenAI vs Groq)
   * - Uses provider-specific template builder
   * - OpenAI: developerMessage + strict schema (~1,300 tokens)
   * - Groq: embedded instructions + sandwich prompting (~2,000 tokens)
   *
   * Uses progressive enhancement: attempts native Structured Outputs first,
   * falls back to StructuredOutputEnforcer for unsupported providers
   * Uses Few-Shot Prompting to prevent structural arrows in output
   */
  async optimize({
    prompt,
    shotPlan = null,
    generationParams = null,
    lockedSpans = [],
    signal,
    onMetadata,
    onChunk,
  }: OptimizationRequest): Promise<string> {
    logger.info('Optimizing prompt with video strategy (Provider-Aware + Strict Schema + Few-Shot)');
    const config = this.getConfig();
    const optimizeConfig = ModelConfig.optimize_standard;
    if (!optimizeConfig) {
      throw new Error('Missing optimize_standard model configuration');
    }

    // Detect provider for this operation
    const provider = detectProvider({
      operation: 'optimize_standard',
      client: optimizeConfig.client,
      model: optimizeConfig.model,
    });

    logger.debug('Provider detected for video optimization', { provider });

    if (
      onChunk &&
      this.ai.stream &&
      (this.ai.supportsStreaming?.('optimize_standard') ?? true)
    ) {
      const streamingPrompt = buildStreamingPrompt({
        prompt,
        shotPlan,
        lockedSpans,
        generationParams,
      });

      return await this.ai.stream('optimize_standard', {
        systemPrompt: streamingPrompt.systemPrompt,
        userMessage: streamingPrompt.userMessage,
        maxTokens: config.maxTokens,
        temperature: config.temperature,
        timeout: config.timeout,
        onChunk,
        ...(signal ? { signal } : {}),
      });
    }

    // Strategy 1: Attempt Native Strict Structured Outputs (Best Quality)
    try {
      // Get provider-specific template builder
      const templateBuilder = getVideoTemplateBuilder({
        operation: 'optimize_standard',
        client: provider,
        ...(lockedSpans && lockedSpans.length > 0 ? { lockedSpans } : {}),
      });

      // Build provider-optimized template
      const template = templateBuilder.buildTemplate({
        userConcept: prompt,
        ...(shotPlan ? { interpretedPlan: shotPlan as unknown as Record<string, unknown> } : {}),
        ...(lockedSpans && lockedSpans.length > 0 ? { lockedSpans } : {}),
        includeInstructions: true,
        ...(generationParams ? { generationParams } : {}),
      });

      // Get provider-specific schema
      const schema = getVideoOptimizationSchema({
        operation: 'optimize_standard',
        provider,
        model: optimizeConfig.model,
      });

      logger.debug('Using provider-specific template', {
        provider: template.provider,
        hasDeveloperMessage: !!template.developerMessage,
        systemPromptLength: template.systemPrompt.length,
      });

      // Build the Message Chain (The Structured Way)
      // We explicitly teach the model: Rules -> Example Input -> Example Output -> Real Input
      const messages = [
        { role: 'system', content: template.systemPrompt },
        ...VIDEO_FEW_SHOT_EXAMPLES, // <--- Inject the "training" examples
        { role: 'user', content: template.userMessage }
      ];

      logger.debug('Attempting Native Strict Schema generation with Few-Shot examples');

      // Call AI with provider-specific optimizations
      const response = await this.ai.execute('optimize_standard', {
        systemPrompt: template.systemPrompt, // Required by API
        messages: messages, // <--- Pass the full chain here
        schema: schema,
        ...(template.developerMessage ? { developerMessage: template.developerMessage } : {}), // OpenAI only
        maxTokens: config.maxTokens,
        temperature: config.temperature,
        timeout: config.timeout,
        ...(signal ? { signal } : {}),
      });

      const parsedResponse = JSON.parse(response.text) as VideoPromptStructuredResponse;
      const normalizedSlots = normalizeSlots(parsedResponse);

      const lint = lintVideoPromptSlots(normalizedSlots);
      if (!lint.ok) {
        const criticalErrors = lint.errors.filter(isCriticalVideoPromptLintError);
        if (criticalErrors.length === 0) {
          logger.warn('Video prompt slot lint has non-critical issues (skipping repair)', {
            errors: lint.errors,
            provider,
          });
          return this._reassembleOutput({ ...parsedResponse, ...normalizedSlots }, onMetadata, generationParams);
        }

        logger.warn('Video prompt slot lint failed (repairing critical issues)', {
          errors: lint.errors,
          criticalErrors,
          provider,
        });

      const rerolled = await rerollSlots({
        ai: this.ai,
        templateSystemPrompt: template.systemPrompt,
        schema,
        messages,
        config,
        baseSeed: this._hashString(prompt),
        attempts: 2,
        ...(template.developerMessage ? { developerMessage: template.developerMessage } : {}),
        ...(signal ? { signal } : {}),
      });
        if (rerolled) {
          logger.info('Video prompt lint fixed via reroll', { provider });
          return this._reassembleOutput(rerolled, onMetadata, generationParams);
        }

      const repaired = await this._repairSlots({
        templateSystemPrompt: template.systemPrompt,
        schema,
        userMessage: template.userMessage,
        originalJson: parsedResponse,
        lintErrors: lint.errors,
        config,
        ...(template.developerMessage ? { developerMessage: template.developerMessage } : {}),
        ...(signal ? { signal } : {}),
      });

        return this._reassembleOutput(repaired, onMetadata, generationParams);
      }

      logger.info('Video optimization complete with native structured outputs', {
        originalLength: prompt.length,
        shotFraming: normalizedSlots.shot_framing,
        strategy: parsedResponse._creative_strategy,
        provider,
        usedDeveloperMessage: !!template.developerMessage,
      });

      return this._reassembleOutput({ ...parsedResponse, ...normalizedSlots }, onMetadata, generationParams);

    } catch (error) {
      // Strategy 2: Fallback to StructuredOutputEnforcer (Robustness)
      logger.warn('Native Strict Mode failed, falling back to Enforcer', {
        error: (error as Error).message
      });

      return this._fallbackOptimization(
        prompt,
        shotPlan as ShotPlan | null,
        lockedSpans,
        config,
        generationParams,
        signal,
        onMetadata
      );
    }
  }

  /**
   * Fallback method using StructuredOutputEnforcer for unsupported providers
   */
  private async _fallbackOptimization(
    prompt: string,
    shotPlan: ShotPlan | null,
    lockedSpans: Array<{ text: string; leftCtx?: string | null; rightCtx?: string | null }>,
    config: { maxTokens: number; temperature: number; timeout: number },
    generationParams?: CapabilityValues | null,
    signal?: AbortSignal,
    onMetadata?: (metadata: Record<string, unknown>) => void
  ): Promise<string> {
    // Generate full system prompt (legacy format)
    const normalizedShotPlan = shotPlan ? (shotPlan as unknown as Record<string, unknown>) : null;
    const systemPrompt =
      lockedSpans && lockedSpans.length > 0
        ? generateUniversalVideoPromptWithLockedSpans(prompt, normalizedShotPlan, lockedSpans)
        : generateUniversalVideoPrompt(prompt, normalizedShotPlan);

    // Simpler schema for non-strict fallback
    const looseSchema = {
      type: 'object' as const,
      required: ['_creative_strategy', 'shot_framing', 'camera_angle', 'camera_move', 'subject', 'subject_details', 'action', 'setting', 'time', 'lighting', 'style', 'technical_specs'],
    };

    const parsedResponse = await StructuredOutputEnforcer.enforceJSON(
      this.ai,
      systemPrompt,
      {
        operation: 'optimize_standard',
        schema: looseSchema,
        isArray: false,
        maxRetries: 2,
        maxTokens: config.maxTokens,
        temperature: config.temperature,
        timeout: config.timeout,
        ...(signal ? { signal } : {}),
      }
    ) as VideoPromptStructuredResponse;

    const normalizedSlots = normalizeSlots(parsedResponse);
    const lint = lintVideoPromptSlots(normalizedSlots);

    logger.info('Video optimization complete with fallback enforcer', {
      originalLength: prompt.length,
      shotFraming: normalizedSlots.shot_framing,
      strategy: parsedResponse._creative_strategy,
      lintOk: lint.ok,
    });

    // Fallback path: if lint fails, proceed with best-effort normalized slots (avoid a second model call here)
    return this._reassembleOutput({ ...parsedResponse, ...normalizedSlots }, onMetadata, generationParams);
  }

  /**
   * Reassemble structured JSON into text format for backward compatibility
   */
  private _reassembleOutput(
    parsed: VideoPromptStructuredResponse,
    onMetadata?: (metadata: Record<string, unknown>) => void,
    generationParams?: CapabilityValues | null
  ): string {
    const resolved = this.applyGenerationParams(parsed, generationParams);
    const slots = normalizeSlots(resolved);
    const promptParagraph = renderMainVideoPrompt(slots);
    const previewPrompt = renderPreviewPrompt(slots);
    const aspectRatio =
      typeof resolved.technical_specs?.aspect_ratio === 'string'
        ? resolved.technical_specs.aspect_ratio.trim()
        : '';

    if (onMetadata) {
      onMetadata({
        previewPrompt,
        ...(aspectRatio ? { aspectRatio } : {}),
      });
    }

    let output = promptParagraph;

    // Add technical specs section with merged creative and output specs (aligned with research template)
    if (resolved.technical_specs) {
      output += '\n\n**TECHNICAL SPECS**';

      // Output specs (generator-facing)
      output += `\n- **Duration:** ${resolved.technical_specs.duration || '4-8s'}`;
      output += `\n- **Aspect Ratio:** ${resolved.technical_specs.aspect_ratio || '16:9'}`;
      if (resolved.technical_specs.resolution) {
        output += `\n- **Resolution:** ${resolved.technical_specs.resolution}`;
      }
      output += `\n- **Frame Rate:** ${resolved.technical_specs.frame_rate || '24fps'}`;
      output += `\n- **Audio:** ${resolved.technical_specs.audio || 'mute'}`;

      // Creative specs (used in prompt generation)
      if (resolved.technical_specs.camera) {
        output += `\n- **Camera:** ${resolved.technical_specs.camera}`;
      }
      if (resolved.technical_specs.lighting) {
        output += `\n- **Lighting:** ${resolved.technical_specs.lighting}`;
      }
      if (resolved.technical_specs.style) {
        output += `\n- **Style:** ${resolved.technical_specs.style}`;
      }
    }

    // Add variations section
    const variations =
      parsed.variations && Array.isArray(parsed.variations) && parsed.variations.length > 0
        ? parsed.variations
        : renderAlternativeApproaches(slots);

    if (variations.length > 0) {
      output += '\n\n**ALTERNATIVE APPROACHES**';
      variations.forEach((variation, index) => {
        const varNum = index + 1;
        output += `\n- **Variation ${varNum} (${variation.label}):** ${variation.prompt}`;
      });
    }

    return output;
  }

  private applyGenerationParams(
    parsed: VideoPromptStructuredResponse,
    generationParams?: CapabilityValues | null
  ): VideoPromptStructuredResponse {
    if (!generationParams) {
      return parsed;
    }

    const technicalSpecs = { ...(parsed.technical_specs || {}) };

    const aspectRatio = generationParams.aspect_ratio;
    if (typeof aspectRatio === 'string' && aspectRatio.trim()) {
      technicalSpecs.aspect_ratio = aspectRatio.trim();
    }

    const durationSeconds = generationParams.duration_s;
    if (typeof durationSeconds === 'number' && Number.isFinite(durationSeconds)) {
      technicalSpecs.duration = `${durationSeconds}s`;
    }

    const fps = generationParams.fps;
    if (typeof fps === 'number' && Number.isFinite(fps)) {
      technicalSpecs.frame_rate = `${fps}fps`;
    }

    const resolution = generationParams.resolution;
    if (typeof resolution === 'string' && resolution.trim()) {
      technicalSpecs.resolution = resolution.trim();
    }

    const audio = generationParams.audio;
    if (typeof audio === 'boolean') {
      technicalSpecs.audio = audio ? 'enabled' : 'mute';
    }

    return {
      ...parsed,
      technical_specs: technicalSpecs,
    };
  }

  private async _repairSlots(options: {
    templateSystemPrompt: string;
    developerMessage?: string;
    schema: Record<string, unknown>;
    userMessage: string;
    originalJson: VideoPromptStructuredResponse;
    lintErrors: string[];
    config: { maxTokens: number; temperature: number; timeout: number };
    signal?: AbortSignal;
  }): Promise<VideoPromptStructuredResponse> {
    const repairSystemPrompt =
      'You are a strict JSON repair assistant for video prompt slot output. Fix the JSON fields to satisfy the lint errors. Return ONLY valid JSON that matches the provided schema. Do not add any prose.';

    const repairUserMessage = `${options.userMessage}

<lint_errors>
${options.lintErrors.map((e) => `- ${e}`).join('\n')}
</lint_errors>

<original_json>
${JSON.stringify(options.originalJson, null, 2)}
</original_json>`;

    const response = await this.ai.execute('optimize_standard', {
      systemPrompt: repairSystemPrompt,
      userMessage: repairUserMessage,
      schema: options.schema,
      ...(options.developerMessage ? { developerMessage: options.developerMessage } : {}),
      maxTokens: options.config.maxTokens,
      temperature: 0.2,
      timeout: options.config.timeout,
      ...(options.signal ? { signal: options.signal } : {}),
    });

    const repaired = JSON.parse(response.text) as VideoPromptStructuredResponse;
    const normalizedSlots = normalizeSlots(repaired);
    return { ...repaired, ...normalizedSlots };
  }

  /**
   * Video mode does not generate domain content
   */
  async generateDomainContent(): Promise<null> {
    return null;
  }

  /**
   * Get configuration for video strategy
   */
  getConfig(): { maxTokens: number; temperature: number; timeout: number } {
    return {
      maxTokens: OptimizationConfig.tokens.optimization.video,
      temperature: OptimizationConfig.temperatures.optimization.video,
      timeout: OptimizationConfig.timeouts.optimization.video,
    };
  }
}

export default VideoStrategy;
