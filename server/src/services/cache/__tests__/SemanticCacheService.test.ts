import { describe, expect, it, vi } from 'vitest';
import { SemanticCacheEnhancer } from '../SemanticCacheService';

vi.mock('@infrastructure/Logger', () => ({
  logger: {
    child: () => ({
      debug: vi.fn(),
      info: vi.fn(),
    }),
  },
}));

describe('SemanticCacheEnhancer', () => {
  it('generates deterministic semantic keys for equivalent inputs', () => {
    const keyA = SemanticCacheEnhancer.generateSemanticKey('prompt', {
      text: 'Please make this cinematic',
      style: 'noir',
    });
    const keyB = SemanticCacheEnhancer.generateSemanticKey('prompt', {
      text: 'please   make this cinematic',
      style: 'noir',
    });

    expect(keyA).toBe(keyB);
    expect(keyA).toMatch(/^prompt:semantic:[a-f0-9]{16}$/);
  });

  it('supports disabling normalization behaviors for key generation', () => {
    const keyA = SemanticCacheEnhancer.generateSemanticKey(
      'prompt',
      { text: 'HELLO WORLD' },
      { ignoreCase: false }
    );
    const keyB = SemanticCacheEnhancer.generateSemanticKey(
      'prompt',
      { text: 'hello world' },
      { ignoreCase: false }
    );

    expect(keyA).not.toBe(keyB);
  });

  it('calculates higher similarity for semantically close prompts', () => {
    const close = SemanticCacheEnhancer.calculateSimilarity(
      'Please generate a cinematic night city shot',
      'Generate cinematic night city shot please'
    );
    const far = SemanticCacheEnhancer.calculateSimilarity(
      'Cinematic night city shot',
      'Banana smoothie recipe with oats'
    );

    expect(close).toBeGreaterThan(far);
    expect(close).toBeGreaterThan(0.5);
  });

  it('returns optimization recommendations for low hit-rate workloads', () => {
    const recommendations = SemanticCacheEnhancer.getCacheOptimizationRecommendations({
      hitRate: '20',
      hits: 100,
      misses: 900,
      keys: 15000,
    });

    expect(recommendations.overall).toBe('needs-improvement');
    expect(recommendations.recommendations.length).toBeGreaterThan(0);
    expect(recommendations.recommendations.some((r) => r.priority === 'high')).toBe(true);
  });

  it('builds cache warming strategy with clustered prompts', () => {
    const strategy = SemanticCacheEnhancer.generateCacheWarmingStrategy([
      'Please generate cinematic mountain shot',
      'Generate cinematic mountain shot please',
      'Create abstract logo in blue',
    ]);

    expect(strategy.clusters).toBeGreaterThan(1);
    expect(strategy.prompts.length).toBeGreaterThan(1);
  });

  it('returns optimized cache config and default fallback config', () => {
    const known = SemanticCacheEnhancer.getOptimizedCacheConfig('prompt-optimization');
    const fallback = SemanticCacheEnhancer.getOptimizedCacheConfig('unknown-type');

    expect(known.namespace).toBe('prompt-opt');
    expect(known.useSemanticKeys).toBe(true);
    expect(fallback.namespace).toBe('default');
    expect(fallback.ttl).toBe(3600);
  });
});
