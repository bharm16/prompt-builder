import { describe, it, expect } from 'vitest';
import { SeedPersistenceService } from '../SeedPersistenceService';

describe('SeedPersistenceService', () => {
  it('extracts seeds from replicate metrics', () => {
    const service = new SeedPersistenceService();
    const result = service.extractSeed('replicate', 'model-1', { metrics: { seed: 123 } });

    expect(result?.seed).toBe(123);
    expect(result?.provider).toBe('replicate');
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
  });
});
