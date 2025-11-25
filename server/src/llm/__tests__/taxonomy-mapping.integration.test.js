/**
 * Integration tests for taxonomy mapping
 * 
 * Tests end-to-end flow of taxonomy IDs through the system:
 * - Mock LLM responses with taxonomy IDs
 * - Span normalization
 * - Role validation
 * - Mixed format handling
 */

import { describe, it, expect, vi } from 'vitest';
import { labelSpans } from '../span-labeling/SpanLabelingService.js';
import { normalizeSpan } from '../span-labeling/processing/SpanNormalizer.js';
import { TAXONOMY } from '../../../shared/taxonomy.ts';

describe('Taxonomy Mapping Integration', () => {
  describe('End-to-end LLM response with taxonomy IDs', () => {
    it('handles taxonomy IDs from LLM response', async () => {
      const mockCallFn = async () => {
        return JSON.stringify({
          spans: [
            { text: 'cowboy', start: 0, end: 6, role: 'subject.identity', confidence: 0.95 },
            { text: 'leather jacket', start: 10, end: 24, role: 'subject.wardrobe', confidence: 0.9 },
            { text: 'walking slowly', start: 30, end: 44, role: 'subject.action', confidence: 0.85 }
          ]
        });
      };

      const result = await labelSpans(
        {
          text: 'A cowboy in a leather jacket is walking slowly',
          maxSpans: 10,
          minConfidence: 0.5
        },
        { callFn: mockCallFn }
      );

      expect(result.spans).toHaveLength(3);
      expect(result.spans[0].role).toBe('subject.identity');
      expect(result.spans[1].role).toBe('subject.wardrobe');
      expect(result.spans[2].role).toBe('subject.action');
    });

    it('handles parent category IDs', async () => {
      const mockCallFn = async () => {
        return JSON.stringify({
          spans: [
            { text: 'diner', start: 0, end: 5, role: 'environment', confidence: 0.9 },
            { text: 'neon lights', start: 10, end: 21, role: 'lighting', confidence: 0.85 },
            { text: 'dolly shot', start: 30, end: 40, role: 'camera', confidence: 0.9 }
          ]
        });
      };

      const result = await labelSpans(
        {
          text: 'In a diner with neon lights and a dolly shot',
          maxSpans: 10,
          minConfidence: 0.5
        },
        { callFn: mockCallFn }
      );

      expect(result.spans).toHaveLength(3);
      expect(result.spans[0].role).toBe('environment');
      expect(result.spans[1].role).toBe('lighting');
      expect(result.spans[2].role).toBe('camera');
    });

    it('handles attribute category IDs', async () => {
      const mockCallFn = async () => {
        return JSON.stringify({
          spans: [
            { text: 'close-up', start: 0, end: 8, role: 'camera.framing', confidence: 0.95 },
            { text: 'pan left', start: 12, end: 20, role: 'camera.movement', confidence: 0.9 },
            { text: 'golden hour', start: 25, end: 36, role: 'lighting.timeOfDay', confidence: 0.88 },
            { text: '24fps', start: 40, end: 45, role: 'technical.frameRate', confidence: 0.98 }
          ]
        });
      };

      const result = await labelSpans(
        {
          text: 'A close-up, pan left, in golden hour at 24fps',
          maxSpans: 10,
          minConfidence: 0.5
        },
        { callFn: mockCallFn }
      );

      expect(result.spans).toHaveLength(4);
      expect(result.spans[0].role).toBe('camera.framing');
      expect(result.spans[1].role).toBe('camera.movement');
      expect(result.spans[2].role).toBe('lighting.timeOfDay');
      expect(result.spans[3].role).toBe('technical.frameRate');
    });

    it('falls back to subject for invalid roles', async () => {
      const mockCallFn = async () => {
        return JSON.stringify({
          spans: [
            { text: 'valid span', start: 0, end: 10, role: 'subject', confidence: 0.9 },
            { text: 'invalid span', start: 15, end: 27, role: 'InvalidRole', confidence: 0.8 }
          ]
        });
      };

      const result = await labelSpans(
        {
          text: 'Some valid span and invalid span text',
          maxSpans: 10,
          minConfidence: 0.5
        },
        { callFn: mockCallFn }
      );

      // SpanNormalizer in lenient mode should convert invalid to subject
      expect(result.spans).toHaveLength(2);
      expect(result.spans[0].role).toBe('subject');
      expect(result.spans[1].role).toBe(TAXONOMY.SUBJECT.id);
    });

    it('handles mixed valid and invalid taxonomy IDs', async () => {
      const mockCallFn = async () => {
        return JSON.stringify({
          spans: [
            { text: 'valid', start: 0, end: 5, role: 'subject.wardrobe', confidence: 0.9 },
            { text: 'also valid', start: 10, end: 20, role: 'lighting', confidence: 0.85 },
            { text: 'invalid', start: 25, end: 32, role: 'NotATaxonomyID', confidence: 0.7 }
          ]
        });
      };

      const result = await labelSpans(
        {
          text: 'Some valid, also valid, and invalid text',
          maxSpans: 10,
          minConfidence: 0.5
        },
        { callFn: mockCallFn }
      );

      expect(result.spans).toHaveLength(3);
      expect(result.spans[0].role).toBe('subject.wardrobe');
      expect(result.spans[1].role).toBe('lighting');
      expect(result.spans[2].role).toBe(TAXONOMY.SUBJECT.id); // Normalized to subject
    });
  });

  describe('SpanNormalizer with taxonomy', () => {
    it('normalizes spans with valid taxonomy IDs', () => {
      const span = {
        text: 'leather jacket',
        start: 0,
        end: 14,
        role: 'subject.wardrobe',
        confidence: 0.9
      };

      const result = normalizeSpan(span, true);
      
      expect(result).not.toBeNull();
      expect(result.role).toBe('subject.wardrobe');
      expect(result.confidence).toBe(0.9);
    });

    it('normalizes invalid roles to subject in lenient mode', () => {
      const span = {
        text: 'something',
        start: 0,
        end: 9,
        role: 'InvalidRole',
        confidence: 0.8
      };

      const result = normalizeSpan(span, true);
      
      expect(result).not.toBeNull();
      expect(result.role).toBe(TAXONOMY.SUBJECT.id);
    });

    it('returns null for invalid roles in strict mode', () => {
      const span = {
        text: 'something',
        start: 0,
        end: 9,
        role: 'InvalidRole',
        confidence: 0.8
      };

      const result = normalizeSpan(span, false);
      
      expect(result).toBeNull();
    });

    it('clamps confidence values to [0, 1]', () => {
      const span1 = {
        text: 'test',
        start: 0,
        end: 4,
        role: 'subject',
        confidence: 1.5
      };

      const result1 = normalizeSpan(span1, true);
      expect(result1.confidence).toBe(1);

      const span2 = {
        text: 'test',
        start: 0,
        end: 4,
        role: 'subject',
        confidence: -0.5
      };

      const result2 = normalizeSpan(span2, true);
      expect(result2.confidence).toBe(0);
    });

    it('handles all subject attribute IDs', () => {
      const attributes = [
        'subject.identity',
        'subject.appearance',
        'subject.wardrobe',
        'subject.action',
        'subject.emotion'
      ];

      attributes.forEach(attr => {
        const span = {
          text: 'test',
          start: 0,
          end: 4,
          role: attr,
          confidence: 0.9
        };

        const result = normalizeSpan(span, true);
        expect(result).not.toBeNull();
        expect(result.role).toBe(attr);
      });
    });

    it('handles all camera attribute IDs', () => {
      const attributes = [
        'camera.framing',
        'camera.movement',
        'camera.lens',
        'camera.angle'
      ];

      attributes.forEach(attr => {
        const span = {
          text: 'test',
          start: 0,
          end: 4,
          role: attr,
          confidence: 0.9
        };

        const result = normalizeSpan(span, true);
        expect(result).not.toBeNull();
        expect(result.role).toBe(attr);
      });
    });

    it('handles all technical attribute IDs', () => {
      const attributes = [
        'technical.aspectRatio',
        'technical.frameRate',
        'technical.resolution'
      ];

      attributes.forEach(attr => {
        const span = {
          text: 'test',
          start: 0,
          end: 4,
          role: attr,
          confidence: 0.9
        };

        const result = normalizeSpan(span, true);
        expect(result).not.toBeNull();
        expect(result.role).toBe(attr);
      });
    });
  });

  describe('Complex real-world scenarios', () => {
    it('handles complete video prompt with taxonomy IDs', async () => {
      const mockCallFn = async () => {
        return JSON.stringify({
          spans: [
            { text: 'cowboy', start: 2, end: 8, role: 'subject.identity', confidence: 0.95 },
            { text: 'weathered face', start: 14, end: 28, role: 'subject.appearance', confidence: 0.88 },
            { text: 'leather jacket', start: 35, end: 49, role: 'subject.wardrobe', confidence: 0.92 },
            { text: 'walking slowly', start: 55, end: 69, role: 'subject.action', confidence: 0.85 },
            { text: 'dusty street', start: 80, end: 92, role: 'environment.location', confidence: 0.9 },
            { text: 'golden hour', start: 100, end: 111, role: 'lighting.timeOfDay', confidence: 0.93 },
            { text: 'dolly shot', start: 120, end: 130, role: 'camera.movement', confidence: 0.91 },
            { text: 'shot on 35mm', start: 135, end: 147, role: 'style.filmStock', confidence: 0.94 }
          ]
        });
      };

      const result = await labelSpans(
        {
          text: 'A cowboy with a weathered face in a leather jacket is walking slowly through a dusty street at golden hour. A dolly shot, shot on 35mm film.',
          maxSpans: 20,
          minConfidence: 0.5
        },
        { callFn: mockCallFn }
      );

      expect(result.spans.length).toBeGreaterThanOrEqual(8);
      
      // Verify each role is a valid taxonomy ID
      result.spans.forEach(span => {
        expect(typeof span.role).toBe('string');
        // Should be either a parent ID or a namespaced attribute ID
        expect(
          span.role.includes('.') || // attribute ID
          ['subject', 'environment', 'lighting', 'camera', 'style', 'technical', 'audio'].includes(span.role) // parent ID
        ).toBe(true);
      });
    });

    it('preserves span order and positions', async () => {
      const mockCallFn = async () => {
        return JSON.stringify({
          spans: [
            { text: 'third', start: 20, end: 25, role: 'subject', confidence: 0.9 },
            { text: 'first', start: 0, end: 5, role: 'lighting', confidence: 0.85 },
            { text: 'second', start: 10, end: 16, role: 'camera', confidence: 0.88 }
          ]
        });
      };

      const result = await labelSpans(
        {
          text: 'first and second and third spans',
          maxSpans: 10,
          minConfidence: 0.5
        },
        { callFn: mockCallFn }
      );

      expect(result.spans).toHaveLength(3);
      // Should be sorted by start position
      expect(result.spans[0].start).toBeLessThan(result.spans[1].start);
      expect(result.spans[1].start).toBeLessThan(result.spans[2].start);
    });

    it('filters spans below minimum confidence threshold', async () => {
      const mockCallFn = async () => {
        return JSON.stringify({
          spans: [
            { text: 'high confidence', start: 0, end: 15, role: 'subject', confidence: 0.95 },
            { text: 'low confidence', start: 20, end: 34, role: 'lighting', confidence: 0.3 }
          ]
        });
      };

      const result = await labelSpans(
        {
          text: 'Some high confidence and low confidence text',
          maxSpans: 10,
          minConfidence: 0.5
        },
        { callFn: mockCallFn }
      );

      // Only high confidence span should pass
      expect(result.spans).toHaveLength(1);
      expect(result.spans[0].text).toBe('high confidence');
      expect(result.spans[0].confidence).toBe(0.95);
    });
  });
});

