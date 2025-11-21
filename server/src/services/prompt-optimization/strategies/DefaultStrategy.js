import { BaseStrategy } from './BaseStrategy.js';
import { logger } from '../../../infrastructure/Logger.js';
import OptimizationConfig from '../../../config/OptimizationConfig.js';

/**
 * Default strategy for general prompt optimization
 * Used when no specific mode is detected or for 'optimize' mode
 */
export class DefaultStrategy extends BaseStrategy {
  constructor(aiService, templateService) {
    super('default', aiService, templateService);
  }

  /**
   * Generate domain-specific content for default mode
   * @override
   */
  async generateDomainContent(prompt, context) {
    logger.info('Generating domain content for default mode');

    try {
      const domainPrompt = this.buildDomainContentPrompt(prompt);

      const response = await this.ai.execute('optimize_context_inference', {
        systemPrompt: domainPrompt,
        maxTokens: OptimizationConfig.tokens.domainContent,
        temperature: OptimizationConfig.temperatures.domainContent,
        timeout: OptimizationConfig.timeouts.optimization.default,
      });

      const rawOutput = response.content[0].text.trim();
      return this.parseJsonFromResponse(rawOutput);

    } catch (error) {
      logger.warn('Domain content generation failed for default mode', {
        error: error.message
      });
      return null;
    }
  }

  /**
   * Optimize prompt using default strategy
   * @override
   */
  async optimize({ prompt, context, brainstormContext, domainContent }) {
    logger.info('Optimizing prompt with default strategy');

    // Build context sections
    const domainSection = domainContent
      ? this.buildDomainContentSection(domainContent, {
          technicalSpecs: { title: 'TECHNICAL SPECIFICATIONS (include in your Requirements section)' },
          antiPatterns: { title: 'ANTI-PATTERNS TO AVOID (include in your Warnings section)' },
          successMetrics: { title: 'SUCCESS METRICS (include in your Success Criteria section)' },
          constraints: { title: 'CONSTRAINTS (include in your Constraints section)' }
        })
      : this.buildContextSection(context);

    // Build default optimization prompt
    const systemPrompt = this.buildDefaultPrompt(prompt, domainSection);

    const config = this.getConfig();
    const response = await this.ai.execute('optimize_standard', {
      systemPrompt,
      maxTokens: config.maxTokens,
      temperature: config.temperature,
      timeout: config.timeout,
    });

    const optimized = response.content[0].text.trim();

    logger.info('Default optimization complete', {
      originalLength: prompt.length,
      optimizedLength: optimized.length
    });

    return optimized;
  }

  /**
   * Build domain content generation prompt
   * @private
   */
  buildDomainContentPrompt(prompt) {
    return `You are a prompt engineering expert analyzing a prompt to generate domain-specific optimization guidance.

<prompt>
${prompt}
</prompt>

Generate domain-specific optimization elements:

1. **Technical Specs** (3-5): Specific technical requirements or specifications
2. **Anti-Patterns** (3-5): Common mistakes or approaches to avoid
3. **Success Metrics** (3-5): Measurable criteria for successful output
4. **Constraints** (2-4): Hard constraints or limitations to respect

Output ONLY a JSON object:

{
  "technicalSpecs": ["spec 1", ...],
  "antiPatterns": ["anti-pattern 1", ...],
  "successMetrics": ["metric 1", ...],
  "constraints": ["constraint 1", ...]
}

Output only the JSON, nothing else:`;
  }

  /**
   * Build default optimization prompt
   * @private
   */
  buildDefaultPrompt(prompt, domainSection) {
    return `You are an expert prompt engineer. Optimize this prompt for clarity, specificity, and actionability.

<original_prompt>
${prompt}${domainSection}
</original_prompt>

Transform the prompt to be:
- **Clear**: Unambiguous and easy to understand
- **Specific**: Concrete requirements and expectations
- **Actionable**: Clear what output or action is needed
- **Structured**: Well-organized with logical flow
- **Complete**: Includes necessary context and constraints

Output ONLY the optimized prompt. Do not include meta-commentary or explanations.`;
  }

  /**
   * Get configuration for default strategy
   * @override
   */
  getConfig() {
    return {
      maxTokens: OptimizationConfig.tokens.optimization.default,
      temperature: OptimizationConfig.temperatures.optimization.default,
      timeout: OptimizationConfig.timeouts.optimization.default,
    };
  }
}

export default DefaultStrategy;

