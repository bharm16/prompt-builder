/**
 * Unit tests for BehaviorLearningEngine
 */

import { BehaviorLearningEngine } from '../BehaviorLearningEngine.js';

describe('BehaviorLearningEngine', () => {
  let learner;

  beforeEach(() => {
    learner = new BehaviorLearningEngine();
    learner.reset(); // Start fresh
  });

  describe('recordShown()', () => {
    test('should track phrase being shown', () => {
      learner.recordShown('golden hour', 'lighting', 75);

      const data = learner.phraseEngagement.get('golden hour');
      expect(data.shown).toBe(1);
      expect(data.clicked).toBe(0);
      expect(data.totalConfidence).toBe(75);
    });

    test('should increment shown count on multiple calls', () => {
      learner.recordShown('bokeh', 'technical', 80);
      learner.recordShown('bokeh', 'technical', 85);

      const data = learner.phraseEngagement.get('bokeh');
      expect(data.shown).toBe(2);
      expect(data.totalConfidence).toBe(165);
    });

    test('should track total interactions for UCB', () => {
      learner.recordShown('phrase1', 'camera', 70);
      learner.recordShown('phrase2', 'lighting', 80);

      expect(learner.totalInteractions).toBe(2);
    });

    test('should track category engagement', () => {
      learner.recordShown('zoom in', 'camera', 75);
      learner.recordShown('pan left', 'camera', 80);

      const categoryData = learner.categoryEngagement.get('camera');
      expect(categoryData.shown).toBe(2);
    });
  });

  describe('recordClick()', () => {
    test('should track user clicks', () => {
      learner.recordShown('shallow depth', 'technical', 75);
      learner.recordClick('shallow depth', 'technical');

      const data = learner.phraseEngagement.get('shallow depth');
      expect(data.clicked).toBe(1);
    });

    test('should increase phrase score on click', () => {
      learner.recordShown('lighting', 'lighting', 75);

      const scoreBefore = learner.phraseEngagement.get('lighting').score;

      learner.recordClick('lighting', 'lighting');

      const scoreAfter = learner.phraseEngagement.get('lighting').score;

      expect(scoreAfter).toBeGreaterThan(scoreBefore);
    });

    test('should update category engagement', () => {
      learner.recordShown('soft light', 'lighting', 75);
      learner.recordClick('soft light', 'lighting');

      const categoryData = learner.categoryEngagement.get('lighting');
      expect(categoryData.clicked).toBe(1);
    });
  });

  describe('getPhraseScore() with UCB', () => {
    test('should return 0.5 for unknown phrases', () => {
      const score = learner.getPhraseScore('unknown phrase');
      expect(score).toBe(0.5);
    });

    test('should increase score for clicked phrases', () => {
      // Show phrase 10 times, click 7 times
      for (let i = 0; i < 10; i++) {
        learner.recordShown('good phrase', 'camera', 75);
      }
      for (let i = 0; i < 7; i++) {
        learner.recordClick('good phrase', 'camera');
      }

      const score = learner.getPhraseScore('good phrase');
      expect(score).toBeGreaterThan(0.5); // High CTR should give high score
    });

    test('should give exploration bonus to phrases with few samples', () => {
      // Phrase with few samples should get exploration bonus
      learner.recordShown('new phrase', 'camera', 75);
      learner.totalInteractions = 100; // Many total interactions

      const score = learner.getPhraseScore('new phrase');

      // With UCB, phrases with few samples get exploration bonus
      expect(score).toBeGreaterThan(0.4); // Should have some exploration bonus
    });

    test('should apply time decay to old patterns', () => {
      learner.recordShown('old phrase', 'camera', 75);

      const data = learner.phraseEngagement.get('old phrase');

      // Simulate phrase last seen 60 days ago
      data.lastSeen = Date.now() - (60 * 24 * 60 * 60 * 1000);

      const score = learner.getPhraseScore('old phrase');

      // Score should be reduced due to time decay
      expect(score).toBeLessThan(0.5);
    });

    test('should factor in sample size confidence', () => {
      // Phrase with 1 sample
      learner.recordShown('phrase1', 'camera', 75);
      learner.recordClick('phrase1', 'camera');
      const score1 = learner.getPhraseScore('phrase1');

      // Phrase with 10 samples, same CTR
      for (let i = 0; i < 10; i++) {
        learner.recordShown('phrase2', 'camera', 75);
      }
      for (let i = 0; i < 10; i++) {
        learner.recordClick('phrase2', 'camera');
      }
      const score2 = learner.getPhraseScore('phrase2');

      // Phrase with more samples should have higher confidence
      expect(score2).toBeGreaterThanOrEqual(score1);
    });
  });

  describe('adjustConfidence()', () => {
    test('should boost confidence for high-engagement phrases', () => {
      // Create high-engagement phrase
      for (let i = 0; i < 10; i++) {
        learner.recordShown('great phrase', 'camera', 75);
        learner.recordClick('great phrase', 'camera');
      }

      const adjusted = learner.adjustConfidence('great phrase', 'camera', 60);

      expect(adjusted).toBeGreaterThan(60);
    });

    test('should reduce confidence for low-engagement phrases', () => {
      // Create low-engagement phrase
      for (let i = 0; i < 10; i++) {
        learner.recordShown('bad phrase', 'camera', 75);
      }
      // No clicks

      const adjusted = learner.adjustConfidence('bad phrase', 'camera', 60);

      expect(adjusted).toBeLessThan(60);
    });
  });

  describe('shouldShow()', () => {
    test('should show high-confidence phrases', () => {
      // High engagement phrase
      for (let i = 0; i < 10; i++) {
        learner.recordShown('good phrase', 'camera', 80);
        learner.recordClick('good phrase', 'camera');
      }

      const shouldShow = learner.shouldShow('good phrase', 'camera', 70);
      expect(shouldShow).toBe(true);
    });

    test('should sometimes show uncertain patterns for exploration', () => {
      learner.explorationRate = 1.0; // Always explore

      const shouldShow = learner.shouldShow('uncertain phrase', 'camera', 35);
      expect(shouldShow).toBe(true); // Low confidence but exploration allows it
    });
  });

  describe('getTopPhrases()', () => {
    test('should return top performing phrases sorted by score', () => {
      // Create phrases with different performance
      for (let i = 0; i < 5; i++) {
        learner.recordShown('phrase1', 'camera', 75);
        learner.recordClick('phrase1', 'camera');
      }

      for (let i = 0; i < 5; i++) {
        learner.recordShown('phrase2', 'camera', 75);
      }
      learner.recordClick('phrase2', 'camera'); // Lower CTR

      const topPhrases = learner.getTopPhrases(2);

      expect(topPhrases).toHaveLength(2);
      expect(topPhrases[0].phrase).toBe('phrase1'); // Higher score
      expect(topPhrases[0].score).toBeGreaterThan(topPhrases[1].score);
    });
  });

  describe('getCategoryMetrics()', () => {
    test('should return category performance metrics', () => {
      learner.recordShown('zoom', 'camera', 75);
      learner.recordShown('pan', 'camera', 80);
      learner.recordClick('zoom', 'camera');

      const metrics = learner.getCategoryMetrics();
      const cameraMetric = metrics.find(m => m.category === 'camera');

      expect(cameraMetric).toBeDefined();
      expect(cameraMetric.shown).toBe(2);
      expect(cameraMetric.clicked).toBe(1);
      expect(cameraMetric.clickRate).toBe('50.0%');
    });
  });

  describe('save and load', () => {
    test('should persist data to localStorage', () => {
      learner.recordShown('test phrase', 'camera', 75);
      learner.recordClick('test phrase', 'camera');
      learner.save();

      const newLearner = new BehaviorLearningEngine();
      const data = newLearner.phraseEngagement.get('test phrase');

      expect(data).toBeDefined();
      expect(data.shown).toBe(1);
      expect(data.clicked).toBe(1);
    });

    test('should persist UCB parameters', () => {
      learner.totalInteractions = 100;
      learner.ucbConfidenceLevel = 3.0;
      learner.save();

      const newLearner = new BehaviorLearningEngine();

      expect(newLearner.totalInteractions).toBe(100);
      expect(newLearner.ucbConfidenceLevel).toBe(3.0);
    });
  });

  describe('reset()', () => {
    test('should clear all learned data', () => {
      learner.recordShown('phrase', 'camera', 75);
      learner.recordClick('phrase', 'camera');

      learner.reset();

      expect(learner.phraseEngagement.size).toBe(0);
      expect(learner.categoryEngagement.size).toBe(0);
      expect(learner.totalInteractions).toBe(0);
    });
  });
});
