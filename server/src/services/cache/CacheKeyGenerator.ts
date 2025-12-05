import crypto from 'crypto';
import { logger } from '@infrastructure/Logger';
import type { SemanticEnhancer, GenerateKeyOptions, CacheKeyGeneratorOptions } from './types.js';

/**
 * Cache Key Generator
 * 
 * SOLID Principles Applied:
 * - SRP: Focused solely on generating cache keys
 * - OCP: Can be extended with new generation strategies
 */
export class CacheKeyGenerator {
  private readonly log = logger.child({ service: 'CacheKeyGenerator' });
  private readonly semanticEnhancer: SemanticEnhancer | null;

  constructor({ semanticEnhancer = null }: CacheKeyGeneratorOptions = {}) {
    this.semanticEnhancer = semanticEnhancer;
  }

  /**
   * Generate cache key from data
   */
  generate(namespace: string, data: Record<string, unknown>, options: GenerateKeyOptions = {}): string {
    const operation = 'generate';
    const {
      useSemantic = true,
      normalizeWhitespace = true,
      ignoreCase = true,
      sortKeys = true
    } = options;

    this.log.debug('Generating cache key', {
      operation,
      namespace,
      useSemantic,
      hasSemanticEnhancer: !!this.semanticEnhancer,
    });

    // Use semantic caching if enhancer available
    if (useSemantic && this.semanticEnhancer && typeof this.semanticEnhancer.generateSemanticKey === 'function') {
      const key = this.semanticEnhancer.generateSemanticKey(namespace, data, {
        normalizeWhitespace,
        ignoreCase,
        sortKeys,
      });
      
      this.log.debug('Semantic cache key generated', {
        operation,
        namespace,
        keyType: 'semantic',
      });
      
      return key;
    }

    // Fallback to standard hashing
    const hash = crypto
      .createHash('sha256')
      .update(JSON.stringify(data))
      .digest('hex')
      .substring(0, 16);

    const key = `${namespace}:${hash}`;
    
    this.log.debug('Standard cache key generated', {
      operation,
      namespace,
      keyType: 'standard',
      keyHash: hash,
    });

    return key;
  }
}

