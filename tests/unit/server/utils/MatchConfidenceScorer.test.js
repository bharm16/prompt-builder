import { describe, it, expect, beforeEach } from 'vitest';
import { MatchConfidenceScorer, confidenceScorer } from '../../../../server/src/utils/MatchConfidenceScorer.js';

describe('MatchConfidenceScorer', () => {
  let scorer;

  beforeEach(() => {
    scorer = new MatchConfidenceScorer();
  });

  describe('constructor', () => {
    it('should initialize with category keywords', () => {
      expect(scorer.categoryKeywords).toBeDefined();
      expect(scorer.categoryKeywords).toHaveProperty('camera');
      expect(scorer.categoryKeywords).toHaveProperty('lighting');
      expect(scorer.categoryKeywords).toHaveProperty('atmospheric');
      expect(scorer.categoryKeywords).toHaveProperty('technical');
      expect(scorer.categoryKeywords).toHaveProperty('action');
    });

    it('should have arrays of keywords for each category', () => {
      Object.values(scorer.categoryKeywords).forEach(keywords => {
        expect(Array.isArray(keywords)).toBe(true);
        expect(keywords.length).toBeGreaterThan(0);
      });
    });
  });

  describe('calculateBaseScore', () => {
    it('should return base score of 60 for simple matches', () => {
      const match = { text: 'test', length: 4, isPhraseCategory: false };
      const score = scorer.calculateBaseScore(match);

      expect(score).toBeGreaterThanOrEqual(60);
    });

    it('should add 15 points for very long matches (>20 chars)', () => {
      const match = { text: 'a'.repeat(21), length: 21, isPhraseCategory: false };
      const score = scorer.calculateBaseScore(match);

      expect(score).toBe(75); // 60 base + 15 for length
    });

    it('should add 10 points for long matches (>10 chars)', () => {
      const match = { text: 'medium text', length: 11, isPhraseCategory: false };
      const score = scorer.calculateBaseScore(match);

      expect(score).toBe(70); // 60 base + 10 for length
    });

    it('should add 5 points for moderate matches (>5 chars)', () => {
      const match = { text: 'short', length: 6, isPhraseCategory: false };
      const score = scorer.calculateBaseScore(match);

      expect(score).toBe(65); // 60 base + 5 for length
    });

    it('should add 10 points for phrase categories', () => {
      const match = { text: 'test', length: 4, isPhraseCategory: true };
      const score = scorer.calculateBaseScore(match);

      expect(score).toBe(70); // 60 base + 10 for phrase category
    });

    it('should add 10 points for 3+ word matches', () => {
      const match = { text: 'wide angle shot', length: 15, isPhraseCategory: false };
      const score = scorer.calculateBaseScore(match);

      // 60 base + 10 for length (>10) + 10 for multi-word
      expect(score).toBe(80);
    });

    it('should add 5 points for 2 word matches', () => {
      const match = { text: 'wide shot', length: 9, isPhraseCategory: false };
      const score = scorer.calculateBaseScore(match);

      // 60 base + 5 for 2 words + 5 for length (>5)
      expect(score).toBe(70);
    });

    it('should cap score at 100', () => {
      const match = {
        text: 'a very long phrase with many words exceeding twenty characters',
        length: 63,
        isPhraseCategory: true
      };

      const score = scorer.calculateBaseScore(match);

      expect(score).toBe(100);
    });

    it('should handle empty text', () => {
      const match = { text: '', length: 0, isPhraseCategory: false };
      const score = scorer.calculateBaseScore(match);

      expect(score).toBe(60); // Just base score
    });

    it('should combine multiple bonuses correctly', () => {
      const match = {
        text: 'dramatic camera movement',
        length: 24,
        isPhraseCategory: true
      };

      const score = scorer.calculateBaseScore(match);

      // 60 base + 15 (>20 chars) + 10 (phrase) + 10 (3+ words) = 95
      expect(score).toBe(95);
    });
  });

  describe('calculateContextBoost', () => {
    it('should return 0 for no keyword matches', () => {
      const match = { text: 'test', category: 'camera' };
      const surroundingText = 'generic text with no keywords';

      const boost = scorer.calculateContextBoost(match, surroundingText, 'camera');

      expect(boost).toBe(0);
    });

    it('should add 5 points for 1 keyword match', () => {
      const match = { text: 'test', category: 'camera' };
      const surroundingText = 'use camera to film the scene';

      const boost = scorer.calculateContextBoost(match, surroundingText, 'camera');

      expect(boost).toBe(5);
    });

    it('should add 10 points for 2 keyword matches', () => {
      const match = { text: 'test', category: 'camera' };
      const surroundingText = 'camera shot with lens focus';

      const boost = scorer.calculateContextBoost(match, surroundingText, 'camera');

      expect(boost).toBe(10);
    });

    it('should add 15 points for 3+ keyword matches', () => {
      const match = { text: 'test', category: 'camera' };
      const surroundingText = 'camera shot with lens and angle adjustments';

      const boost = scorer.calculateContextBoost(match, surroundingText, 'camera');

      expect(boost).toBe(15);
    });

    it('should be case-insensitive', () => {
      const match = { text: 'test', category: 'camera' };
      const surroundingText = 'CAMERA SHOT with LENS';

      const boost = scorer.calculateContextBoost(match, surroundingText, 'camera');

      expect(boost).toBe(10); // 2 keywords
    });

    it('should handle Phrases suffix in category name', () => {
      const match = { text: 'test', category: 'cameraPhrases' };
      const surroundingText = 'camera shot';

      const boost = scorer.calculateContextBoost(match, surroundingText, 'cameraPhrases');

      expect(boost).toBeGreaterThan(0);
    });

    it('should work with lighting category keywords', () => {
      const match = { text: 'test', category: 'lighting' };
      const surroundingText = 'soft light creating shadows and illuminating the scene';

      const boost = scorer.calculateContextBoost(match, surroundingText, 'lighting');

      expect(boost).toBe(15); // 3+ keywords: light, shadow, illuminat
    });

    it('should work with technical category keywords', () => {
      const match = { text: 'test', category: 'technical' };
      const surroundingText = 'depth of field with aperture control';

      const boost = scorer.calculateContextBoost(match, surroundingText, 'technical');

      expect(boost).toBe(10); // 2 keywords: depth, aperture
    });

    it('should return 0 for unknown category', () => {
      const match = { text: 'test', category: 'unknown' };
      const surroundingText = 'some text here';

      const boost = scorer.calculateContextBoost(match, surroundingText, 'unknown');

      expect(boost).toBe(0);
    });

    it('should handle partial keyword matches', () => {
      const match = { text: 'test', category: 'lighting' };
      // 'illuminat' should match 'illuminating'
      const surroundingText = 'illuminating the subject';

      const boost = scorer.calculateContextBoost(match, surroundingText, 'lighting');

      expect(boost).toBe(5); // 1 keyword
    });
  });

  describe('calculatePositionScore', () => {
    it('should add 5 points for match at start of text', () => {
      const match = { start: 0, end: 10 };
      const fullText = 'test match here';

      const score = scorer.calculatePositionScore(match, fullText);

      expect(score).toBe(5);
    });

    it('should add 5 points for match after sentence boundary', () => {
      const match = { start: 13, end: 20 };
      const fullText = 'First sentence. Match here';

      const score = scorer.calculatePositionScore(match, fullText);

      expect(score).toBe(5);
    });

    it('should add 3 points for match at paragraph start', () => {
      const match = { start: 11, end: 15 };
      const fullText = 'Some text\n\ntest here';

      const score = scorer.calculatePositionScore(match, fullText);

      expect(score).toBeGreaterThanOrEqual(3);
    });

    it('should return 0 for match in middle of sentence', () => {
      const match = { start: 10, end: 15 };
      const fullText = 'Text with match in middle';

      const score = scorer.calculatePositionScore(match, fullText);

      expect(score).toBe(0);
    });

    it('should handle exclamation and question marks as sentence boundaries', () => {
      const match1 = { start: 10, end: 15 };
      const text1 = 'Question? Match';

      const score1 = scorer.calculatePositionScore(match1, text1);
      expect(score1).toBe(5);

      const match2 = { start: 12, end: 17 };
      const text2 = 'Exclamation! Match';

      const score2 = scorer.calculatePositionScore(match2, text2);
      expect(score2).toBe(5);
    });

    it('should add both sentence and paragraph bonuses', () => {
      const match = { start: 11, end: 15 };
      const fullText = 'Sentence.\n\nMatch';

      const score = scorer.calculatePositionScore(match, fullText);

      expect(score).toBe(8); // 5 for sentence + 3 for paragraph
    });
  });

  describe('scoreMatch', () => {
    it('should combine base score, context boost, and position score', () => {
      const match = {
        text: 'wide angle shot',
        length: 15,
        isPhraseCategory: false,
        category: 'camera',
        start: 0,
        end: 15
      };

      const fullText = 'wide angle shot using camera lens with proper framing';

      const confidence = scorer.scoreMatch(match, fullText, [match]);

      expect(confidence).toBeGreaterThan(60); // Should be base + bonuses
    });

    it('should cap confidence at 100', () => {
      const match = {
        text: 'dramatic camera movement with lens',
        length: 34,
        isPhraseCategory: true,
        category: 'camera',
        start: 0,
        end: 34,
        contextBoost: 50
      };

      const fullText = 'dramatic camera movement with lens and shot and angle and view';

      const confidence = scorer.scoreMatch(match, fullText, [match]);

      expect(confidence).toBe(100);
    });

    it('should include existing context boost from match object', () => {
      const match = {
        text: 'test',
        length: 4,
        isPhraseCategory: false,
        category: 'camera',
        start: 0,
        end: 4,
        contextBoost: 20
      };

      const fullText = 'test text';

      const confidence = scorer.scoreMatch(match, fullText, [match]);

      expect(confidence).toBeGreaterThanOrEqual(80); // 60 base + 20 contextBoost
    });

    it('should not go below 0', () => {
      const match = {
        text: '',
        length: 0,
        isPhraseCategory: false,
        category: 'unknown',
        start: 100,
        end: 100,
        contextBoost: -100
      };

      const fullText = 'some text';

      const confidence = scorer.scoreMatch(match, fullText, [match]);

      expect(confidence).toBeGreaterThanOrEqual(0);
    });

    it('should extract surrounding context correctly', () => {
      const match = {
        text: 'target',
        length: 6,
        isPhraseCategory: false,
        category: 'camera',
        start: 100,
        end: 106
      };

      // Create text with match at position 100
      const fullText = 'x'.repeat(100) + 'target' + 'y'.repeat(100);

      const confidence = scorer.scoreMatch(match, fullText, [match]);

      expect(confidence).toBeGreaterThanOrEqual(60);
    });
  });

  describe('filterByConfidence', () => {
    it('should filter matches by minimum confidence', () => {
      const matches = [
        { text: 'a'.repeat(25), length: 25, isPhraseCategory: true, category: 'camera', start: 0, end: 25 },
        { text: 'b', length: 1, isPhraseCategory: false, category: 'camera', start: 26, end: 27 },
      ];

      const fullText = matches.map(m => m.text).join(' ');

      const filtered = scorer.filterByConfidence(matches, fullText, 70);

      expect(filtered.length).toBeLessThan(matches.length);
      expect(filtered.every(m => m.confidence >= 70)).toBe(true);
    });

    it('should add confidence score to each match', () => {
      const matches = [
        { text: 'test', length: 4, isPhraseCategory: false, category: 'camera', start: 0, end: 4 }
      ];

      const fullText = 'test text';

      const filtered = scorer.filterByConfidence(matches, fullText, 0);

      expect(filtered[0]).toHaveProperty('confidence');
      expect(typeof filtered[0].confidence).toBe('number');
    });

    it('should sort matches by confidence descending', () => {
      const matches = [
        { text: 'a', length: 1, isPhraseCategory: false, category: 'camera', start: 0, end: 1 },
        { text: 'very long phrase with many words', length: 32, isPhraseCategory: true, category: 'camera', start: 2, end: 34 },
        { text: 'medium length text', length: 18, isPhraseCategory: false, category: 'camera', start: 35, end: 53 },
      ];

      const fullText = matches.map(m => m.text).join(' ');

      const filtered = scorer.filterByConfidence(matches, fullText, 0);

      for (let i = 1; i < filtered.length; i++) {
        expect(filtered[i - 1].confidence).toBeGreaterThanOrEqual(filtered[i].confidence);
      }
    });

    it('should use default minimum confidence of 50', () => {
      const matches = [
        { text: 'test', length: 4, isPhraseCategory: false, category: 'camera', start: 0, end: 4 }
      ];

      const fullText = 'test';

      const filtered = scorer.filterByConfidence(matches, fullText);

      expect(filtered.every(m => m.confidence >= 50)).toBe(true);
    });

    it('should return empty array when no matches exceed threshold', () => {
      const matches = [
        { text: 'a', length: 1, isPhraseCategory: false, category: 'unknown', start: 0, end: 1 }
      ];

      const fullText = 'a';

      const filtered = scorer.filterByConfidence(matches, fullText, 95);

      expect(filtered).toEqual([]);
    });

    it('should preserve original match properties', () => {
      const matches = [
        {
          text: 'test',
          length: 4,
          isPhraseCategory: false,
          category: 'camera',
          start: 0,
          end: 4,
          customProp: 'value'
        }
      ];

      const fullText = 'test';

      const filtered = scorer.filterByConfidence(matches, fullText, 0);

      expect(filtered[0].customProp).toBe('value');
    });
  });

  describe('getConfidenceLevel', () => {
    it('should return "very high" for scores >= 85', () => {
      expect(scorer.getConfidenceLevel(85)).toBe('very high');
      expect(scorer.getConfidenceLevel(90)).toBe('very high');
      expect(scorer.getConfidenceLevel(100)).toBe('very high');
    });

    it('should return "high" for scores 70-84', () => {
      expect(scorer.getConfidenceLevel(70)).toBe('high');
      expect(scorer.getConfidenceLevel(75)).toBe('high');
      expect(scorer.getConfidenceLevel(84)).toBe('high');
    });

    it('should return "medium" for scores 55-69', () => {
      expect(scorer.getConfidenceLevel(55)).toBe('medium');
      expect(scorer.getConfidenceLevel(60)).toBe('medium');
      expect(scorer.getConfidenceLevel(69)).toBe('medium');
    });

    it('should return "low" for scores 40-54', () => {
      expect(scorer.getConfidenceLevel(40)).toBe('low');
      expect(scorer.getConfidenceLevel(45)).toBe('low');
      expect(scorer.getConfidenceLevel(54)).toBe('low');
    });

    it('should return "very low" for scores < 40', () => {
      expect(scorer.getConfidenceLevel(39)).toBe('very low');
      expect(scorer.getConfidenceLevel(20)).toBe('very low');
      expect(scorer.getConfidenceLevel(0)).toBe('very low');
    });

    it('should handle edge values precisely', () => {
      expect(scorer.getConfidenceLevel(85)).toBe('very high');
      expect(scorer.getConfidenceLevel(84.99)).toBe('high');
      expect(scorer.getConfidenceLevel(70)).toBe('high');
      expect(scorer.getConfidenceLevel(69.99)).toBe('medium');
    });
  });

  describe('singleton export', () => {
    it('should export a singleton instance', () => {
      expect(confidenceScorer).toBeInstanceOf(MatchConfidenceScorer);
    });

    it('should have all methods available on singleton', () => {
      expect(typeof confidenceScorer.calculateBaseScore).toBe('function');
      expect(typeof confidenceScorer.calculateContextBoost).toBe('function');
      expect(typeof confidenceScorer.calculatePositionScore).toBe('function');
      expect(typeof confidenceScorer.scoreMatch).toBe('function');
      expect(typeof confidenceScorer.filterByConfidence).toBe('function');
      expect(typeof confidenceScorer.getConfidenceLevel).toBe('function');
    });
  });

  describe('integration scenarios', () => {
    it('should score camera-related matches higher in camera context', () => {
      const match = {
        text: 'wide angle lens',
        length: 15,
        isPhraseCategory: false,
        category: 'camera',
        start: 0,
        end: 15
      };

      const cameraContext = 'wide angle lens with camera shot and proper framing';
      const genericContext = 'wide angle lens in the store';

      const cameraScore = scorer.scoreMatch(match, cameraContext, [match]);
      const genericScore = scorer.scoreMatch(match, genericContext, [match]);

      expect(cameraScore).toBeGreaterThan(genericScore);
    });

    it('should handle complete workflow from multiple matches', () => {
      const matches = [
        { text: 'soft lighting', length: 13, isPhraseCategory: false, category: 'lighting', start: 0, end: 13 },
        { text: 'wide shot', length: 9, isPhraseCategory: false, category: 'camera', start: 14, end: 23 },
        { text: 'dramatic atmosphere', length: 19, isPhraseCategory: true, category: 'atmospheric', start: 24, end: 43 },
      ];

      const fullText = 'soft lighting wide shot dramatic atmosphere with fog and mist creating shadows';

      const filtered = scorer.filterByConfidence(matches, fullText, 60);

      expect(filtered.length).toBeGreaterThan(0);
      expect(filtered.every(m => m.confidence >= 60)).toBe(true);
      expect(filtered[0].confidence).toBeGreaterThanOrEqual(filtered[filtered.length - 1].confidence);
    });

    it('should give higher scores to matches at sentence boundaries', () => {
      const match1 = {
        text: 'camera movement',
        length: 15,
        isPhraseCategory: false,
        category: 'camera',
        start: 0,
        end: 15
      };

      const match2 = {
        text: 'camera movement',
        length: 15,
        isPhraseCategory: false,
        category: 'camera',
        start: 20,
        end: 35
      };

      const text1 = 'camera movement flows smoothly';
      const text2 = 'Something here with camera movement flows';

      const score1 = scorer.scoreMatch(match1, text1, [match1]);
      const score2 = scorer.scoreMatch(match2, text2, [match2]);

      expect(score1).toBeGreaterThan(score2);
    });

    it('should handle real cinematography text', () => {
      const matches = [
        { text: '35mm film', length: 9, isPhraseCategory: true, category: 'technical', start: 0, end: 9 },
        { text: 'depth of field', length: 14, isPhraseCategory: true, category: 'technical', start: 15, end: 29 },
      ];

      const fullText = '35mm film with depth of field and aperture at f/2.8 for cinematic look';

      const filtered = scorer.filterByConfidence(matches, fullText, 50);

      expect(filtered.length).toBe(2);
      expect(filtered.every(m => m.confidence > 70)).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should handle matches with missing properties gracefully', () => {
      const match = { text: 'test' };
      const fullText = 'test text';

      expect(() => scorer.calculateBaseScore(match)).not.toThrow();
    });

    it('should handle empty full text', () => {
      const match = { text: 'test', length: 4, category: 'camera', start: 0, end: 4, isPhraseCategory: false };

      const confidence = scorer.scoreMatch(match, '', [match]);

      expect(confidence).toBeGreaterThanOrEqual(0);
      expect(confidence).toBeLessThanOrEqual(100);
    });

    it('should handle matches beyond text boundaries', () => {
      const match = {
        text: 'test',
        length: 4,
        isPhraseCategory: false,
        category: 'camera',
        start: 1000,
        end: 1004
      };

      const fullText = 'short text';

      expect(() => scorer.scoreMatch(match, fullText, [match])).not.toThrow();
    });

    it('should handle special characters in text', () => {
      const match = {
        text: 'test@#$',
        length: 7,
        isPhraseCategory: false,
        category: 'camera',
        start: 0,
        end: 7
      };

      const fullText = 'test@#$ with text';

      const confidence = scorer.scoreMatch(match, fullText, [match]);

      expect(confidence).toBeGreaterThanOrEqual(0);
    });

    it('should handle very large confidence boosts', () => {
      const match = {
        text: 'test',
        length: 4,
        isPhraseCategory: false,
        category: 'camera',
        start: 0,
        end: 4,
        contextBoost: 1000
      };

      const fullText = 'test';

      const confidence = scorer.scoreMatch(match, fullText, [match]);

      expect(confidence).toBe(100); // Should cap at 100
    });
  });
});
