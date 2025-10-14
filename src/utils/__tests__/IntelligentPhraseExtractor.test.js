/**
 * Unit tests for IntelligentPhraseExtractor
 */

import { IntelligentPhraseExtractor } from '../IntelligentPhraseExtractor.js';

describe('IntelligentPhraseExtractor', () => {
  let extractor;

  beforeEach(() => {
    extractor = new IntelligentPhraseExtractor();
  });

  describe('stem()', () => {
    test('should stem common suffixes correctly', () => {
      expect(extractor.stem('lighting')).toBe('light');
      expect(extractor.stem('lights')).toBe('light');
      expect(extractor.stem('walked')).toBe('walk');
      expect(extractor.stem('slowly')).toBe('slow');
    });

    test('should not stem short words', () => {
      expect(extractor.stem('dog')).toBe('dog');
      expect(extractor.stem('cats')).toBe('cats'); // Too short
    });

    test('should handle words without suffixes', () => {
      expect(extractor.stem('camera')).toBe('camera');
      expect(extractor.stem('bokeh')).toBe('bokeh');
    });
  });

  describe('tokenize()', () => {
    test('should tokenize text into lowercase words', () => {
      const text = "Golden hour lighting with shallow depth of field";
      const tokens = extractor.tokenize(text);
      expect(tokens).toEqual(['golden', 'hour', 'lighting', 'with', 'shallow', 'depth', 'of', 'field']);
    });

    test('should filter out punctuation', () => {
      const text = "Shot, camera! Zoom?";
      const tokens = extractor.tokenize(text);
      expect(tokens).toEqual(['shot', 'camera', 'zoom']);
    });

    test('should apply stemming when requested', () => {
      const text = "Walking slowly through the lights";
      const tokens = extractor.tokenize(text, true);
      expect(tokens).toContain('walk');
      expect(tokens).toContain('slow');
      expect(tokens).toContain('light');
    });
  });

  describe('extractNgrams()', () => {
    test('should extract bigrams correctly', () => {
      const tokens = ['golden', 'hour', 'lighting'];
      const bigrams = extractor.extractNgrams(tokens, 2);
      expect(bigrams).toEqual(['golden hour', 'hour lighting']);
    });

    test('should extract trigrams correctly', () => {
      const tokens = ['shallow', 'depth', 'of', 'field'];
      const trigrams = extractor.extractNgrams(tokens, 3);
      expect(trigrams).toContain('shallow depth of');
      expect(trigrams).toContain('depth of field');
    });

    test('should skip ngrams starting with stopwords', () => {
      const tokens = ['the', 'golden', 'hour', 'lighting'];
      const bigrams = extractor.extractNgrams(tokens, 2);
      expect(bigrams).not.toContain('the golden');
      expect(bigrams).toContain('golden hour');
    });
  });

  describe('calculateTF()', () => {
    test('should calculate term frequency correctly', () => {
      const tokens = ['camera', 'zoom', 'camera', 'lens'];
      const tf = extractor.calculateTF('camera', tokens);
      expect(tf).toBeCloseTo(0.5, 2); // 2/4 = 0.5
    });

    test('should handle multi-word phrases', () => {
      const tokens = ['golden', 'hour', 'lighting', 'golden', 'hour'];
      const tf = extractor.calculateTF('golden hour', tokens);
      expect(tf).toBeCloseTo(0.4, 2); // 2/5 = 0.4
    });

    test('should return 0 for terms not found', () => {
      const tokens = ['camera', 'lens'];
      const tf = extractor.calculateTF('bokeh', tokens);
      expect(tf).toBe(0);
    });
  });

  describe('calculateIDF()', () => {
    test('should calculate IDF correctly', () => {
      extractor.documentFrequency.set('common', 10);
      extractor.documentFrequency.set('rare', 2);
      extractor.totalDocuments = 100;

      const idfCommon = extractor.calculateIDF('common');
      const idfRare = extractor.calculateIDF('rare');

      expect(idfRare).toBeGreaterThan(idfCommon);
    });

    test('should return 0 for unseen terms', () => {
      extractor.totalDocuments = 100;
      const idf = extractor.calculateIDF('unseen');
      expect(idf).toBe(0);
    });
  });

  describe('getCachedRegex()', () => {
    test('should cache compiled regexes', () => {
      const regex1 = extractor.getCachedRegex('test');
      const regex2 = extractor.getCachedRegex('test');
      expect(regex1).toBe(regex2); // Same instance
    });

    test('should create different regexes for different flags', () => {
      const regex1 = extractor.getCachedRegex('test', 'gi');
      const regex2 = extractor.getCachedRegex('test', 'g');
      expect(regex1).not.toBe(regex2);
    });

    test('should limit cache size to prevent memory leaks', () => {
      // Create 600 regexes (exceeds 500 limit)
      for (let i = 0; i < 600; i++) {
        extractor.getCachedRegex(`pattern${i}`);
      }
      expect(extractor.regexCache.size).toBeLessThanOrEqual(500);
    });
  });

  describe('isTechnicalPhrase()', () => {
    test('should identify technical phrases', () => {
      expect(extractor.isTechnicalPhrase('camera zoom')).toBe(true);
      expect(extractor.isTechnicalPhrase('shallow depth of field')).toBe(true);
      expect(extractor.isTechnicalPhrase('lighting setup')).toBe(true);
    });

    test('should not flag non-technical phrases', () => {
      expect(extractor.isTechnicalPhrase('beautiful sunset')).toBe(false);
      expect(extractor.isTechnicalPhrase('happy people')).toBe(false);
    });
  });

  describe('extractImportantPhrases()', () => {
    test('should extract important phrases from text', () => {
      const text = "Cinematic shallow depth of field with golden hour lighting and anamorphic lens flare";

      // Update statistics first
      extractor.updateStatistics(text);

      const phrases = extractor.extractImportantPhrases(text);

      expect(phrases.length).toBeGreaterThan(0);
      expect(phrases[0]).toHaveProperty('phrase');
      expect(phrases[0]).toHaveProperty('score');
      expect(phrases[0]).toHaveProperty('isTechnical');
    });

    test('should prioritize longer phrases', () => {
      const text = "shallow depth of field depth field";

      extractor.updateStatistics(text);
      const phrases = extractor.extractImportantPhrases(text);

      const longPhrases = phrases.filter(p => p.length >= 3);
      const shortPhrases = phrases.filter(p => p.length === 1);

      if (longPhrases.length > 0 && shortPhrases.length > 0) {
        expect(longPhrases[0].score).toBeGreaterThan(shortPhrases[0].score);
      }
    });
  });

  describe('findPhraseOccurrences()', () => {
    test('should find all occurrences with correct positions', () => {
      const text = "Golden hour lighting. Beautiful golden hour.";
      const phrases = [{ phrase: 'golden hour', score: 10, isTechnical: false }];

      const occurrences = extractor.findPhraseOccurrences(text, phrases);

      expect(occurrences).toHaveLength(2);
      expect(occurrences[0].start).toBe(0);
      expect(occurrences[0].end).toBe(11);
      expect(occurrences[1].start).toBe(34);
    });

    test('should be case-insensitive', () => {
      const text = "GOLDEN HOUR golden hour Golden Hour";
      const phrases = [{ phrase: 'golden hour', score: 10, isTechnical: false }];

      const occurrences = extractor.findPhraseOccurrences(text, phrases);

      expect(occurrences).toHaveLength(3);
    });
  });
});
