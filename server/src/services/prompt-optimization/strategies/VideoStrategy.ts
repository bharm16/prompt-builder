import { logger } from '@infrastructure/Logger.js';
import OptimizationConfig from '@config/OptimizationConfig.js';
import { ModelConfig } from '@config/modelConfig.js';
// Import the examples along with the generator
import { generateUniversalVideoPrompt, VIDEO_FEW_SHOT_EXAMPLES } from './videoPromptOptimizationTemplate.js';
import { StructuredOutputEnforcer } from '@utils/StructuredOutputEnforcer.js';
import { getVideoTemplateBuilder } from './video-templates/index.js';
import { getVideoOptimizationSchema } from '@utils/provider/SchemaFactory.js';
import { detectProvider } from '@utils/provider/ProviderDetector.js';
import type { AIService, TemplateService, OptimizationRequest, ShotPlan } from '../types.js';
import type { VideoPromptStructuredResponse, VideoPromptSlots } from './videoPromptTypes.js';
import { lintVideoPromptSlots } from './videoPromptLinter.js';
import { renderAlternativeApproaches, renderMainVideoPrompt } from './videoPromptRenderer.js';

function normalizeSlots(raw: Partial<VideoPromptSlots>): VideoPromptSlots {
  const normalizeStringOrNull = (value: unknown): string | null => {
    if (value === null || typeof value === 'undefined') return null;
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  };

  const normalizeString = (value: unknown, fallback: string): string => {
    const normalized = normalizeStringOrNull(value);
    return normalized ?? fallback;
  };

  const normalizeStringArrayOrNull = (value: unknown): string[] | null => {
    if (value === null || typeof value === 'undefined') return null;
    if (!Array.isArray(value)) return null;
    const rawItems = value.filter((item) => typeof item === 'string') as string[];

    // Expand comma-separated details (e.g., "red coat, blonde hair") into separate items.
    const expanded = rawItems.flatMap((item) =>
      item
        .split(',')
        .map((part) => part.trim())
        .filter(Boolean)
    );

    // De-duplicate while preserving order
    const seen = new Set<string>();
    const deduped: string[] = [];
    for (const item of expanded) {
      const key = item.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      deduped.push(item);
    }

    const cleaned = deduped.slice(0, 3);
    return cleaned.length > 0 ? cleaned : null;
  };

  const subject = normalizeStringOrNull(raw.subject);
  let subjectDetails = subject ? normalizeStringArrayOrNull(raw.subject_details) : null;

  // Drop generic filler details.
  if (subjectDetails) {
    const generic = new Set(['main subject', 'subject', 'the subject', 'person']);
    subjectDetails = subjectDetails.filter((d) => !generic.has(d.trim().toLowerCase()));
    if (subjectDetails.length === 0) subjectDetails = null;
  }

  let action = normalizeStringOrNull(raw.action);

  // If the model mistakenly put an action into `subject_details`, salvage it without another model call.
  if (subject && subjectDetails) {
    const looksLikeActionDetail = (detail: string): boolean => {
      const firstToken = detail.trim().split(/\s+/)[0]?.toLowerCase() || '';
      if (!firstToken.endsWith('ing')) return false;
      // Allow clothing/appearance phrasing to remain as a subject detail.
      if (firstToken === 'wearing' || firstToken === 'dressed') return false;
      return true;
    };

    const actionLikeIndices = subjectDetails
      .map((detail, idx) => (looksLikeActionDetail(detail) ? idx : -1))
      .filter((idx) => idx >= 0);

    // If an action-like detail was placed into `subject_details`, move it into `action` to preserve slot semantics.
    if (!action && actionLikeIndices.length > 0) {
      const idx = actionLikeIndices[0]!;
      action = subjectDetails[idx] || null;
      subjectDetails = subjectDetails.filter((_, i) => i !== idx);
    }

    // If we now have an action, remove remaining action-like items from subject details.
    if (action && subjectDetails) {
      subjectDetails = subjectDetails.filter((d) => !looksLikeActionDetail(d));
    }

    if (subjectDetails && subjectDetails.length === 0) subjectDetails = null;
  }

  return {
    shot_framing: normalizeString(raw.shot_framing, 'Wide Shot'),
    camera_angle: normalizeString(raw.camera_angle, 'Eye-Level Shot'),
    camera_move: normalizeStringOrNull(raw.camera_move),
    subject,
    subject_details: subjectDetails,
    action,
    setting: normalizeStringOrNull(raw.setting),
    time: normalizeStringOrNull(raw.time),
    lighting: normalizeStringOrNull(raw.lighting),
    style: normalizeStringOrNull(raw.style),
  };
}

/**
 * Strategy for optimizing video generation prompts
 * Uses specialized video prompt template with Chain-of-Thought reasoning
 * Returns structured JSON internally but assembles to text for backward compatibility
 */
export class VideoStrategy implements import('../types.js').OptimizationStrategy {
  readonly name = 'video';
  private readonly ai: AIService;
  private readonly templateService: TemplateService;

  constructor(aiService: AIService, templateService: TemplateService) {
    this.ai = aiService;
    this.templateService = templateService;
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
  async optimize({ prompt, shotPlan = null }: OptimizationRequest): Promise<string> {
    logger.info('Optimizing prompt with video strategy (Provider-Aware + Strict Schema + Few-Shot)');
    const config = this.getConfig();

    // Detect provider for this operation
    const provider = detectProvider({
      operation: 'optimize_standard',
      client: ModelConfig.optimize_standard.client,
      model: ModelConfig.optimize_standard.model,
    });

    logger.debug('Provider detected for video optimization', { provider });

    // Strategy 1: Attempt Native Strict Structured Outputs (Best Quality)
    try {
      // Get provider-specific template builder
      const templateBuilder = getVideoTemplateBuilder({
        operation: 'optimize_standard',
        client: provider,
      });

      // Build provider-optimized template
      const template = templateBuilder.buildTemplate({
        userConcept: prompt,
        interpretedPlan: shotPlan || undefined,
        includeInstructions: true,
      });

      // Get provider-specific schema
      const schema = getVideoOptimizationSchema({
        operation: 'optimize_standard',
        provider,
        model: ModelConfig.optimize_standard.model,
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
        developerMessage: template.developerMessage, // OpenAI only
        maxTokens: config.maxTokens,
        temperature: config.temperature,
        timeout: config.timeout,
      });

      const parsedResponse = JSON.parse(response.text) as VideoPromptStructuredResponse;
      const normalizedSlots = normalizeSlots(parsedResponse);

      const lint = lintVideoPromptSlots(normalizedSlots);
      if (!lint.ok) {
        logger.warn('Video prompt slot lint failed (repairing)', {
          errors: lint.errors,
          provider,
        });

        const repaired = await this._repairSlots({
          templateSystemPrompt: template.systemPrompt,
          developerMessage: template.developerMessage,
          schema,
          userMessage: template.userMessage,
          originalJson: parsedResponse,
          lintErrors: lint.errors,
          config,
        });

        return this._reassembleOutput(repaired);
      }

      logger.info('Video optimization complete with native structured outputs', {
        originalLength: prompt.length,
        shotFraming: normalizedSlots.shot_framing,
        strategy: parsedResponse._creative_strategy,
        provider,
        usedDeveloperMessage: !!template.developerMessage,
      });

      return this._reassembleOutput({ ...parsedResponse, ...normalizedSlots });

    } catch (error) {
      // Strategy 2: Fallback to StructuredOutputEnforcer (Robustness)
      logger.warn('Native Strict Mode failed, falling back to Enforcer', {
        error: (error as Error).message
      });

      return this._fallbackOptimization(prompt, shotPlan as ShotPlan | null, config);
    }
  }

  /**
   * Fallback method using StructuredOutputEnforcer for unsupported providers
   */
  private async _fallbackOptimization(
    prompt: string,
    shotPlan: ShotPlan | null,
    config: { maxTokens: number; temperature: number; timeout: number }
  ): Promise<string> {
    // Generate full system prompt (legacy format)
    const systemPrompt = generateUniversalVideoPrompt(prompt, shotPlan);

    // Simpler schema for non-strict fallback
    const looseSchema = {
      type: 'object',
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
    return this._reassembleOutput({ ...parsedResponse, ...normalizedSlots });
  }

  /**
   * Reassemble structured JSON into text format for backward compatibility
   */
  private _reassembleOutput(parsed: VideoPromptStructuredResponse): string {
    const slots = normalizeSlots(parsed);
    const promptParagraph = renderMainVideoPrompt(slots);

    let output = promptParagraph;

    // Add technical specs section with merged creative and output specs (aligned with research template)
    if (parsed.technical_specs) {
      output += '\n\n**TECHNICAL SPECS**';

      // Output specs (generator-facing)
      output += `\n- **Duration:** ${parsed.technical_specs.duration || '4-8s'}`;
      output += `\n- **Aspect Ratio:** ${parsed.technical_specs.aspect_ratio || '16:9'}`;
      output += `\n- **Frame Rate:** ${parsed.technical_specs.frame_rate || '24fps'}`;
      output += `\n- **Audio:** ${parsed.technical_specs.audio || 'mute'}`;

      // Creative specs (used in prompt generation)
      if (parsed.technical_specs.camera) {
        output += `\n- **Camera:** ${parsed.technical_specs.camera}`;
      }
      if (parsed.technical_specs.lighting) {
        output += `\n- **Lighting:** ${parsed.technical_specs.lighting}`;
      }
      if (parsed.technical_specs.style) {
        output += `\n- **Style:** ${parsed.technical_specs.style}`;
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

  private async _repairSlots(options: {
    templateSystemPrompt: string;
    developerMessage?: string;
    schema: Record<string, unknown>;
    userMessage: string;
    originalJson: VideoPromptStructuredResponse;
    lintErrors: string[];
    config: { maxTokens: number; temperature: number; timeout: number };
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
      developerMessage: options.developerMessage,
      maxTokens: options.config.maxTokens,
      temperature: 0.2,
      timeout: options.config.timeout,
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
