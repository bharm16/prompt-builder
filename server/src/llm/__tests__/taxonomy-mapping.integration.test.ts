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
import { TAXONOMY } from '@shared/taxonomy';

interface MockSpan {
  text: string;
  start: number;
  end: number;
  role: string;
  confidence: number;
}

describe('Taxonomy Mapping Integration', () => {
  describe('End-to-end LLM response with taxonomy IDs', () => {
    it('handles taxonomy IDs from LLM response', async () => {
      const mockCallFn = async (): Promise<string> => {
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
      expect(result.spans[0]?.role).toBe('subject.identity');
      expect(result.spans[1]?.role).toBe('subject.wardrobe');
      expect(result.spans[2]?.role).toBe('subject.action');
    });

    it('handles parent category IDs', async () => {
      const mockCallFn = async (): Promise<string> => {
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
          text: 'A diner with neon lights, dolly shot',
          maxSpans: 10,
          minConfidence: 0.5
        },
        { callFn: mockCallFn }
      );

      expect(result.spans).toHaveLength(3);
      expect(result.spans[0]?.role).toBe('environment');
      expect(result.spans[1]?.role).toBe('lighting');
      expect(result.spans[2]?.role).toBe('camera');
    });

    it('normalizes legacy capitalized roles to taxonomy IDs', async () => {
      const mockCallFn = async (): Promise<string> => {
        return JSON.stringify({
          spans: [
            { text: 'cowboy', start: 0, end: 6, role: 'Subject', confidence: 0.9 },
            { text: 'walking', start: 10, end: 17, role: 'Action', confidence: 0.85 }
          ]
        });
      };

      const result = await labelSpans(
        {
          text: 'A cowboy walking',
          maxSpans: 10,
          minConfidence: 0.5
        },
        { callFn: mockCallFn }
      );

      // Should normalize to lowercase taxonomy IDs
      expect(result.spans[0]?.role).toBe(TAXONOMY.SUBJECT.id);
      expect(result.spans[1]?.role).toBe(TAXONOMY.ACTION.id);
    });

    it('handles mixed taxonomy and legacy formats', async () => {
      const mockCallFn = async (): Promise<string> => {
        return JSON.stringify({
          spans: [
            { text: 'cowboy', start: 0, end: 6, role: 'subject.identity', confidence: 0.95 },
            { text: 'leather', start: 10, end: 17, role: 'Wardrobe', confidence: 0.9 },
            { text: 'walking', start: 20, end: 27, role: 'subject.action', confidence: 0.85 }
          ]
        });
      };

      const result = await labelSpans(
        {
          text: 'A cowboy in leather walking',
          maxSpans: 10,
          minConfidence: 0.5
        },
        { callFn: mockCallFn }
      );

      expect(result.spans).toHaveLength(3);
      // First span uses taxonomy ID
      expect(result.spans[0]?.role).toBe('subject.identity');
      // Second span should normalize legacy format
      expect(result.spans[1]?.role).toBe(TAXONOMY.SUBJECT.attributes.WARDROBE);
      // Third span uses taxonomy ID
      expect(result.spans[2]?.role).toBe('subject.action');
    });

    it('validates taxonomy IDs against VALID_CATEGORIES', async () => {
      const mockCallFn = async (): Promise<string> => {
        return JSON.stringify({
          spans: [
            { text: 'test', start: 0, end: 4, role: 'invalid.category', confidence: 0.9 }
          ]
        });
      };

      const result = await labelSpans(
        {
          text: 'test',
          maxSpans: 10,
          minConfidence: 0.5
        },
        { callFn: mockCallFn }
      );

      // Invalid roles should be normalized to default (subject)
      expect(result.spans[0]?.role).toBe(TAXONOMY.SUBJECT.id);
    });
  });

  describe('Span normalization with taxonomy', () => {
    it('preserves taxonomy IDs during normalization', () => {
      const span = {
        text: 'cowboy',
        start: 0,
        end: 6,
        role: 'subject.identity',
        confidence: 0.95
      };

      const normalized = normalizeSpan(span);

      expect(normalized.role).toBe('subject.identity');
      expect(normalized.text).toBe('cowboy');
    });

    it('normalizes legacy roles to taxonomy IDs', () => {
      const span = {
        text: 'wardrobe',
        start: 0,
        end: 8,
        role: 'Wardrobe',
        confidence: 0.9
      };

      const normalized = normalizeSpan(span);

      expect(normalized.role).toBe(TAXONOMY.SUBJECT.attributes.WARDROBE);
    });

    it('handles parent category normalization', () => {
      const span = {
        text: 'subject',
        start: 0,
        end: 7,
        role: 'Subject',
        confidence: 0.9
      };

      const normalized = normalizeSpan(span);

      expect(normalized.role).toBe(TAXONOMY.SUBJECT.id);
    });
  });

  describe('Taxonomy attribute validation', () => {
    it('validates subject attributes correctly', () => {
      const validAttributes = [
        'subject.identity',
        'subject.appearance',
        'subject.wardrobe',
        'subject.action',
        'subject.emotion'
      ];

      validAttributes.forEach(attr => {
        const span = {
          text: 'test',
          start: 0,
          end: 4,
          role: attr,
          confidence: 0.9
        };

        const normalized = normalizeSpan(span);
        expect(normalized.role).toBe(attr);
      });
    });

    it('validates camera attributes correctly', () => {
      const validAttributes = [
        'camera.framing',
        'camera.movement',
        'camera.lens',
        'camera.angle'
      ];

      validAttributes.forEach(attr => {
        const span = {
          text: 'test',
          start: 0,
          end: 4,
          role: attr,
          confidence: 0.9
        };

        const normalized = normalizeSpan(span);
        expect(normalized.role).toBe(attr);
      });
    });
  });
});

