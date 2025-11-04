/**
 * Optimization Mode Interface
 * 
 * SOLID Principles Applied:
 * - OCP: New modes can be added without modifying existing code
 * - ISP: Clean interface for mode implementations
 */
export class IOptimizationMode {
  /**
   * Get the mode name
   * @returns {string}
   */
  getName() {
    throw new Error('getName() must be implemented');
  }
  
  /**
   * Generate system prompt for this mode
   * @param {string} prompt - User prompt
   * @param {Object} context - Optimization context
   * @param {Object} domainContent - Pre-generated domain content
   * @returns {string} System prompt
   */
  generateSystemPrompt(prompt, context, domainContent) {
    throw new Error('generateSystemPrompt() must be implemented');
  }
  
  /**
   * Generate domain-specific content for this mode
   * @param {string} prompt - User prompt
   * @param {Object} context - User context
   * @param {IAIClient} client - AI client for generation
   * @returns {Promise<Object>} Domain-specific content
   */
  async generateDomainContent(prompt, context, client) {
    // Optional - return null if mode doesn't support domain content
    return null;
  }
  
  /**
   * Generate draft prompt for two-stage optimization
   * @param {string} prompt - User prompt
   * @param {Object} context - Optimization context
   * @returns {string} Draft system prompt
   */
  generateDraftPrompt(prompt, context) {
    throw new Error('generateDraftPrompt() must be implemented');
  }
}
