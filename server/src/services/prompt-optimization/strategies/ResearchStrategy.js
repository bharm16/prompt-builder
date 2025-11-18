import { BaseStrategy } from './BaseStrategy.js';
import { logger } from '../../../infrastructure/Logger.js';
import OptimizationConfig from '../../../config/OptimizationConfig.js';

/**
 * Strategy for optimizing research prompts
 * Specializes in comprehensive research planning with source validation
 */
export class ResearchStrategy extends BaseStrategy {
  constructor(claudeClient, templateService) {
    super('research', claudeClient, templateService);
  }

  /**
   * Generate domain-specific content for research mode
   * @override
   */
  async generateDomainContent(prompt, context) {
    logger.info('Generating domain content for research mode');

    try {
      const domainPrompt = this.buildDomainContentPrompt(prompt);

      const response = await this.claudeClient.complete(domainPrompt, {
        maxTokens: OptimizationConfig.tokens.domainContent,
        temperature: OptimizationConfig.temperatures.domainContent,
        timeout: OptimizationConfig.timeouts.optimization.research,
      });

      const rawOutput = response.content[0].text.trim();
      return this.parseJsonFromResponse(rawOutput);

    } catch (error) {
      logger.warn('Domain content generation failed for research mode', {
        error: error.message
      });
      return null;
    }
  }

  /**
   * Optimize prompt for research mode
   * @override
   */
  async optimize({ prompt, context, brainstormContext, domainContent }) {
    logger.info('Optimizing prompt with research strategy');

    // Build context sections
    const domainSection = domainContent
      ? this.buildDomainContentSection(domainContent, {
          sourceTypes: { title: 'SOURCE TYPES (include these in your Information Sources section)' },
          methodologies: { title: 'METHODOLOGIES (include these in your Methodology section)' },
          qualityCriteria: { title: 'QUALITY CRITERIA (add these to Success Metrics)' },
          commonBiases: { title: 'COMMON BIASES (include these in Anticipated Challenges)' }
        })
      : this.buildContextSection(context);

    // For now, create a simple research optimization prompt
    // TODO: Replace with template file once created
    const systemPrompt = this.buildResearchPrompt(prompt, domainSection);

    const config = this.getConfig();
    const response = await this.claudeClient.complete(systemPrompt, {
      maxTokens: config.maxTokens,
      temperature: config.temperature,
      timeout: config.timeout,
    });

    const optimized = response.content[0].text.trim();

    logger.info('Research optimization complete', {
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
    return `You are a research methodology expert analyzing a prompt to generate domain-specific research guidance.

<prompt>
${prompt}
</prompt>

Generate domain-specific research elements:

1. **Source Types** (4-6): Specific types of sources to consult
2. **Methodologies** (3-5): Research approaches and methods
3. **Quality Criteria** (3-5): Standards for evaluating sources
4. **Common Biases** (3-5): Biases to watch for and mitigate

Output ONLY a JSON object:

{
  "sourceTypes": ["source type 1", ...],
  "methodologies": ["methodology 1", ...],
  "qualityCriteria": ["criteria 1", ...],
  "commonBiases": ["bias 1", ...]
}

Output only the JSON, nothing else:`;
  }

  /**
   * Build research optimization prompt
   * @private
   */
  buildResearchPrompt(prompt, domainSection) {
    return `You are a research methodology expert. Transform this prompt into a comprehensive research plan.

<original_prompt>
${prompt}${domainSection}
</original_prompt>

Create an optimized research plan with these sections:

**RESEARCH OBJECTIVE**
[Clear statement of what needs to be investigated]

**CORE RESEARCH QUESTIONS**
[5-7 specific questions in priority order]

**METHODOLOGY**
[Specific research approaches with source triangulation guidance]

**INFORMATION SOURCES**
[Source types with quality criteria and verification standards]

**SUCCESS METRICS**
[Concrete measures of research sufficiency]

**SYNTHESIS FRAMEWORK**
[Systematic approach to analyze and integrate findings]

**DELIVERABLE FORMAT**
[Structure and style requirements for output]

**ANTICIPATED CHALLENGES**
[Specific obstacles and mitigation strategies]

Output ONLY the optimized research plan. Begin immediately with "**RESEARCH OBJECTIVE**".`;
  }

  /**
   * Get configuration for research strategy
   * @override
   */
  getConfig() {
    return {
      maxTokens: OptimizationConfig.tokens.optimization.research,
      temperature: OptimizationConfig.temperatures.optimization.research,
      timeout: OptimizationConfig.timeouts.optimization.research,
    };
  }
}

export default ResearchStrategy;

