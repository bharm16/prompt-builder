import { describe, it, expect } from 'vitest';
import { AdaptivePatternEngine } from '../AdaptivePatternEngine.js';

describe('AdaptivePatternEngine', () => {
  it('resolveOverlaps prefers higher confidence and longer matches', () => {
    const engine = new AdaptivePatternEngine();
    const overlaps = [
      { phrase: 'golden hour', start: 0, end: 10, length: 10, confidence: 70 },
      { phrase: 'golden', start: 0, end: 6, length: 6, confidence: 90 }, // higher confidence
      { phrase: 'hour', start: 4, end: 8, length: 4, confidence: 60 },
    ];
    const resolved = engine.resolveOverlaps(overlaps);
    // Picks the high confidence 'golden' over longer 'golden hour'
    expect(resolved.find(m => m.phrase === 'golden')).toBeTruthy();
    expect(resolved.length).toBe(1);
  });

  it('processText integrates extractor/categorizer/learner pipelines', () => {
    const engine = new AdaptivePatternEngine();
    // Stub subsystems for determinism
    engine.fuzzy = { autoCorrect: (t) => t };
    engine.extractor = {
      extractImportantPhrases: () => [
        { phrase: 'golden hour', score: 0.5 },
        { phrase: 'bokeh', score: 0.3 },
      ],
      findPhraseOccurrences: () => [
        { phrase: 'golden hour', start: 0, end: 11, length: 11 },
        { phrase: 'bokeh', start: 20, end: 25, length: 5 },
      ],
      getStatistics: () => ({ totalDocuments: 100 })
    };
    engine.categorizer = {
      categorize: () => ({ category: 'lighting', confidence: 80, color: '#f90' }),
      getStatistics: () => ({ categories: 1 })
    };
    engine.learner = {
      adjustConfidence: (_p, _c, base) => base + 5,
      shouldShow: () => true,
      getStatistics: () => ({ shown: 1 })
    };

    const text = 'golden hour ambiance with nice bokeh';
    const out = engine.processText(text);
    expect(out.matches.length).toBeGreaterThan(0);
    expect(out.stats.finalHighlights).toBe(out.matches.length);
  });

  it('configure and getConfiguration set/return proper values', () => {
    const engine = new AdaptivePatternEngine();
    engine.configure({ minConfidence: 75, maxHighlights: 10, learningRate: 0.2, explorationRate: 0.3 });
    const cfg = engine.getConfiguration();
    expect(cfg.minConfidence).toBe(75);
    expect(cfg.maxHighlights).toBe(10);
    expect(cfg.learningRate).toBeDefined();
    expect(cfg.explorationRate).toBeDefined();
  });
});
