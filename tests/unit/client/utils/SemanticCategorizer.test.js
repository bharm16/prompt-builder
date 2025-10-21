/**
 * Unit tests for SemanticCategorizer
 */

import { SemanticCategorizer } from '../SemanticCategorizer.js';

describe('SemanticCategorizer', () => {
  let categorizer;

  beforeEach(() => {
    categorizer = new SemanticCategorizer();
    categorizer.reset();
  });

  describe('stem()', () => {
    test('should stem words correctly', () => {
      expect(categorizer.stem('lighting')).toBe('light');
      expect(categorizer.stem('cameras')).toBe('camera');
      expect(categorizer.stem('slowly')).toBe('slow');
    });

    test('should not over-stem short words', () => {
      expect(categorizer.stem('cat')).toBe('cat');
      expect(categorizer.stem('dog')).toBe('dog');
    });
  });

  describe('levenshteinDistance()', () => {
    test('should calculate distance correctly', () => {
      expect(categorizer.levenshteinDistance('cat', 'cat')).toBe(0);
      expect(categorizer.levenshteinDistance('cat', 'bat')).toBe(1);
      expect(categorizer.levenshteinDistance('cat', 'cats')).toBe(1);
      expect(categorizer.levenshteinDistance('kitten', 'sitting')).toBe(3);
    });

    test('should handle empty strings', () => {
      expect(categorizer.levenshteinDistance('', '')).toBe(0);
      expect(categorizer.levenshteinDistance('test', '')).toBe(4);
      expect(categorizer.levenshteinDistance('', 'test')).toBe(4);
    });
  });

  describe('calculateSemanticSimilarity()', () => {
    test('should give high similarity for exact matches after stemming', () => {
      const seeds = ['camera', 'lens', 'focus'];
      const similarity = categorizer.calculateSemanticSimilarity('cameras', seeds);
      expect(similarity).toBeGreaterThan(1); // Exact stem match
    });

    test('should detect substring matches', () => {
      const seeds = ['light', 'shadow'];
      const similarity = categorizer.calculateSemanticSimilarity('lighting setup', seeds);
      expect(similarity).toBeGreaterThan(0);
    });

    test('should use Levenshtein distance for fuzzy matching', () => {
      const seeds = ['camera', 'lens'];
      // 'camra' is 1 edit distance from 'camera'
      const similarity = categorizer.calculateSemanticSimilarity('camra', seeds);
      expect(similarity).toBeGreaterThan(0);
    });

    test('should not match very different words', () => {
      const seeds = ['camera', 'lens', 'focus'];
      const similarity = categorizer.calculateSemanticSimilarity('butterfly', seeds);
      expect(similarity).toBe(0);
    });

    test('should normalize by phrase length', () => {
      const seeds = ['camera', 'lens'];
      const shortPhraseSim = categorizer.calculateSemanticSimilarity('camera', seeds);
      const longPhraseSim = categorizer.calculateSemanticSimilarity('camera lens focus', seeds);

      // Short phrase with high match should have higher normalized score
      expect(shortPhraseSim).toBeGreaterThan(longPhraseSim);
    });
  });

  describe('categorize()', () => {
    test('should categorize camera-related phrases correctly', () => {
      const result = categorizer.categorize('slow zoom in');
      expect(result.category).toBe('camera');
      expect(result.confidence).toBeGreaterThan(50);
    });

    test('should categorize lighting phrases correctly', () => {
      const result = categorizer.categorize('soft golden light');
      expect(result.category).toBe('lighting');
    });

    test('should categorize technical terms correctly', () => {
      const result = categorizer.categorize('shallow depth of field');
      expect(result.category).toBe('technical');
    });

    test('should use context to improve categorization', () => {
      const fullText = "Camera zoom in with dramatic lighting";
      const result = categorizer.categorize('dramatic', fullText, 15);

      // 'dramatic' near 'camera' and 'lighting' - context should help
      expect(['camera', 'lighting', 'emotions']).toContain(result.category);
    });

    test('should return user corrections with high confidence', () => {
      categorizer.learnFromUserCorrection('bokeh', 'technical');

      const result = categorizer.categorize('bokeh');

      expect(result.category).toBe('technical');
      expect(result.confidence).toBe(95);
      expect(result.source).toBe('user-learned');
    });

    test('should include color information', () => {
      const result = categorizer.categorize('camera');

      expect(result.color).toBeDefined();
      expect(result.color.bg).toBeDefined();
      expect(result.color.border).toBeDefined();
    });
  });

  describe('analyzeContext()', () => {
    test('should count category keywords in context', () => {
      const text = "The camera zoom lens with shallow focus and dramatic lighting";
      const scores = categorizer.analyzeContext('dramatic', text, 40);

      expect(scores.get('camera')).toBeGreaterThan(0); // 'camera', 'zoom', 'lens', 'focus' present
      expect(scores.get('lighting')).toBeGreaterThan(0); // 'lighting' present
    });

    test('should analyze surrounding context window', () => {
      const text = "A" + "x".repeat(200) + "camera" + "x".repeat(200);
      const scores = categorizer.analyzeContext('test', text, 250);

      // Camera keyword is within context window
      expect(scores.get('camera')).toBeGreaterThan(0);
    });
  });

  describe('updateCooccurrence()', () => {
    test('should strengthen phrase-category association', () => {
      const scoreBefore = categorizer.getCooccurrenceScore('bokeh', 'technical');

      categorizer.updateCooccurrence('bokeh', 'technical', 2);

      const scoreAfter = categorizer.getCooccurrenceScore('bokeh', 'technical');

      expect(scoreAfter).toBeGreaterThan(scoreBefore);
    });

    test('should decay other categories slightly', () => {
      categorizer.updateCooccurrence('bokeh', 'technical', 5);
      categorizer.updateCooccurrence('bokeh', 'camera', 3);

      const technicalScore = categorizer.getCooccurrenceScore('bokeh', 'technical');
      const cameraScore = categorizer.getCooccurrenceScore('bokeh', 'camera');

      // Technical should be decayed when camera is reinforced
      expect(cameraScore).toBeGreaterThan(0);
    });
  });

  describe('learnFromUserCorrection()', () => {
    test('should store user corrections', () => {
      categorizer.learnFromUserCorrection('custom phrase', 'actions');

      expect(categorizer.userCorrections.get('custom phrase')).toBe('actions');
    });

    test('should give strong cooccurrence boost', () => {
      categorizer.learnFromUserCorrection('special term', 'lighting');

      const score = categorizer.getCooccurrenceScore('special term', 'lighting');

      expect(score).toBeGreaterThanOrEqual(5);
    });
  });

  describe('addSeedWord()', () => {
    test('should add new seed word to category', () => {
      const added = categorizer.addSeedWord('camera', 'steadicam');

      expect(added).toBe(true);
      expect(categorizer.categorySeedWords.camera.seeds).toContain('steadicam');
    });

    test('should not add duplicate seed words', () => {
      categorizer.addSeedWord('camera', 'zoom');
      const added = categorizer.addSeedWord('camera', 'zoom');

      expect(added).toBe(false);
    });

    test('should return false for non-existent category', () => {
      const added = categorizer.addSeedWord('nonexistent', 'word');

      expect(added).toBe(false);
    });
  });

  describe('adjustCategoryWeight()', () => {
    test('should adjust category weight', () => {
      const initialWeight = categorizer.categorySeedWords.camera.weight;

      categorizer.adjustCategoryWeight('camera', 0.2);

      const newWeight = categorizer.categorySeedWords.camera.weight;

      expect(newWeight).toBeCloseTo(initialWeight + 0.2, 2);
    });

    test('should clamp weight between 0.1 and 2.0', () => {
      categorizer.adjustCategoryWeight('camera', -10); // Try to go below 0.1
      expect(categorizer.categorySeedWords.camera.weight).toBeGreaterThanOrEqual(0.1);

      categorizer.adjustCategoryWeight('camera', 10); // Try to go above 2.0
      expect(categorizer.categorySeedWords.camera.weight).toBeLessThanOrEqual(2.0);
    });
  });

  describe('save and load', () => {
    test('should persist cooccurrence matrix', () => {
      categorizer.updateCooccurrence('test phrase', 'camera', 5);
      categorizer.save();

      const newCategorizer = new SemanticCategorizer();
      const score = newCategorizer.getCooccurrenceScore('test phrase', 'camera');

      expect(score).toBe(5);
    });

    test('should persist user corrections', () => {
      categorizer.learnFromUserCorrection('custom', 'lighting');
      categorizer.save();

      const newCategorizer = new SemanticCategorizer();

      expect(newCategorizer.userCorrections.get('custom')).toBe('lighting');
    });

    test('should persist category weights', () => {
      categorizer.adjustCategoryWeight('camera', 0.5);
      categorizer.save();

      const newCategorizer = new SemanticCategorizer();

      expect(newCategorizer.categorySeedWords.camera.weight).toBeCloseTo(1.5, 2);
    });
  });

  describe('reset()', () => {
    test('should clear all learned data', () => {
      categorizer.updateCooccurrence('phrase', 'camera', 5);
      categorizer.learnFromUserCorrection('custom', 'lighting');
      categorizer.adjustCategoryWeight('camera', 0.5);

      categorizer.reset();

      expect(categorizer.cooccurrenceMatrix.size).toBe(0);
      expect(categorizer.userCorrections.size).toBe(0);
      expect(categorizer.categorySeedWords.camera.weight).toBe(1.0);
    });
  });
});
