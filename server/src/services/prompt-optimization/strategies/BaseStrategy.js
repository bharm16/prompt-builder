import { logger } from '../../../infrastructure/Logger.js';

/**
 * Base class for all optimization strategies
 * Defines the common interface and shared functionality
 */
export class BaseStrategy {
  constructor(name, aiService, templateService) {
    this.name = name;
    this.ai = aiService;
    this.templateService = templateService;
  }

  /**
   * Optimize a prompt using this strategy
   * Must be implemented by subclasses
   * @param {Object} params - Optimization parameters
   * @param {string} params.prompt - The prompt to optimize
   * @param {Object} params.context - Optional context
   * @param {Object} params.brainstormContext - Optional brainstorm context
   * @param {Object} params.domainContent - Optional pre-generated domain content
   * @returns {Promise<string>} Optimized prompt
   */
  async optimize({ prompt, context, brainstormContext, domainContent }) {
    throw new Error(`optimize() must be implemented by ${this.constructor.name}`);
  }

  /**
   * Generate domain-specific content for this strategy
   * Can be overridden by subclasses
   * @param {string} prompt - The original prompt
   * @param {Object} context - Optional context
   * @returns {Promise<Object|null>} Domain-specific content or null
   */
  async generateDomainContent(prompt, context) {
    // Default: no domain content generation
    return null;
  }

  /**
   * Build domain content section for template
   * @protected
   */
  buildDomainContentSection(domainContent, sectionConfig) {
    if (!domainContent) return '';

    let section = '\n\n**PRE-GENERATED DOMAIN-SPECIFIC CONTENT:**';
    section += '\nThe following domain-specific elements have been generated for this prompt.';
    section += '\nYou MUST incorporate these verbatim into the appropriate sections of your optimized prompt:\n';

    for (const [key, config] of Object.entries(sectionConfig)) {
      const items = domainContent[key];
      if (items && items.length > 0) {
        section += `\n**${config.title}:**\n`;
        items.forEach((item, i) => {
          section += `${i + 1}. ${item}\n`;
        });
      }
    }

    section += '\nIMPORTANT: These elements are already domain-specific and technically precise.';
    section += ' Use them as provided - do not make them more generic.\n';

    return section;
  }

  /**
   * Build context section (fallback when no domain content)
   * @protected
   */
  buildContextSection(context) {
    if (!context || !Object.keys(context).some(k => context[k])) {
      return '';
    }

    let section = '\n\n**USER-PROVIDED CONTEXT:**';
    section += '\nThe user has specified these requirements that MUST be integrated into the optimized prompt:';

    if (context.specificAspects) {
      section += `\n- **Focus Areas:** ${context.specificAspects}`;
    }
    if (context.backgroundLevel) {
      section += `\n- **Expertise Level:** ${context.backgroundLevel}`;
    }
    if (context.intendedUse) {
      section += `\n- **Intended Use:** ${context.intendedUse}`;
    }

    section += '\n\nEnsure these requirements are woven naturally into your optimized prompt.';
    return section;
  }

  /**
   * Parse JSON from LLM response
   * @protected
   */
  parseJsonFromResponse(rawOutput) {
    let jsonText = rawOutput.trim();

    // Remove markdown code fences if present
    const jsonMatch = rawOutput.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
    if (jsonMatch) {
      jsonText = jsonMatch[1];
    }

    try {
      return JSON.parse(jsonText);
    } catch (error) {
      logger.error('Failed to parse JSON from response', {
        strategy: this.name,
        error: error.message,
        rawOutput: rawOutput.substring(0, 200)
      });
      throw new Error('Invalid JSON response from LLM');
    }
  }

  /**
   * Get configuration for this strategy
   * Can be overridden by subclasses
   * @protected
   */
  getConfig() {
    return {
      maxTokens: 2500,
      temperature: 0.3,
      timeout: 30000
    };
  }
}

export default BaseStrategy;

