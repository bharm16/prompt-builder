/**
 * Interface for prompt enhancement services
 * Abstracts the contract for generating suggestions and enhancements
 */
export class IEnhancementService {
  /**
   * Generate enhancement suggestions for a prompt
   * @param {Object} params - Enhancement parameters
   * @returns {Promise<Object>} Enhancement suggestions
   */
  async generateSuggestions(params) {
    throw new Error('Method not implemented');
  }

  /**
   * Validate enhancement compatibility
   * @param {Object} params - Validation parameters
   * @returns {Promise<Object>} Validation result
   */
  async validateCompatibility(params) {
    throw new Error('Method not implemented');
  }
}
