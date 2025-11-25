import crypto from 'crypto';
import { logger } from '@infrastructure/Logger.ts';

/**
 * Semantic Cache Service
 * 
 * Improves cache hit rates through intelligent normalization and similarity matching.
 * Aims to increase hit rate from ~30% to ~60%.
 * 
 * Previously located in utils/ - moved to services/cache/ as this is a stateful
 * service with complex business logic, not a simple utility function.
 */
export class SemanticCacheEnhancer {
  /**
   * Generate normalized cache key with semantic awareness
   * @param {string} namespace - Cache namespace
   * @param {Object} data - Data to cache
   * @param {Object} options - Options
   * @returns {string} Optimized cache key
   */
  static generateSemanticKey(namespace, data, options = {}) {
    const { normalizeWhitespace = true, ignoreCase = true, sortKeys = true } =
      options;

    // Normalize the data for better semantic matching
    const normalized = this._normalizeData(data, {
      normalizeWhitespace,
      ignoreCase,
      sortKeys,
    });

    // Generate hash from normalized data
    const hash = crypto
      .createHash('sha256')
      .update(JSON.stringify(normalized))
      .digest('hex')
      .substring(0, 16);

    return `${namespace}:semantic:${hash}`;
  }

  /**
   * Extract semantic features from prompt for similarity matching
   * @param {string} prompt - Prompt text
   * @returns {Object} Semantic features
   */
  static extractSemanticFeatures(prompt) {
    // Normalize prompt
    const normalized = this._normalizeText(prompt);

    // Extract key features
    const words = normalized.split(/\s+/).filter((w) => w.length > 0);
    const uniqueWords = new Set(words);

    // Extract key terms (longer words are usually more semantic)
    const keyTerms = words
      .filter((w) => w.length >= 4)
      .sort()
      .slice(0, 10); // Top 10 key terms

    // Create feature fingerprint
    const features = {
      length: words.length,
      uniqueWords: uniqueWords.size,
      keyTerms,
      firstWords: words.slice(0, 5).join(' '),
      lastWords: words.slice(-3).join(' '),
    };

    return features;
  }

  /**
   * Calculate similarity score between two prompts
   * @param {string} prompt1 - First prompt
   * @param {string} prompt2 - Second prompt
   * @returns {number} Similarity score (0-1)
   */
  static calculateSimilarity(prompt1, prompt2) {
    const features1 = this.extractSemanticFeatures(prompt1);
    const features2 = this.extractSemanticFeatures(prompt2);

    // Jaccard similarity on key terms
    const terms1 = new Set(features1.keyTerms);
    const terms2 = new Set(features2.keyTerms);

    const intersection = new Set([...terms1].filter((x) => terms2.has(x)));
    const union = new Set([...terms1, ...terms2]);

    const jaccardScore = union.size > 0 ? intersection.size / union.size : 0;

    // Length similarity
    const lengthDiff = Math.abs(features1.length - features2.length);
    const maxLength = Math.max(features1.length, features2.length);
    const lengthScore = maxLength > 0 ? 1 - lengthDiff / maxLength : 1;

    // Combined score (weighted)
    const similarityScore = 0.7 * jaccardScore + 0.3 * lengthScore;

    return similarityScore;
  }

  /**
   * Normalize data for consistent caching
   * @private
   */
  static _normalizeData(data, options) {
    if (typeof data === 'string') {
      return this._normalizeText(data, options);
    }

    if (Array.isArray(data)) {
      return data.map((item) => this._normalizeData(item, options));
    }

    if (data && typeof data === 'object') {
      const normalized = {};
      const keys = options.sortKeys ? Object.keys(data).sort() : Object.keys(data);

      for (const key of keys) {
        normalized[key] = this._normalizeData(data[key], options);
      }

      return normalized;
    }

    return data;
  }

  /**
   * Normalize text for semantic comparison
   * @private
   */
  static _normalizeText(text, options = {}) {
    const { normalizeWhitespace = true, ignoreCase = true } = options;

    let normalized = text;

    if (ignoreCase) {
      normalized = normalized.toLowerCase();
    }

    if (normalizeWhitespace) {
      // Normalize whitespace
      normalized = normalized.replace(/\s+/g, ' ').trim();

      // Normalize punctuation spacing
      normalized = normalized.replace(/\s*([.,!?;:])\s*/g, '$1 ');
    }

    // Remove common filler words that don't affect semantic meaning
    const fillers = [
      'please',
      'could you',
      'can you',
      'i want',
      "i'd like",
      'help me',
    ];

    for (const filler of fillers) {
      const regex = new RegExp(`\\b${filler}\\b`, 'gi');
      normalized = normalized.replace(regex, '');
    }

    // Final cleanup
    normalized = normalized.replace(/\s+/g, ' ').trim();

    return normalized;
  }

  /**
   * Get cache recommendations for improving hit rate
   * @param {Object} currentStats - Current cache statistics
   * @returns {Object} Recommendations
   */
  static getCacheOptimizationRecommendations(currentStats) {
    const recommendations = [];
    const { hitRate, keys, hits, misses } = currentStats;

    const numericHitRate = parseFloat(hitRate) || 0;

    // Analyze hit rate
    if (numericHitRate < 30) {
      recommendations.push({
        priority: 'high',
        category: 'hit-rate',
        issue: 'Very low cache hit rate',
        suggestion:
          'Enable semantic caching with normalized keys to improve similarity matching',
        expectedImpact: '+20-30% hit rate',
      });
    } else if (numericHitRate < 50) {
      recommendations.push({
        priority: 'medium',
        category: 'hit-rate',
        issue: 'Moderate cache hit rate',
        suggestion:
          'Fine-tune normalization options and consider caching more aggressively',
        expectedImpact: '+10-20% hit rate',
      });
    }

    // Analyze cache size
    if (keys > 10000) {
      recommendations.push({
        priority: 'medium',
        category: 'memory',
        issue: 'Large number of cache keys',
        suggestion:
          'Implement LRU eviction or reduce TTL to manage memory usage',
        expectedImpact: 'Reduced memory footprint',
      });
    }

    // Analyze usage patterns
    const totalRequests = hits + misses;
    if (totalRequests > 1000 && numericHitRate < 40) {
      recommendations.push({
        priority: 'high',
        category: 'optimization',
        issue: 'High request volume with low hit rate',
        suggestion:
          'Implement cache warming for common queries and increase TTL for stable content',
        expectedImpact: '+15-25% hit rate',
      });
    }

    return {
      overall: numericHitRate < 40 ? 'needs-improvement' : 'good',
      currentHitRate: hitRate,
      targetHitRate: '60%+',
      recommendations,
    };
  }

  /**
   * Generate cache warming strategies
   * @param {Array<string>} commonPrompts - Common prompt patterns
   * @returns {Object} Warming strategy
   */
  static generateCacheWarmingStrategy(commonPrompts) {
    // Cluster similar prompts
    const clusters = this._clusterPrompts(commonPrompts);

    return {
      clusters: clusters.length,
      strategy: 'Pre-cache common variations of popular prompts',
      prompts: clusters.map((cluster) => ({
        representative: cluster[0],
        variations: cluster.length,
      })),
    };
  }

  /**
   * Cluster similar prompts
   * @private
   */
  static _clusterPrompts(prompts, threshold = 0.7) {
    const clusters = [];
    const used = new Set();

    for (let i = 0; i < prompts.length; i++) {
      if (used.has(i)) continue;

      const cluster = [prompts[i]];
      used.add(i);

      for (let j = i + 1; j < prompts.length; j++) {
        if (used.has(j)) continue;

        const similarity = this.calculateSimilarity(prompts[i], prompts[j]);

        if (similarity >= threshold) {
          cluster.push(prompts[j]);
          used.add(j);
        }
      }

      clusters.push(cluster);
    }

    return clusters;
  }

  /**
   * Create intelligent cache configuration
   * @param {string} cacheType - Type of cache
   * @returns {Object} Optimized configuration
   */
  static getOptimizedCacheConfig(cacheType) {
    const configs = {
      'prompt-optimization': {
        ttl: 7200, // 2 hours - prompts change less frequently
        namespace: 'prompt-opt',
        useSemanticKeys: true,
        normalization: {
          normalizeWhitespace: true,
          ignoreCase: true,
          sortKeys: true,
        },
        reasoning: 'Prompt optimizations are stable and benefit from longer caching',
      },

      'question-generation': {
        ttl: 3600, // 1 hour
        namespace: 'questions',
        useSemanticKeys: true,
        normalization: {
          normalizeWhitespace: true,
          ignoreCase: true,
          sortKeys: false, // Order matters for questions
        },
        reasoning: 'Questions benefit from semantic matching but order is important',
      },

      enhancement: {
        ttl: 5400, // 1.5 hours
        namespace: 'enhance',
        useSemanticKeys: true,
        normalization: {
          normalizeWhitespace: true,
          ignoreCase: false, // Case might matter in enhanced text
          sortKeys: true,
        },
        reasoning:
          'Enhancements are contextual but similar contexts should share cache',
      },

      'scene-detection': {
        ttl: 3600, // 1 hour
        namespace: 'scene',
        useSemanticKeys: true,
        normalization: {
          normalizeWhitespace: true,
          ignoreCase: true,
          sortKeys: true,
        },
        reasoning: 'Scene changes are deterministic and highly cacheable',
      },

      creative: {
        ttl: 1800, // 30 minutes - creative content should vary more
        namespace: 'creative',
        useSemanticKeys: false, // Less aggressive caching for creativity
        normalization: {
          normalizeWhitespace: true,
          ignoreCase: true,
          sortKeys: true,
        },
        reasoning: 'Creative content benefits from fresh generation',
      },
    };

    return (
      configs[cacheType] || {
        ttl: 3600,
        namespace: 'default',
        useSemanticKeys: true,
        normalization: {
          normalizeWhitespace: true,
          ignoreCase: true,
          sortKeys: true,
        },
        reasoning: 'Default balanced configuration',
      }
    );
  }
}
