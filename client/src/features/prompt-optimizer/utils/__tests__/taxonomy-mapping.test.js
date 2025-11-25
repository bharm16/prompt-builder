/**
 * Tests for client-side taxonomy mapping
 * 
 * Verifies that the client correctly handles taxonomy IDs and legacy role formats
 * in the highlight conversion process.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { convertLabeledSpansToHighlights } from '../highlightConversion.js';
import { VALID_CATEGORIES, TAXONOMY } from '@shared/taxonomy';

describe('Client Taxonomy Mapping', () => {
  const sampleText = 'A cowboy in a leather jacket walks through the dusty street at golden hour';

  describe('Direct taxonomy ID mapping', () => {
    it('uses taxonomy IDs directly as categories', () => {
      const spans = [
        { text: 'cowboy', start: 2, end: 8, role: 'subject', confidence: 0.9 }
      ];

      const result = convertLabeledSpansToHighlights({ spans, text: sampleText });
      
      expect(result).toHaveLength(1);
      expect(result[0].category).toBe('subject');
      expect(result[0].role).toBe('subject');
    });

    it('handles namespaced attribute IDs', () => {
      const spans = [
        { text: 'leather jacket', start: 14, end: 28, role: 'subject.wardrobe', confidence: 0.9 }
      ];

      const result = convertLabeledSpansToHighlights({ spans, text: sampleText });
      
      expect(result).toHaveLength(1);
      expect(result[0].category).toBe('subject.wardrobe');
      expect(result[0].role).toBe('subject.wardrobe');
    });

    it('handles multiple different taxonomy IDs', () => {
      const spans = [
        { text: 'cowboy', start: 2, end: 8, role: 'subject.identity', confidence: 0.95 },
        { text: 'leather jacket', start: 14, end: 28, role: 'subject.wardrobe', confidence: 0.9 },
        { text: 'walks', start: 29, end: 34, role: 'subject.action', confidence: 0.85 }
      ];

      const result = convertLabeledSpansToHighlights({ spans, text: sampleText });
      
      expect(result).toHaveLength(3);
      expect(result[0].category).toBe('subject.identity');
      expect(result[1].category).toBe('subject.wardrobe');
      expect(result[2].category).toBe('subject.action');
    });

    it('handles all subject attributes', () => {
      const attributes = [
        'subject.identity',
        'subject.appearance',
        'subject.wardrobe',
        'subject.action',
        'subject.emotion'
      ];

      attributes.forEach(attr => {
        const spans = [{ text: 'test', start: 0, end: 4, role: attr, confidence: 0.9 }];
        const result = convertLabeledSpansToHighlights({ spans, text: sampleText });
        
        expect(result).toHaveLength(1);
        expect(result[0].category).toBe(attr);
      });
    });

    it('handles all camera attributes', () => {
      const attributes = [
        'camera.framing',
        'camera.movement',
        'camera.lens',
        'camera.angle'
      ];

      attributes.forEach(attr => {
        const spans = [{ text: 'test', start: 0, end: 4, role: attr, confidence: 0.9 }];
        const result = convertLabeledSpansToHighlights({ spans, text: sampleText });
        
        expect(result).toHaveLength(1);
        expect(result[0].category).toBe(attr);
      });
    });

    it('handles all lighting attributes', () => {
      const attributes = [
        'lighting.source',
        'lighting.quality',
        'lighting.timeOfDay'
      ];

      attributes.forEach(attr => {
        const spans = [{ text: 'test', start: 0, end: 4, role: attr, confidence: 0.9 }];
        const result = convertLabeledSpansToHighlights({ spans, text: sampleText });
        
        expect(result).toHaveLength(1);
        expect(result[0].category).toBe(attr);
      });
    });

    it('handles all technical attributes', () => {
      const attributes = [
        'technical.aspectRatio',
        'technical.frameRate',
        'technical.resolution'
      ];

      attributes.forEach(attr => {
        const spans = [{ text: 'test', start: 0, end: 4, role: attr, confidence: 0.9 }];
        const result = convertLabeledSpansToHighlights({ spans, text: sampleText });
        
        expect(result).toHaveLength(1);
        expect(result[0].category).toBe(attr);
      });
    });
  });

  describe('Legacy role mapping', () => {
    it('maps legacy "Wardrobe" to "subject.wardrobe"', () => {
      const spans = [
        { text: 'leather jacket', start: 14, end: 28, role: 'Wardrobe', confidence: 0.9 }
      ];

      const result = convertLabeledSpansToHighlights({ spans, text: sampleText });
      
      expect(result).toHaveLength(1);
      expect(result[0].category).toBe('subject.wardrobe');
    });

    it('maps legacy "Movement" to "subject.action"', () => {
      const spans = [
        { text: 'walks', start: 29, end: 34, role: 'Movement', confidence: 0.9 }
      ];

      const result = convertLabeledSpansToHighlights({ spans, text: sampleText });
      
      expect(result).toHaveLength(1);
      expect(result[0].category).toBe('subject.action');
    });

    it('maps legacy "Specs" to "technical"', () => {
      const spans = [
        { text: '24fps', start: 0, end: 5, role: 'Specs', confidence: 0.9 }
      ];

      const result = convertLabeledSpansToHighlights({ spans, text: '24fps at 16:9' });
      
      expect(result).toHaveLength(1);
      expect(result[0].category).toBe('technical');
    });

    it('maps legacy "Appearance" to "subject.appearance"', () => {
      const spans = [
        { text: 'weathered face', start: 0, end: 14, role: 'Appearance', confidence: 0.9 }
      ];

      const result = convertLabeledSpansToHighlights({ spans, text: 'weathered face of a cowboy' });
      
      expect(result).toHaveLength(1);
      expect(result[0].category).toBe('subject.appearance');
    });

    it('maps legacy "Subject" to "subject"', () => {
      const spans = [
        { text: 'cowboy', start: 2, end: 8, role: 'Subject', confidence: 0.9 }
      ];

      const result = convertLabeledSpansToHighlights({ spans, text: sampleText });
      
      expect(result).toHaveLength(1);
      expect(result[0].category).toBe('subject');
    });

    it('maps legacy "Lighting" to "lighting"', () => {
      const spans = [
        { text: 'golden hour', start: 64, end: 75, role: 'Lighting', confidence: 0.9 }
      ];

      const result = convertLabeledSpansToHighlights({ spans, text: sampleText });
      
      expect(result).toHaveLength(1);
      expect(result[0].category).toBe('lighting');
    });

    it('maps legacy "Camera" to "camera"', () => {
      const spans = [
        { text: 'dolly shot', start: 0, end: 10, role: 'Camera', confidence: 0.9 }
      ];

      const result = convertLabeledSpansToHighlights({ spans, text: 'dolly shot forward' });
      
      expect(result).toHaveLength(1);
      expect(result[0].category).toBe('camera');
    });

    it('maps legacy "Framing" to "camera.framing"', () => {
      const spans = [
        { text: 'close-up', start: 0, end: 8, role: 'Framing', confidence: 0.9 }
      ];

      const result = convertLabeledSpansToHighlights({ spans, text: 'close-up shot' });
      
      expect(result).toHaveLength(1);
      expect(result[0].category).toBe('camera.framing');
    });

    it('maps legacy "Style" to "style"', () => {
      const spans = [
        { text: 'film noir', start: 0, end: 9, role: 'Style', confidence: 0.9 }
      ];

      const result = convertLabeledSpansToHighlights({ spans, text: 'film noir aesthetic' });
      
      expect(result).toHaveLength(1);
      expect(result[0].category).toBe('style');
    });

    it('maps legacy "Quality" to "style.aesthetic"', () => {
      const spans = [
        { text: 'cinematic', start: 0, end: 9, role: 'Quality', confidence: 0.9 }
      ];

      const result = convertLabeledSpansToHighlights({ spans, text: 'cinematic look' });
      
      expect(result).toHaveLength(1);
      expect(result[0].category).toBe('style.aesthetic');
    });

    it('maps legacy "Environment" to "environment"', () => {
      const spans = [
        { text: 'dusty street', start: 50, end: 62, role: 'Environment', confidence: 0.9 }
      ];

      const result = convertLabeledSpansToHighlights({ spans, text: sampleText });
      
      expect(result).toHaveLength(1);
      expect(result[0].category).toBe('environment');
    });
  });

  describe('Unknown role handling', () => {
    it('handles unknown roles with subject fallback', () => {
      const spans = [
        { text: 'something', start: 2, end: 11, role: 'UnknownRole', confidence: 0.9 }
      ];

      const result = convertLabeledSpansToHighlights({ spans, text: sampleText });
      
      expect(result).toHaveLength(1);
      expect(result[0].category).toBe('subject');
    });

    it('handles missing role with subject fallback', () => {
      const spans = [
        { text: 'something', start: 2, end: 11, confidence: 0.9 }
      ];

      const result = convertLabeledSpansToHighlights({ spans, text: sampleText });
      
      expect(result).toHaveLength(1);
      expect(result[0].category).toBe('subject');
      expect(result[0].role).toBe('subject');
    });

    it('handles non-string role with subject fallback', () => {
      const spans = [
        { text: 'something', start: 2, end: 11, role: 123, confidence: 0.9 }
      ];

      const result = convertLabeledSpansToHighlights({ spans, text: sampleText });
      
      expect(result).toHaveLength(1);
      expect(result[0].category).toBe('subject');
      expect(result[0].role).toBe('subject');
    });
  });

  describe('Mixed format handling', () => {
    it('handles mix of new and legacy formats', () => {
      const spans = [
        { text: 'cowboy', start: 2, end: 8, role: 'subject.identity', confidence: 0.95 }, // New
        { text: 'leather jacket', start: 14, end: 28, role: 'Wardrobe', confidence: 0.9 }, // Legacy
        { text: 'walks', start: 29, end: 34, role: 'subject.action', confidence: 0.85 }, // New
        { text: 'golden hour', start: 64, end: 75, role: 'Lighting', confidence: 0.88 } // Legacy
      ];

      const result = convertLabeledSpansToHighlights({ spans, text: sampleText });
      
      expect(result).toHaveLength(4);
      expect(result[0].category).toBe('subject.identity');
      expect(result[1].category).toBe('subject.wardrobe'); // Mapped from legacy
      expect(result[2].category).toBe('subject.action');
      expect(result[3].category).toBe('lighting'); // Mapped from legacy
    });

    it('handles mix of valid and invalid roles', () => {
      const spans = [
        { text: 'valid', start: 2, end: 7, role: 'subject', confidence: 0.9 },
        { text: 'invalid', start: 14, end: 21, role: 'InvalidRole', confidence: 0.85 },
        { text: 'also valid', start: 29, end: 39, role: 'camera.framing', confidence: 0.92 }
      ];

      const result = convertLabeledSpansToHighlights({ spans, text: sampleText });
      
      expect(result).toHaveLength(3);
      expect(result[0].category).toBe('subject');
      expect(result[1].category).toBe('subject'); // Fallback
      expect(result[2].category).toBe('camera.framing');
    });
  });

  describe('Highlight object properties', () => {
    it('preserves version as llm-v2-taxonomy', () => {
      const spans = [
        { text: 'test', start: 0, end: 4, role: 'subject', confidence: 0.9 }
      ];

      const result = convertLabeledSpansToHighlights({ spans, text: 'test text' });
      
      expect(result[0].version).toBe('llm-v2-taxonomy');
    });

    it('includes both role and category with same value for taxonomy IDs', () => {
      const spans = [
        { text: 'test', start: 0, end: 4, role: 'subject.wardrobe', confidence: 0.9 }
      ];

      const result = convertLabeledSpansToHighlights({ spans, text: 'test text' });
      
      expect(result[0].role).toBe('subject.wardrobe');
      expect(result[0].category).toBe('subject.wardrobe');
    });

    it('sets source to llm', () => {
      const spans = [
        { text: 'test', start: 0, end: 4, role: 'subject', confidence: 0.9 }
      ];

      const result = convertLabeledSpansToHighlights({ spans, text: 'test text' });
      
      expect(result[0].source).toBe('llm');
    });

    it('preserves confidence value', () => {
      const spans = [
        { text: 'test', start: 0, end: 4, role: 'subject', confidence: 0.87 }
      ];

      const result = convertLabeledSpansToHighlights({ spans, text: 'test text' });
      
      expect(result[0].confidence).toBe(0.87);
    });
  });

  describe('Real-world scenario', () => {
    it('converts complete video prompt with taxonomy IDs', () => {
      const promptText = 'A cowboy with a weathered face in a leather jacket walks slowly through a dusty street at golden hour. Close-up dolly shot, filmed on 35mm at 24fps in 16:9.';
      
      const spans = [
        { text: 'cowboy', start: 2, end: 8, role: 'subject.identity', confidence: 0.95 },
        { text: 'weathered face', start: 16, end: 30, role: 'subject.appearance', confidence: 0.88 },
        { text: 'leather jacket', start: 36, end: 50, role: 'subject.wardrobe', confidence: 0.92 },
        { text: 'walks slowly', start: 51, end: 63, role: 'subject.action', confidence: 0.85 },
        { text: 'dusty street', start: 76, end: 88, role: 'environment.location', confidence: 0.9 },
        { text: 'golden hour', start: 92, end: 103, role: 'lighting.timeOfDay', confidence: 0.93 },
        { text: 'Close-up', start: 105, end: 113, role: 'camera.framing', confidence: 0.94 },
        { text: 'dolly shot', start: 114, end: 124, role: 'camera.movement', confidence: 0.91 },
        { text: '35mm', start: 136, end: 140, role: 'style.filmStock', confidence: 0.96 },
        { text: '24fps', start: 144, end: 149, role: 'technical.frameRate', confidence: 0.98 },
        { text: '16:9', start: 153, end: 157, role: 'technical.aspectRatio', confidence: 0.97 }
      ];

      const result = convertLabeledSpansToHighlights({ spans, text: promptText });
      
      expect(result.length).toBeGreaterThanOrEqual(11);
      
      // Verify all categories are valid taxonomy IDs
      result.forEach(highlight => {
        expect(typeof highlight.category).toBe('string');
        expect(highlight.category.length).toBeGreaterThan(0);
        
        // Should be a valid taxonomy ID
        const isParent = ['subject', 'environment', 'lighting', 'camera', 'style', 'technical', 'audio'].includes(highlight.category);
        const isAttribute = highlight.category.includes('.');
        expect(isParent || isAttribute).toBe(true);
      });
    });
  });
});

