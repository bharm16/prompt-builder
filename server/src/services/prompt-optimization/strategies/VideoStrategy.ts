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

/**
 * Structured video prompt response
 */
interface VideoPromptResponse {
  _creative_strategy: string;
  shot_type: string;
  prompt: string;
  technical_specs: {
    duration?: string;
    aspect_ratio?: string;
    frame_rate?: string;
    audio?: string;
    camera?: string;
    lighting?: string;
    style?: string;
  };
  variations?: Array<{
    label: string;
    prompt: string;
  }>;
}

/**
 * Strict JSON Schema for video prompt generation (OpenAI Structured Outputs)
 * Uses additionalProperties: false for strict mode compliance
 */
const VIDEO_PROMPT_SCHEMA = {
  type: "object",
  properties: {
    _creative_strategy: {
      type: "string",
      description: "Brief reasoning for why this shot type and camera move were chosen."
    },
    shot_type: {
      type: "string",
      description: "The specific shot type chosen from the dictionary."
    },
    prompt: {
      type: "string",
      description: "The final, 100-150 word video generation prompt."
    },
    technical_specs: {
      type: "object",
      properties: {
        lighting: { type: "string" },
        camera: { type: "string" },
        style: { type: "string" },
        duration: { type: "string" },
        aspect_ratio: { type: "string" },
        frame_rate: { type: "string" },
        audio: { type: "string" }
      },
      required: ["lighting", "camera", "style", "duration", "aspect_ratio", "frame_rate", "audio"],
      additionalProperties: false
    },
    variations: {
      type: "array",
      items: {
        type: "object",
        properties: {
          label: { type: "string" },
          prompt: { type: "string" }
        },
        required: ["label", "prompt"],
        additionalProperties: false
      }
    }
  },
  required: ["_creative_strategy", "shot_type", "prompt", "technical_specs", "variations"],
  additionalProperties: false
};

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

      const parsedResponse = JSON.parse(response.text) as VideoPromptResponse;

      logger.info('Video optimization complete with native structured outputs', {
        originalLength: prompt.length,
        shotType: parsedResponse.shot_type,
        strategy: parsedResponse._creative_strategy,
        promptLength: parsedResponse.prompt?.length || 0,
        provider,
        usedDeveloperMessage: !!template.developerMessage,
      });

      return this._reassembleOutput(parsedResponse);

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
      required: ['_creative_strategy', 'shot_type', 'prompt', 'technical_specs', 'variations'],
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
    ) as VideoPromptResponse;

    logger.info('Video optimization complete with fallback enforcer', {
      originalLength: prompt.length,
      shotType: parsedResponse.shot_type,
      strategy: parsedResponse._creative_strategy,
    });

    return this._reassembleOutput(parsedResponse);
  }

  /**
   * Reassemble structured JSON into text format for backward compatibility
   */
  private _reassembleOutput(parsed: VideoPromptResponse): string {
    const {
      prompt,
      technical_specs,
      variations
    } = parsed;

    let output = prompt;

    // Add technical specs section with merged creative and output specs (aligned with research template)
    if (technical_specs) {
      output += '\n\n**TECHNICAL SPECS**';

      // Output specs (generator-facing)
      output += `\n- **Duration:** ${technical_specs.duration || '4-8s'}`;
      output += `\n- **Aspect Ratio:** ${technical_specs.aspect_ratio || '16:9'}`;
      output += `\n- **Frame Rate:** ${technical_specs.frame_rate || '24fps'}`;
      output += `\n- **Audio:** ${technical_specs.audio || 'mute'}`;

      // Creative specs (used in prompt generation)
      if (technical_specs.camera) {
        output += `\n- **Camera:** ${technical_specs.camera}`;
      }
      if (technical_specs.lighting) {
        output += `\n- **Lighting:** ${technical_specs.lighting}`;
      }
      if (technical_specs.style) {
        output += `\n- **Style:** ${technical_specs.style}`;
      }
    }

    // Add variations section
    if (variations && Array.isArray(variations) && variations.length > 0) {
      output += '\n\n**ALTERNATIVE APPROACHES**';
      variations.forEach((variation, index) => {
        const varNum = index + 1;
        output += `\n- **Variation ${varNum} (${variation.label}):** ${variation.prompt}`;
      });
    }

    return output;
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
