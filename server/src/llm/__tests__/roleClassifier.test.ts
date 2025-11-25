/**
 * Tests for roleClassifier taxonomy integration
 * 
 * Verifies that the roleClassifier correctly uses the unified taxonomy system
 * with namespaced IDs and proper validation.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ROLE_SET, validate, hashKey } from '../roleClassifier.js';
import { VALID_CATEGORIES, TAXONOMY } from '@shared/taxonomy';

interface SourceSpan {
  text: string;
  start: number;
  end: number;
}

interface LabeledSpan extends SourceSpan {
  role: string;
  confidence: number;
}

describe('roleClassifier - Taxonomy Integration', () => {
  describe('ROLE_SET validation', () => {
    it('uses taxonomy VALID_CATEGORIES as ROLE_SET', () => {
      expect(ROLE_SET).toBe(VALID_CATEGORIES);
    });

    it('includes parent category IDs', () => {
      expect(ROLE_SET.has('subject')).toBe(true);
      expect(ROLE_SET.has('environment')).toBe(true);
      expect(ROLE_SET.has('lighting')).toBe(true);
      expect(ROLE_SET.has('camera')).toBe(true);
      expect(ROLE_SET.has('style')).toBe(true);
      expect(ROLE_SET.has('technical')).toBe(true);
      expect(ROLE_SET.has('audio')).toBe(true);
    });

    it('includes namespaced attribute IDs', () => {
      expect(ROLE_SET.has('subject.wardrobe')).toBe(true);
      expect(ROLE_SET.has('subject.appearance')).toBe(true);
      expect(ROLE_SET.has('subject.action')).toBe(true);
      expect(ROLE_SET.has('camera.framing')).toBe(true);
      expect(ROLE_SET.has('camera.movement')).toBe(true);
      expect(ROLE_SET.has('lighting.timeOfDay')).toBe(true);
      expect(ROLE_SET.has('technical.frameRate')).toBe(true);
    });

    it('does NOT include legacy capitalized roles', () => {
      expect(ROLE_SET.has('Subject')).toBe(false);
      expect(ROLE_SET.has('Wardrobe')).toBe(false);
      expect(ROLE_SET.has('Movement')).toBe(false);
      expect(ROLE_SET.has('Quality')).toBe(false);
      expect(ROLE_SET.has('Framing')).toBe(false);
    });

    it('has the expected total number of categories', () => {
      // Should have 7 parents + all their attributes
      expect(ROLE_SET.size).toBeGreaterThan(20);
      expect(ROLE_SET.size).toBeLessThan(50);
    });
  });

  describe('validate() function', () => {
    it('accepts valid taxonomy parent IDs', () => {
      const source: SourceSpan[] = [
        { text: 'test subject', start: 0, end: 12 }
      ];
      const labeled: LabeledSpan[] = [
        { text: 'test subject', start: 0, end: 12, role: 'subject', confidence: 0.9 }
      ];

      const result = validate(source, labeled);
      expect(result).toHaveLength(1);
      expect(result[0]?.role).toBe('subject');
    });

    it('accepts valid taxonomy attribute IDs', () => {
      const source: SourceSpan[] = [
        { text: 'leather jacket', start: 0, end: 14 }
      ];
      const labeled: LabeledSpan[] = [
        { text: 'leather jacket', start: 0, end: 14, role: 'subject.wardrobe', confidence: 0.9 }
      ];

      const result = validate(source, labeled);
      expect(result).toHaveLength(1);
      expect(result[0]?.role).toBe('subject.wardrobe');
    });

    it('normalizes invalid roles to subject', () => {
      const source: SourceSpan[] = [
        { text: 'something', start: 0, end: 9 }
      ];
      const labeled: LabeledSpan[] = [
        { text: 'something', start: 0, end: 9, role: 'InvalidRole', confidence: 0.9 }
      ];

      const result = validate(source, labeled);
      expect(result).toHaveLength(1);
      expect(result[0]?.role).toBe(TAXONOMY.SUBJECT.id);
    });

    it('handles multiple spans with different taxonomy IDs', () => {
      const source: SourceSpan[] = [
        { text: 'cowboy', start: 0, end: 6 },
        { text: 'leather boots', start: 10, end: 23 },
        { text: 'walking', start: 30, end: 37 }
      ];
      const labeled: LabeledSpan[] = [
        { text: 'cowboy', start: 0, end: 6, role: 'subject.identity', confidence: 0.95 },
        { text: 'leather boots', start: 10, end: 23, role: 'subject.wardrobe', confidence: 0.9 },
        { text: 'walking', start: 30, end: 37, role: 'subject.action', confidence: 0.85 }
      ];

      const result = validate(source, labeled);
      expect(result).toHaveLength(3);
      expect(result[0]?.role).toBe('subject.identity');
      expect(result[1]?.role).toBe('subject.wardrobe');
      expect(result[2]?.role).toBe('subject.action');
    });

    it('clamps confidence values to [0, 1]', () => {
      const source: SourceSpan[] = [
        { text: 'test', start: 0, end: 4 }
      ];
      const labeled: LabeledSpan[] = [
        { text: 'test', start: 0, end: 4, role: 'subject', confidence: 1.5 }
      ];

      const result = validate(source, labeled);
      expect(result[0]?.confidence).toBe(1);
    });

    it('filters out spans that dont match source', () => {
      const source: SourceSpan[] = [
        { text: 'original', start: 0, end: 8 }
      ];
      const labeled: LabeledSpan[] = [
        { text: 'different', start: 0, end: 9, role: 'subject', confidence: 0.9 }
      ];

      const result = validate(source, labeled);
      expect(result).toHaveLength(0);
    });

    it('skips very long spans for non-technical roles', () => {
      const source: SourceSpan[] = [
        { text: 'a very long phrase with more than six words here', start: 0, end: 49 }
      ];
      const labeled: LabeledSpan[] = [
        { text: 'a very long phrase with more than six words here', start: 0, end: 49, role: 'subject', confidence: 0.9 }
      ];

      const result = validate(source, labeled);
      expect(result).toHaveLength(0);
    });

    it('allows long spans for technical role', () => {
      const source: SourceSpan[] = [
        { text: '16:9 aspect ratio with 24fps frame rate', start: 0, end: 40 }
      ];
      const labeled: LabeledSpan[] = [
        { text: '16:9 aspect ratio with 24fps frame rate', start: 0, end: 40, role: 'technical', confidence: 0.9 }
      ];

      const result = validate(source, labeled);
      expect(result).toHaveLength(1);
      expect(result[0]?.role).toBe('technical');
    });

    it('handles overlapping spans by preferring technical and higher confidence', () => {
      const source: SourceSpan[] = [
        { text: '24fps', start: 0, end: 5 }
      ];
      const labeled: LabeledSpan[] = [
        { text: '24fps', start: 0, end: 5, role: 'technical', confidence: 0.7 },
        { text: '24fps', start: 0, end: 5, role: 'style', confidence: 0.9 }
      ];

      const result = validate(source, labeled);
      expect(result).toHaveLength(1);
      // Technical gets priority boost, so even with lower confidence it wins
      expect(result[0]?.role).toBe('technical');
    });

    it('sorts spans by start position', () => {
      const source: SourceSpan[] = [
        { text: 'third', start: 20, end: 25 },
        { text: 'first', start: 0, end: 5 },
        { text: 'second', start: 10, end: 16 }
      ];
      const labeled: LabeledSpan[] = [
        { text: 'third', start: 20, end: 25, role: 'subject', confidence: 0.9 },
        { text: 'first', start: 0, end: 5, role: 'subject', confidence: 0.9 },
        { text: 'second', start: 10, end: 16, role: 'subject', confidence: 0.9 }
      ];

      const result = validate(source, labeled);
      expect(result).toHaveLength(3);
      expect(result[0]?.text).toBe('first');
      expect(result[1]?.text).toBe('second');
      expect(result[2]?.text).toBe('third');
    });
  });

  describe('hashKey() cache versioning', () => {
    it('includes cache version in hash key', () => {
      const spans: SourceSpan[] = [{ text: 'test', start: 0, end: 4 }];
      const version = 'v1';

      const key1 = hashKey(spans, version);
      expect(key1).toBeTruthy();
      expect(typeof key1).toBe('string');
      
      // Hash should be different with different input
      const key2 = hashKey([{ text: 'different', start: 0, end: 9 }], version);
      expect(key2).not.toBe(key1);
    });

    it('generates consistent hashes for same input', () => {
      const spans: SourceSpan[] = [{ text: 'test', start: 0, end: 4 }];
      const version = 'v1';

      const key1 = hashKey(spans, version);
      const key2 = hashKey(spans, version);
      
      expect(key1).toBe(key2);
    });

    it('generates different hashes for different versions', () => {
      const spans: SourceSpan[] = [{ text: 'test', start: 0, end: 4 }];

      const key1 = hashKey(spans, 'v1');
      const key2 = hashKey(spans, 'v2');
      
      expect(key1).not.toBe(key2);
    });
  });

  describe('Taxonomy category coverage', () => {
    it('validates all subject attributes', () => {
      const attributes = [
        'subject.identity',
        'subject.appearance',
        'subject.wardrobe',
        'subject.action',
        'subject.emotion'
      ];

      attributes.forEach(attr => {
        expect(ROLE_SET.has(attr)).toBe(true);
      });
    });

    it('validates all camera attributes', () => {
      const attributes = [
        'camera.framing',
        'camera.movement',
        'camera.lens',
        'camera.angle'
      ];

      attributes.forEach(attr => {
        expect(ROLE_SET.has(attr)).toBe(true);
      });
    });

    it('validates all lighting attributes', () => {
      const attributes = [
        'lighting.source',
        'lighting.quality',
        'lighting.timeOfDay'
      ];

      attributes.forEach(attr => {
        expect(ROLE_SET.has(attr)).toBe(true);
      });
    });

    it('validates all technical attributes', () => {
      const attributes = [
        'technical.aspectRatio',
        'technical.frameRate',
        'technical.resolution'
      ];

      attributes.forEach(attr => {
        expect(ROLE_SET.has(attr)).toBe(true);
      });
    });

    it('validates all style attributes', () => {
      const attributes = [
        'style.aesthetic',
        'style.filmStock'
      ];

      attributes.forEach(attr => {
        expect(ROLE_SET.has(attr)).toBe(true);
      });
    });

    it('validates all environment attributes', () => {
      const attributes = [
        'environment.location',
        'environment.weather',
        'environment.context'
      ];

      attributes.forEach(attr => {
        expect(ROLE_SET.has(attr)).toBe(true);
      });
    });

    it('validates all audio attributes', () => {
      const attributes = [
        'audio.score',
        'audio.soundEffect'
      ];

      attributes.forEach(attr => {
        expect(ROLE_SET.has(attr)).toBe(true);
      });
    });
  });
});

