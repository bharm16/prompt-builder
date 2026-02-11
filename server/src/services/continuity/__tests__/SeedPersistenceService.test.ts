import { describe, it, expect } from 'vitest';
import { SeedPersistenceService } from '../SeedPersistenceService';

describe('SeedPersistenceService', () => {
  it('extracts direct seed values from generic provider results', () => {
    const service = new SeedPersistenceService();
    const result = service.extractSeed('runway', 'model-1', { seed: 77 });

    expect(result).toBeTruthy();
    expect(result?.seed).toBe(77);
    expect(result?.provider).toBe('runway');
    expect(result?.modelId).toBe('model-1');
    expect(result?.extractedAt).toEqual(expect.any(Date));
  });

  it('extracts seeds from replicate metrics', () => {
    const service = new SeedPersistenceService();
    const result = service.extractSeed('replicate', 'model-1', { metrics: { seed: 123 } });

    expect(result?.seed).toBe(123);
    expect(result?.provider).toBe('replicate');
  });

  it('returns null when generation result does not contain a seed', () => {
    const service = new SeedPersistenceService();
    const result = service.extractSeed('replicate', 'model-1', { metrics: {} });

    expect(result).toBeNull();
  });

  it('builds provider seed params and omits undefined seeds', () => {
    const service = new SeedPersistenceService();

    expect(service.buildSeedParam('replicate', 42)).toEqual({ seed: 42 });
    expect(service.buildSeedParam('runway', 88)).toEqual({ seed: 88 });
    expect(service.buildSeedParam('replicate', undefined)).toEqual({});
  });

  it('inherits seed only when provider matches', () => {
    const service = new SeedPersistenceService();
    const seedInfo = {
      seed: 42,
      provider: 'replicate',
      modelId: 'model-1',
      extractedAt: new Date(),
    };

    expect(service.getInheritedSeed(seedInfo, 'replicate')).toBe(42);
    expect(service.getInheritedSeed(seedInfo, 'runway')).toBeUndefined();
    expect(service.getInheritedSeed(undefined, 'replicate')).toBeUndefined();
  });
});
