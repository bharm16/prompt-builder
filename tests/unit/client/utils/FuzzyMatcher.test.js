import { describe, it, expect } from 'vitest';
import { FuzzyMatcher } from '../FuzzyMatcher.js';

describe('FuzzyMatcher', () => {
  const matcher = new FuzzyMatcher();

  describe('levenshteinDistance', () => {
    it('computes zero for identical strings', () => {
      expect(matcher.levenshteinDistance('camera', 'camera')).toBe(0);
    });

    it('computes expected distance for simple edits', () => {
      expect(matcher.levenshteinDistance('kitten', 'sitting')).toBe(3);
      expect(matcher.levenshteinDistance('bokeh', 'bokah')).toBe(1);
    });
  });

  describe('isFuzzyMatch', () => {
    it('returns true for exact match', () => {
      expect(matcher.isFuzzyMatch('Bokeh', 'bokeh')).toBe(true);
    });

    it('returns true for known common typos', () => {
      expect(matcher.isFuzzyMatch('bokhe', 'bokeh')).toBe(true);
      expect(matcher.isFuzzyMatch('anamophic', 'anamorphic')).toBe(true);
    });

    it('uses edit distance thresholds for longer words', () => {
      expect(matcher.isFuzzyMatch('lighting', 'lighitng')).toBe(true);
      expect(matcher.isFuzzyMatch('shadow', 'shaddow')).toBe(true);
    });

    it('requires exact match for very short words', () => {
      expect(matcher.isFuzzyMatch('an', 'a')).toBe(false);
    });
  });

  describe('autoCorrect', () => {
    it('replaces known typos within a sentence', () => {
      const text = 'Beautiful bokhe with depth of feild and anamophic lens';
      const corrected = matcher.autoCorrect(text);
      expect(corrected).toContain('bokeh');
      expect(corrected).toContain('depth of field');
      expect(corrected).toContain('anamorphic');
    });
  });

  describe('findBestMatch', () => {
    it('finds closest candidate and confidence', () => {
      const candidates = ['lighting', 'shadow', 'bokeh'];
      const result = matcher.findBestMatch('bokah', candidates);
      expect(result.match).toBe('bokeh');
      expect(result.distance).toBeGreaterThanOrEqual(1);
      expect(result.isGoodMatch).toBe(true);
      expect(result.confidence).toBeGreaterThanOrEqual(0);
    });
  });

  describe('suggestCorrections', () => {
    it('returns suggestions for words with known typos', () => {
      const out = matcher.suggestCorrections('Nice bokhe effect', []);
      expect(out).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ original: 'bokhe', suggested: 'bokeh' })
        ])
      );
      expect(out.length).toBeGreaterThan(0);
    });
  });
});
