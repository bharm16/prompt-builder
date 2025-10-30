/**
 * Interface for prompt optimization services
 * Abstracts the contract for optimizing user prompts
 */
export class IPromptOptimizationService {
  /**
   * Optimize a prompt for better results
   * @param {string} prompt - The original prompt
   * @param {Object} options - Optimization options
   * @returns {Promise<{optimizedPrompt: string, improvements: string[]}>}
   */
  async optimizePrompt(prompt, options) {
    throw new Error('Method not implemented');
  }

  /**
   * Validate that a prompt meets quality standards
   * @param {string} prompt - The prompt to validate
   * @returns {Promise<{valid: boolean, issues: string[]}>}
   */
  async validatePrompt(prompt) {
    throw new Error('Method not implemented');
  }
}
