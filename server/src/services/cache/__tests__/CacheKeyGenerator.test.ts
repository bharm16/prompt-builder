import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CacheKeyGenerator } from '../CacheKeyGenerator';

// Mock the logger
vi.mock('@infrastructure/Logger', () => ({
  logger: {
    child: vi.fn(() => ({
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    })),
  },
}));

describe('CacheKeyGenerator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('error handling', () => {
    it('handles undefined data values in JSON serialization', () => {
      const generator = new CacheKeyGenerator();
      const data = { key: undefined, other: 'value' };

      // JSON.stringify converts undefined to null in objects
      const key = generator.generate('test', data);

      expect(key).toMatch(/^test:[a-f0-9]{16}$/);
    });

    it('handles circular reference detection by throwing', () => {
      const generator = new CacheKeyGenerator();
      const data: Record<string, unknown> = { name: 'test' };
      data.self = data;

      expect(() => generator.generate('test', data)).toThrow();
    });

    it('handles semantic enhancer that throws', () => {
      const badEnhancer = {
        generateSemanticKey: vi.fn().mockImplementation(() => {
          throw new Error('Semantic generation failed');
        }),
      };
      const generator = new CacheKeyGenerator({ semanticEnhancer: badEnhancer });

      expect(() => generator.generate('test', { prompt: 'hello' })).toThrow('Semantic generation failed');
    });

    it('handles semantic enhancer that returns non-string', () => {
      const badEnhancer = {
        generateSemanticKey: vi.fn().mockReturnValue(123),
      };
      const generator = new CacheKeyGenerator({ semanticEnhancer: badEnhancer });

      // Should return the non-string value (type checking is caller's responsibility)
      const key = generator.generate('test', { prompt: 'hello' });
      expect(key).toBe(123);
    });
  });

  describe('edge cases', () => {
    it('generates same key for same data', () => {
      const generator = new CacheKeyGenerator();
      const data = { prompt: 'test prompt', model: 'gpt-4' };

      const key1 = generator.generate('namespace', data);
      const key2 = generator.generate('namespace', data);

      expect(key1).toBe(key2);
    });

    it('generates different keys for different data', () => {
      const generator = new CacheKeyGenerator();

      const key1 = generator.generate('namespace', { prompt: 'one' });
      const key2 = generator.generate('namespace', { prompt: 'two' });

      expect(key1).not.toBe(key2);
    });

    it('generates different keys for different namespaces', () => {
      const generator = new CacheKeyGenerator();
      const data = { prompt: 'same' };

      const key1 = generator.generate('namespace1', data);
      const key2 = generator.generate('namespace2', data);

      expect(key1).not.toBe(key2);
      expect(key1.startsWith('namespace1:')).toBe(true);
      expect(key2.startsWith('namespace2:')).toBe(true);
    });

    it('handles empty data object', () => {
      const generator = new CacheKeyGenerator();

      const key = generator.generate('test', {});

      expect(key).toMatch(/^test:[a-f0-9]{16}$/);
    });

    it('handles empty namespace', () => {
      const generator = new CacheKeyGenerator();

      const key = generator.generate('', { data: 'value' });

      expect(key).toMatch(/^:[a-f0-9]{16}$/);
    });

    it('handles deeply nested data', () => {
      const generator = new CacheKeyGenerator();
      const data = {
        level1: {
          level2: {
            level3: {
              value: 'deep',
            },
          },
        },
      };

      const key = generator.generate('test', data);

      expect(key).toMatch(/^test:[a-f0-9]{16}$/);
    });

    it('handles special characters in data', () => {
      const generator = new CacheKeyGenerator();
      const data = {
        emoji: '🎬',
        unicode: '中文',
        special: '\n\t\r',
      };

      const key = generator.generate('test', data);

      expect(key).toMatch(/^test:[a-f0-9]{16}$/);
    });
  });

  describe('semantic enhancer integration', () => {
    it('uses semantic enhancer when available and useSemantic is true', () => {
      const semanticEnhancer = {
        generateSemanticKey: vi.fn().mockReturnValue('semantic:key'),
      };
      const generator = new CacheKeyGenerator({ semanticEnhancer });

      const key = generator.generate('test', { prompt: 'hello' });

      expect(semanticEnhancer.generateSemanticKey).toHaveBeenCalledWith(
        'test',
        { prompt: 'hello' },
        expect.objectContaining({
          normalizeWhitespace: true,
          ignoreCase: true,
          sortKeys: true,
        })
      );
      expect(key).toBe('semantic:key');
    });

    it('skips semantic enhancer when useSemantic is false', () => {
      const semanticEnhancer = {
        generateSemanticKey: vi.fn().mockReturnValue('semantic:key'),
      };
      const generator = new CacheKeyGenerator({ semanticEnhancer });

      const key = generator.generate('test', { prompt: 'hello' }, { useSemantic: false });

      expect(semanticEnhancer.generateSemanticKey).not.toHaveBeenCalled();
      expect(key).toMatch(/^test:[a-f0-9]{16}$/);
    });

    it('falls back to standard key when no semantic enhancer', () => {
      const generator = new CacheKeyGenerator();

      const key = generator.generate('test', { prompt: 'hello' });

      expect(key).toMatch(/^test:[a-f0-9]{16}$/);
    });

    it('passes custom options to semantic enhancer', () => {
      const semanticEnhancer = {
        generateSemanticKey: vi.fn().mockReturnValue('key'),
      };
      const generator = new CacheKeyGenerator({ semanticEnhancer });

      generator.generate(
        'test',
        { prompt: 'hello' },
        {
          normalizeWhitespace: false,
          ignoreCase: false,
          sortKeys: false,
        }
      );

      expect(semanticEnhancer.generateSemanticKey).toHaveBeenCalledWith(
        'test',
        { prompt: 'hello' },
        {
          normalizeWhitespace: false,
          ignoreCase: false,
          sortKeys: false,
        }
      );
    });
  });

  describe('core behavior', () => {
    it('generates 16-character hex hash', () => {
      const generator = new CacheKeyGenerator();

      const key = generator.generate('ns', { data: 'test' });
      const parts = key.split(':');
      const namespace = parts[0];
      const hash = parts[1] ?? '';

      expect(namespace).toBe('ns');
      expect(hash).toHaveLength(16);
      expect(/^[a-f0-9]{16}$/.test(hash)).toBe(true);
    });

    it('uses SHA-256 for deterministic hashing', () => {
      const generator = new CacheKeyGenerator();

      // Same input should always produce same output
      const results = new Set<string>();
      for (let i = 0; i < 100; i++) {
        results.add(generator.generate('test', { value: 'consistent' }));
      }

      expect(results.size).toBe(1);
    });

    it('handles arrays in data', () => {
      const generator = new CacheKeyGenerator();
      const data = { items: [1, 2, 3], tags: ['a', 'b'] };

      const key = generator.generate('test', data);

      expect(key).toMatch(/^test:[a-f0-9]{16}$/);
    });

    it('produces different keys for different array orders', () => {
      const generator = new CacheKeyGenerator();

      const key1 = generator.generate('test', { items: [1, 2, 3] });
      const key2 = generator.generate('test', { items: [3, 2, 1] });

      expect(key1).not.toBe(key2);
    });
  });
});
