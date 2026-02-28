import { describe, expect, it } from 'vitest';
import { ContrastiveDiversityEnforcer } from '../ContrastiveDiversityEnforcer';
import type { AIService } from '../types';

function createService(): ContrastiveDiversityEnforcer {
  return new ContrastiveDiversityEnforcer({} as AIService);
}

describe('ContrastiveDiversityEnforcer regression', () => {
  it('treats synonym-level variants as highly similar', () => {
    const service = createService();

    const metrics = service.calculateDiversityMetrics([
      { text: 'whimsical charm' },
      { text: 'mischievous energy' },
    ]);

    expect(metrics.maxSimilarity).toBeGreaterThan(0.8);
    expect(metrics.avgSimilarity).toBeGreaterThan(0.8);
  });

  it('keeps unrelated suggestions low similarity', () => {
    const service = createService();

    const metrics = service.calculateDiversityMetrics([
      { text: 'wide drone establishing shot over coastline' },
      { text: 'macro lens detail of dew on flower petals' },
    ]);

    expect(metrics.maxSimilarity).toBeLessThan(0.35);
  });
});
