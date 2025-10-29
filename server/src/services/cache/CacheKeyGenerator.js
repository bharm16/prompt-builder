import crypto from 'crypto';

/**
 * Cache Key Generator
 * 
 * SOLID Principles Applied:
 * - SRP: Focused solely on generating cache keys
 * - OCP: Can be extended with new generation strategies
 */
export class CacheKeyGenerator {
  constructor({ semanticEnhancer = null }) {
    this.semanticEnhancer = semanticEnhancer;
  }

  /**
   * Generate cache key from data
   * @param {string} namespace - Cache namespace
   * @param {Object} data - Data to hash
   * @param {Object} options - Options for key generation
   * @returns {string} Cache key
   */
  generate(namespace, data, options = {}) {
    const {
      useSemantic = true,
      normalizeWhitespace = true,
      ignoreCase = true,
      sortKeys = true
    } = options;

    // Use semantic caching if enhancer available
    if (useSemantic && this.semanticEnhancer && typeof this.semanticEnhancer.generateSemanticKey === 'function') {
      return this.semanticEnhancer.generateSemanticKey(namespace, data, {
        normalizeWhitespace,
        ignoreCase,
        sortKeys,
      });
    }

    // Fallback to standard hashing
    const hash = crypto
      .createHash('sha256')
      .update(JSON.stringify(data))
      .digest('hex')
      .substring(0, 16);

    return `${namespace}:${hash}`;
  }
}
