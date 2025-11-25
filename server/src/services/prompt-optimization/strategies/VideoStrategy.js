import { logger } from '../infrastructure/Logger.ts';
import OptimizationConfig from '../../../config/OptimizationConfig.js';
import { generateUniversalVideoPrompt } from './videoPromptOptimizationTemplate.js';
import { StructuredOutputEnforcer } from '../../../utils/StructuredOutputEnforcer.js';

/**
 * Strategy for optimizing video generation prompts
 * Uses specialized video prompt template with Chain-of-Thought reasoning
 * Returns structured JSON internally but assembles to text for backward compatibility
 */
export class VideoStrategy {
  constructor(aiService, templateService) {
    this.name = 'video';
    this.ai = aiService;
    this.templateService = templateService;
  }

  /**
   * Optimize prompt for video generation
   * Uses StructuredOutputEnforcer to get JSON with cinematographic analysis
   * @override
   */
  async optimize({ prompt, shotPlan = null }) {
    logger.info('Optimizing prompt with video strategy (CoT + structured output)');

    // Generate the system prompt with Chain-of-Thought instructions
    const systemPrompt = generateUniversalVideoPrompt(prompt, shotPlan);

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
      );

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
        error: error.message,
        originalPrompt: prompt.substring(0, 100)
      });
      throw error;
    }
  }

  /**
   * Reassemble structured JSON into text format for backward compatibility
   * @private
   */
  _reassembleOutput(parsed) {
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
   * @override
   */
  async generateDomainContent() {
    return null;
  }

  /**
   * Get configuration for video strategy
   * @override
   */
  getConfig() {
    return {
      maxTokens: OptimizationConfig.tokens.optimization.video,
      temperature: OptimizationConfig.temperatures.optimization.video,
      timeout: OptimizationConfig.timeouts.optimization.video,
    };
  }
}

export default VideoStrategy;
