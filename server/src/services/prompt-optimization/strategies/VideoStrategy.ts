import { logger } from '@infrastructure/Logger.js';
import OptimizationConfig from '@config/OptimizationConfig.js';
import { generateUniversalVideoPrompt } from './videoPromptOptimizationTemplate.js';
import { StructuredOutputEnforcer } from '@utils/StructuredOutputEnforcer.js';
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
   * Uses StructuredOutputEnforcer to get JSON with cinematographic analysis
   */
  async optimize({ prompt, shotPlan = null }: OptimizationRequest): Promise<string> {
    logger.info('Optimizing prompt with video strategy (CoT + structured output)');

    // Generate the system prompt with Chain-of-Thought instructions
    const systemPrompt = generateUniversalVideoPrompt(prompt, shotPlan as ShotPlan | null);

    // Define the expected JSON schema
    const schema = {
      type: 'object',
      required: ['_creative_strategy', 'shot_type', 'prompt', 'technical_specs', 'variations'],
    };

    // Get configuration
    const config = this.getConfig();

    try {
      // Use StructuredOutputEnforcer to get validated JSON response
      const parsedResponse = await StructuredOutputEnforcer.enforceJSON(
        this.ai,
        systemPrompt,
        {
          operation: 'optimize_standard',
          schema,
          isArray: false,
          maxRetries: 2,
          maxTokens: config.maxTokens,
          temperature: config.temperature,
          timeout: config.timeout,
        }
      ) as VideoPromptResponse;

      // Log the cinematographic reasoning and shot type for debugging/monitoring
      logger.info('Video optimization complete with CoT reasoning', {
        originalLength: prompt.length,
        shotType: parsedResponse.shot_type,
        strategy: parsedResponse._creative_strategy,
        promptLength: parsedResponse.prompt?.length || 0
      });

      // Reassemble into the expected text format for backward compatibility
      const reassembled = this._reassembleOutput(parsedResponse);

      logger.debug('Output reassembled for backward compatibility', {
        reassembledLength: reassembled.length
      });

      return reassembled;

    } catch (error) {
      logger.error('Failed to generate structured video prompt', {
        error: (error as Error).message,
        originalPrompt: prompt.substring(0, 100)
      });
      throw error;
    }
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

