import { describe, it, expect } from 'vitest';
import { MatchConfidenceScorer } from '../MatchConfidenceScorer.js';

describe('MatchConfidenceScorer', () => {
  const scorer = new MatchConfidenceScorer();

  it('calculates base score using length and word count', () => {
    expect(scorer.calculateBaseScore({ length: 3, text: 'a' })).toBeGreaterThan(0);
    expect(scorer.calculateBaseScore({ length: 12, text: 'two words' })).toBeGreaterThan(60);
  });

  it('applies context boost based on category keywords', () => {
    const match = { text: 'golden hour', start: 0, end: 11, length: 11, isPhraseCategory: true };
    const surrounding = 'The lighting and light rays create a bright scene';
    const boost = scorer.calculateContextBoost(match, surrounding, 'lightingPhrases');
    expect(boost).toBeGreaterThan(0);
  });

  it('computes position score for sentence/paragraph starts', () => {
    const match = { text: 'Start', start: 0, end: 5 };
    expect(scorer.calculatePositionScore(match, 'Start of sentence')).toBeGreaterThan(0);
  });

  it('scores match end-to-end and filters by confidence', () => {
    const fullText = 'Golden hour lighting. Beautiful shot.';
    const matches = [
      { text: 'golden hour', start: 0, end: 11, length: 11, category: 'lightingPhrases' },
      { text: 'shot', start: 23, end: 27, length: 4, category: 'cameraPhrases' },
    ];
    const scored = scorer.filterByConfidence(matches, fullText, 50);
    expect(scored.length).toBeGreaterThan(0);
    expect(scored[0].confidence).toBeGreaterThanOrEqual(50);
  });

  it('maps numeric score to qualitative level', () => {
    expect(scorer.getConfidenceLevel(88)).toBe('very high');
    expect(scorer.getConfidenceLevel(72)).toBe('high');
    expect(scorer.getConfidenceLevel(57)).toBe('medium');
    expect(scorer.getConfidenceLevel(42)).toBe('low');
    expect(scorer.getConfidenceLevel(10)).toBe('very low');
  });
});
