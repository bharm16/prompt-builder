import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { QualityFeedbackSystem } from '../QualityFeedbackSystem.js';

vi.mock('../../infrastructure/Logger.js', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('QualityFeedbackSystem', () => {
  let qfs;

  beforeEach(() => {
    vi.clearAllMocks();
    qfs = new QualityFeedbackSystem();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('extracts features and predicts suggestion quality', async () => {
    const suggestion = 'Create a clear, specific plan: 1) define goals 2) implement steps';
    const prediction = await qfs.predictSuggestionQuality(suggestion, { domain: 'technical', expectedLength: 80 }, 'svc');
    expect(prediction).toBeGreaterThan(0);
    expect(prediction).toBeLessThanOrEqual(1);
  });

  it('tracks suggestion quality and updates model when enough data', async () => {
    const service = 'svc';
    for (let i = 0; i < 12; i++) {
      await qfs.trackSuggestionQuality({
        suggestionId: `id-${i}`,
        suggestion: 'Implement feature X with clear steps and examples',
        wasAccepted: i % 2 === 0,
        finalOutput: 'Result complete with examples and steps',
        context: { domain: 'technical', expectedLength: 120 },
        service,
      });
    }
    const stats = qfs.getQualityStatistics(service);
    expect(stats.totalFeedback).toBeGreaterThan(0);
    expect(stats.averageQuality).toBeGreaterThan(0);
  });

  it('resets learning per service', () => {
    const service = 'svc2';
    qfs.resetLearning(service);
    const stats = qfs.getQualityStatistics(service);
    expect(stats.totalFeedback).toBe(0);
  });
});
