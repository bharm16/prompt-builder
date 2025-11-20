import { BaseStrategy } from './BaseStrategy.js';
import { logger } from '../../../infrastructure/Logger.js';
import OptimizationConfig from '../../../config/OptimizationConfig.js';

/**
 * Strategy for optimizing reasoning prompts
 * Optimized for o1, o1-pro, o3, and Claude Sonnet reasoning models
 */
export class ReasoningStrategy extends BaseStrategy {
  constructor(aiService, templateService) {
    super('reasoning', aiService, templateService);
  }

  /**
   * Generate domain-specific content for reasoning mode
   * @override
   */
  async generateDomainContent(prompt, context) {
    logger.info('Generating domain content for reasoning mode');

    try {
      const domainPrompt = this.buildDomainContentPrompt(prompt);

      const response = await this.ai.execute('optimize_context_inference', {
        systemPrompt: domainPrompt,
        maxTokens: OptimizationConfig.tokens.domainContent,
        temperature: OptimizationConfig.temperatures.domainContent,
        timeout: OptimizationConfig.timeouts.optimization.reasoning,
      });

      const rawOutput = response.content[0].text.trim();
      return this.parseJsonFromResponse(rawOutput);

    } catch (error) {
      logger.warn('Domain content generation failed for reasoning mode', {
        error: error.message
      });
      return null;
    }
  }

  /**
   * Optimize prompt for reasoning mode
   * @override
   */
  async optimize({ prompt, context, brainstormContext, domainContent }) {
    logger.info('Optimizing prompt with reasoning strategy');

    // Build context sections
    const domainSection = domainContent
      ? this.buildDomainContentSection(domainContent, {
          warnings: { title: 'WARNINGS (include these in your Warnings section)' },
          deliverables: { title: 'DELIVERABLES (include these in your Return Format section)' },
          constraints: { title: 'CONSTRAINTS (add a Constraints section with these)' }
        })
      : this.buildContextSection(context);

    // Build transformation steps
    const transformationSteps = this.buildTransformationSteps(domainContent, context, brainstormContext);

    // Load and render template
    const systemPrompt = await this.templateService.load('reasoning', {
      prompt,
      domainContentSection: domainSection,
      transformationSteps
    });

    // Call AI service to optimize
    const config = this.getConfig();
    const response = await this.ai.execute('optimize_standard', {
      systemPrompt,
      maxTokens: config.maxTokens,
      temperature: config.temperature,
      timeout: config.timeout,
    });

    const optimized = response.content[0].text.trim();

    logger.info('Reasoning optimization complete', {
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
    return `You are a domain expert analyzing a prompt to generate domain-specific content for reasoning optimization.

<prompt>
${prompt}
</prompt>

Your task: Generate domain-specific warnings, deliverables, and constraints that will make the optimized reasoning prompt more effective.

**Generate:**
1. **Warnings** (4-6): Sophisticated, domain-specific pitfalls to avoid
   - Be specific to the problem domain (not generic)
   - Prevent expert-level mistakes (not obvious errors)
   - Address trade-offs, scale considerations, or context dependencies

2. **Deliverables** (3-5): Concrete outputs that should be specified
   - Specific format requirements
   - Structure and organization expectations
   - Quantifiable criteria where possible

3. **Constraints** (2-4, if applicable): Hard technical or business constraints
   - Technical limitations
   - Business requirements
   - Compliance or regulatory needs

Output ONLY a JSON object:

{
  "warnings": ["warning 1", "warning 2", ...],
  "deliverables": ["deliverable 1", "deliverable 2", ...],
  "constraints": ["constraint 1", "constraint 2", ...]
}

Output only the JSON, nothing else:`;
  }

  /**
   * Build transformation steps based on available content
   * @private
   */
  buildTransformationSteps(domainContent, context, brainstormContext) {
    if (domainContent && (domainContent.warnings?.length > 0 || domainContent.deliverables?.length > 0)) {
      return `
1. **Extract the core objective** - What are they really trying to accomplish?
2. **Integrate pre-generated domain content** - Warnings, deliverables, and constraints have been pre-generated above. Include them in the appropriate sections of your optimized prompt.
   - Copy the WARNINGS into your **Warnings** section
   - Copy the DELIVERABLES into your **Return Format** section
   - Copy the CONSTRAINTS into a **Constraints** section (if provided)
3. **Identify essential context** - What background information shapes the solution space?
4. **Add quantification** - Where else can you make requirements measurable?
5. **Remove all meta-instructions** - Trust the model to reason well without process guidance`;
    }

    return `
1. **Extract the core objective** - What are they really trying to accomplish?
2. **Determine specific deliverables** - What concrete outputs would best serve this goal?
3. **Generate domain-specific warnings** - What sophisticated mistakes could occur in this domain?
4. **Identify essential context** - What background information shapes the solution space?
5. **Add quantification** - Where can you make requirements measurable?
6. **Remove all meta-instructions** - Trust the model to reason well without process guidance`;
  }

  /**
   * Get configuration for reasoning strategy
   * @override
   */
  getConfig() {
    return {
      maxTokens: OptimizationConfig.tokens.optimization.reasoning,
      temperature: OptimizationConfig.temperatures.optimization.reasoning,
      timeout: OptimizationConfig.timeouts.optimization.reasoning,
    };
  }
}

export default ReasoningStrategy;

