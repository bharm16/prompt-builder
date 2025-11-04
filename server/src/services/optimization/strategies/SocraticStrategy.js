import { BaseStrategy } from './BaseStrategy.js';
import { logger } from '../../../infrastructure/Logger.js';
import OptimizationConfig from '../../../config/OptimizationConfig.js';

/**
 * Strategy for optimizing Socratic learning prompts
 * Specializes in inquiry-based education with progressive questioning
 */
export class SocraticStrategy extends BaseStrategy {
  constructor(claudeClient, templateService) {
    super('socratic', claudeClient, templateService);
  }

  /**
   * Generate domain-specific content for Socratic mode
   * @override
   */
  async generateDomainContent(prompt, context) {
    logger.info('Generating domain content for socratic mode');

    try {
      const domainPrompt = this.buildDomainContentPrompt(prompt);

      const response = await this.claudeClient.complete(domainPrompt, {
        maxTokens: OptimizationConfig.tokens.domainContent,
        temperature: OptimizationConfig.temperatures.domainContent,
        timeout: OptimizationConfig.timeouts.optimization.socratic,
      });

      const rawOutput = response.content[0].text.trim();
      return this.parseJsonFromResponse(rawOutput);

    } catch (error) {
      logger.warn('Domain content generation failed for socratic mode', {
        error: error.message
      });
      return null;
    }
  }

  /**
   * Optimize prompt for Socratic learning mode
   * @override
   */
  async optimize({ prompt, context, brainstormContext, domainContent }) {
    logger.info('Optimizing prompt with socratic strategy');

    // Build context sections
    const domainSection = domainContent
      ? this.buildDomainContentSection(domainContent, {
          prerequisites: { title: 'PREREQUISITES (include these in your Prerequisites section)' },
          misconceptions: { title: 'COMMON MISCONCEPTIONS (include these in your Common Misconceptions section)' },
          analogies: { title: 'TEACHING ANALOGIES (incorporate into your Guiding Questions)' },
          milestones: { title: 'LEARNING MILESTONES (include these in your Mastery Indicators)' }
        })
      : this.buildContextSection(context);

    // Build Socratic optimization prompt
    const systemPrompt = this.buildSocraticPrompt(prompt, domainSection);

    const config = this.getConfig();
    const response = await this.claudeClient.complete(systemPrompt, {
      maxTokens: config.maxTokens,
      temperature: config.temperature,
      timeout: config.timeout,
    });

    const optimized = response.content[0].text.trim();

    logger.info('Socratic optimization complete', {
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
    return `You are a learning science expert analyzing a prompt to generate pedagogically sound learning elements.

<prompt>
${prompt}
</prompt>

Generate domain-specific learning elements:

1. **Prerequisites** (3-5): Essential concepts that must be understood first
2. **Misconceptions** (3-5): Common misunderstandings to address
3. **Analogies** (2-4): Effective teaching analogies or examples
4. **Milestones** (3-5): Observable indicators of mastery

Output ONLY a JSON object:

{
  "prerequisites": ["prerequisite 1", ...],
  "misconceptions": ["misconception 1", ...],
  "analogies": ["analogy 1", ...],
  "milestones": ["milestone 1", ...]
}

Output only the JSON, nothing else:`;
  }

  /**
   * Build Socratic optimization prompt
   * @private
   */
  buildSocraticPrompt(prompt, domainSection) {
    return `You are a Socratic learning guide specializing in inquiry-based education. Transform this prompt into a progressive learning journey.

<original_prompt>
${prompt}${domainSection}
</original_prompt>

Create an optimized learning plan with these sections:

**LEARNING OBJECTIVE**
[Clear statement of what the learner will understand and be able to do]

**PRIOR KNOWLEDGE CHECK**
[2-3 diagnostic questions to assess current understanding]

**FOUNDATION QUESTIONS**
[3-4 carefully sequenced questions building core understanding]

**DEEPENING QUESTIONS**
[4-5 progressively challenging questions that extend understanding]

**APPLICATION & SYNTHESIS**
[3-4 questions connecting concepts to real-world scenarios]

**METACOGNITIVE REFLECTION**
[2-3 questions about the learning process itself]

**COMMON MISCONCEPTIONS**
[2-3 misconceptions with questions designed to surface and correct them]

**EXTENSION PATHS**
[Suggested directions for continued exploration]

Output ONLY the optimized learning plan. Begin immediately with "**LEARNING OBJECTIVE**".`;
  }

  /**
   * Get configuration for Socratic strategy
   * @override
   */
  getConfig() {
    return {
      maxTokens: OptimizationConfig.tokens.optimization.socratic,
      temperature: OptimizationConfig.temperatures.optimization.socratic,
      timeout: OptimizationConfig.timeouts.optimization.socratic,
    };
  }
}

export default SocraticStrategy;
