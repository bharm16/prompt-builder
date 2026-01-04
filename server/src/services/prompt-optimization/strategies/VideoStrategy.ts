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
import type { VideoPromptStructuredResponse, VideoPromptSlots } from './videoPromptTypes';
import { lintVideoPromptSlots } from './videoPromptLinter';
import { renderAlternativeApproaches, renderMainVideoPrompt, renderPreviewPrompt } from './videoPromptRenderer';

function isCriticalVideoPromptLintError(error: string): boolean {
  return (
    /Missing `shot_framing`/i.test(error) ||
    /`shot_framing` looks like an angle/i.test(error) ||
    /Missing `camera_angle`/i.test(error) ||
    /If `subject` is null, `subject_details` must be null/i.test(error)
  );
}

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

  if (subjectDetails) {
    const normalizedDetails = subjectDetails
      .map((d) => d.trim().replace(/\s+/g, ' '))
      .map((d) => d.replace(/^[-*•]\s+/, ''))
      .map((d) => d.replace(/^(?:and|with)\s+/i, ''))
      .map((d) => d.replace(/[.]+$/g, '').trim())
      .map((d) => {
        const words = d.split(/\s+/).filter(Boolean);
        return words.length > 6 ? words.slice(0, 6).join(' ') : d;
      })
      .filter(Boolean);

    // De-dupe after normalization.
    const seen = new Set<string>();
    subjectDetails = normalizedDetails.filter((d) => {
      const key = d.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    subjectDetails = subjectDetails.length > 0 ? subjectDetails.slice(0, 3) : null;
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

  private _scoreSlots(slots: VideoPromptSlots): number {
    const wordCount = (value: string | null): number => (value ? value.trim().split(/\s+/).filter(Boolean).length : 0);

    let score = 0;
    const details = slots.subject_details || [];
    for (const detail of details) {
      score += Math.max(0, wordCount(detail) - 3);
    }

    score += Math.max(0, wordCount(slots.action) - 8);
    score += Math.max(0, wordCount(slots.setting) - 10);
    score += Math.max(0, wordCount(slots.lighting) - 18);
    score += Math.max(0, wordCount(slots.style) - 10);

    // Light penalty for repeated anchors across fields.
    const anchors = ['window', 'door', 'street', 'park', 'alley', 'beach'];
    const fields = [slots.action, slots.setting, slots.lighting].map((v) => (v || '').toLowerCase());
    for (const anchor of anchors) {
      const mentions = fields.reduce((count, f) => count + (f.includes(anchor) ? 1 : 0), 0);
      if (mentions > 1) score += (mentions - 1);
    }

    return score;
  }

  private async _rerollSlots(options: {
    templateSystemPrompt: string;
    developerMessage?: string;
    schema: Record<string, unknown>;
    messages: Array<{ role: string; content: string }>;
    config: { maxTokens: number; temperature: number; timeout: number };
    baseSeed: number;
    attempts?: number;
    signal?: AbortSignal;
  }): Promise<VideoPromptStructuredResponse | null> {
    const attempts = Math.max(0, Math.min(options.attempts ?? 2, 4));
    if (attempts === 0) return null;

    type Candidate = { parsed: VideoPromptStructuredResponse; slots: VideoPromptSlots; score: number };
    const candidates: Candidate[] = [];

    for (let i = 0; i < attempts; i++) {
      const seed = (options.baseSeed + i + 1) % 2147483647;
      try {
        const response = await this.ai.execute('optimize_standard', {
          systemPrompt: options.templateSystemPrompt,
          messages: options.messages,
          schema: options.schema,
          ...(options.developerMessage ? { developerMessage: options.developerMessage } : {}),
          maxTokens: options.config.maxTokens,
          temperature: 0.2,
          timeout: options.config.timeout,
          seed,
          ...(options.signal ? { signal: options.signal } : {}),
        });

        const parsed = JSON.parse(response.text) as VideoPromptStructuredResponse;
        const slots = normalizeSlots(parsed);
        const lint = lintVideoPromptSlots(slots);
        if (!lint.ok) {
          continue;
        }

        candidates.push({ parsed: { ...parsed, ...slots }, slots, score: this._scoreSlots(slots) });
      } catch {
        // Ignore and continue trying other seeds.
      }
    }

    if (candidates.length === 0) return null;
    candidates.sort((a, b) => a.score - b.score);
    return candidates[0]!.parsed;
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

      const rerolled = await this._rerollSlots({
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
    signal?: AbortSignal,
    onMetadata?: (metadata: Record<string, unknown>) => void
  ): Promise<string> {
    // Generate full system prompt (legacy format)
    const systemPrompt =
      lockedSpans && lockedSpans.length > 0
        ? generateUniversalVideoPromptWithLockedSpans(prompt, shotPlan, lockedSpans)
        : generateUniversalVideoPrompt(prompt, shotPlan);

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
