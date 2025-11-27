import crypto from 'crypto';
import type { SemanticEnhancer, GenerateKeyOptions, CacheKeyGeneratorOptions } from './types.js';

/**
 * Cache Key Generator
 * 
 * SOLID Principles Applied:
 * - SRP: Focused solely on generating cache keys
 * - OCP: Can be extended with new generation strategies
 */
export class CacheKeyGenerator {
  private readonly semanticEnhancer: SemanticEnhancer | null;

  constructor({ semanticEnhancer = null }: CacheKeyGeneratorOptions = {}) {
    this.semanticEnhancer = semanticEnhancer;
  }

  /**
   * Generate cache key from data
   */
  generate(namespace: string, data: Record<string, unknown>, options: GenerateKeyOptions = {}): string {
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

