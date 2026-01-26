import { describe, expect, it } from 'vitest';
import { createHash } from 'crypto';

import { mergeAdjacentSpans } from '@llm/span-labeling/processing/AdjacentSpanMerger';
import { filterByConfidence } from '@llm/span-labeling/processing/ConfidenceFilter';
import { filterHeaders, isLikelyHeader } from '@llm/span-labeling/processing/HeaderFilter';
import { resolveOverlaps } from '@llm/span-labeling/processing/OverlapResolver';
import { deduplicateSpans as deduplicateSpanInputs } from '@llm/span-labeling/processing/SpanDeduplicator';
import { normalizeSpan } from '@llm/span-labeling/processing/SpanNormalizer';
import { truncateToMaxSpans } from '@llm/span-labeling/processing/SpanTruncator';
import { filterNonVisualSpans } from '@llm/span-labeling/processing/VisualOnlyFilter';
import { TAXONOMY } from '#shared/taxonomy';

import type { SpanLike } from '@llm/span-labeling/types';

describe('span labeling processing utilities', () => {
  describe('mergeAdjacentSpans', () => {
    it('returns empty list when spans are null or too short to merge', () => {
      expect(mergeAdjacentSpans(null, 'text').spans).toEqual([]);
      const single = mergeAdjacentSpans([{ text: 'Only', start: 0, end: 4, role: 'shot' }], 'Only');
      expect(single.spans).toHaveLength(1);
      expect(single.notes).toHaveLength(0);
    });

    it('does not merge spans when the gap is too large or incompatible', () => {
      const text = 'Action and Shot';
      const spans: SpanLike[] = [
        { text: 'Action', start: 0, end: 6, role: 'action' },
        { text: 'Shot', start: 11, end: 15, role: 'shot.type' },
      ];
      const result = mergeAdjacentSpans(spans, text);
      expect(result.spans).toHaveLength(2);
      expect(result.notes).toHaveLength(0);
    });

    it('merges adjacent compatible spans and selects the more specific role', () => {
      const text = 'Action Shot';
      const spans: SpanLike[] = [
        { text: 'Action', start: 0, end: 6, role: 'shot', confidence: 0.6 },
        { text: 'Shot', start: 7, end: 11, role: 'shot.type', confidence: 0.8 },
      ];
      const result = mergeAdjacentSpans(spans, text);
      expect(result.spans).toHaveLength(1);
      expect(result.spans[0]?.text).toBe('Action Shot');
      expect(result.spans[0]?.role).toBe('shot.type');
      expect(result.spans[0]?.confidence).toBeCloseTo(0.7, 4);
      expect(result.notes[0]).toContain('Merged 2 adjacent shot spans');
    });

    it('respects maxMergedWords limit', () => {
      const text = 'Action Shot Sequence';
      const spans: SpanLike[] = [
        { text: 'Action', start: 0, end: 6, role: 'shot' },
        { text: 'Shot', start: 7, end: 11, role: 'shot.type' },
        { text: 'Sequence', start: 12, end: 20, role: 'shot.type' },
      ];
      const result = mergeAdjacentSpans(spans, text, { maxMergedWords: 1 });
      expect(result.spans).toHaveLength(3);
    });
  });

  describe('filterByConfidence', () => {
    it('drops spans below the minimum confidence with notes', () => {
      const spans: SpanLike[] = [
        { text: 'Low', start: 0, end: 3, confidence: 0.2 },
        { text: 'High', start: 4, end: 8, confidence: 0.8 },
      ];
      const result = filterByConfidence(spans, 0.5);
      expect(result.spans).toHaveLength(1);
      expect(result.spans[0]?.text).toBe('High');
      expect(result.notes).toHaveLength(1);
      expect(result.notes[0]).toContain('confidence 0.20');
      expect(result.notes[0]).toContain('threshold 0.5');
    });

    it('treats missing confidence as 0', () => {
      const spans: SpanLike[] = [{ text: 'Unknown', start: 0, end: 7 }];
      const result = filterByConfidence(spans, 0.1);
      expect(result.spans).toHaveLength(0);
      expect(result.notes[0]).toContain('confidence 0.00');
    });
  });

  describe('HeaderFilter', () => {
    it('flags common header patterns', () => {
      expect(isLikelyHeader('**Camera**')).toBe(true);
      expect(isLikelyHeader('CAMERA')).toBe(true);
      expect(isLikelyHeader('Aspect Ratio:')).toBe(true);
    });

    it('keeps descriptive content that is not a header', () => {
      expect(isLikelyHeader('camera moves smoothly')).toBe(false);
    });

    it('filters header spans and records notes', () => {
      const spans: SpanLike[] = [
        { text: '**Camera**', start: 0, end: 10, role: 'camera' },
        { text: 'slow pan', start: 11, end: 19, role: 'camera.movement' },
      ];
      const result = filterHeaders(spans);
      expect(result.spans).toHaveLength(1);
      expect(result.spans[0]?.text).toBe('slow pan');
      expect(result.notes[0]).toContain('Dropped header/label');
    });
  });

  describe('resolveOverlaps', () => {
    it('returns input spans when overlaps are allowed', () => {
      const spans: SpanLike[] = [
        { text: 'A', start: 0, end: 2, role: 'camera' },
        { text: 'B', start: 1, end: 3, role: 'camera.angle' },
      ];
      const result = resolveOverlaps(spans, true);
      expect(result.spans).toEqual(spans);
      expect(result.notes).toHaveLength(0);
    });

    it('keeps the most specific overlapping span within the same parent', () => {
      const spans: SpanLike[] = [
        { text: 'camera', start: 0, end: 6, role: 'camera', confidence: 0.9 },
        { text: 'camera angle', start: 0, end: 12, role: 'camera.angle', confidence: 0.5 },
      ];
      const result = resolveOverlaps(spans, false);
      expect(result.spans).toHaveLength(1);
      expect(result.spans[0]?.role).toBe('camera.angle');
      expect(result.notes[0]).toContain('kept "camera angle"');
    });

    it('does not resolve overlaps across different parent categories', () => {
      const spans: SpanLike[] = [
        { text: 'camera', start: 0, end: 6, role: 'camera', confidence: 0.6 },
        { text: 'style', start: 2, end: 7, role: 'style.aesthetic', confidence: 0.7 },
      ];
      const result = resolveOverlaps(spans, false);
      expect(result.spans).toHaveLength(2);
    });
  });

  describe('deduplicateSpans', () => {
    it('removes duplicate spans based on position and text', () => {
      const spans: SpanLike[] = [
        { text: 'pan', start: 0, end: 3, role: 'camera.movement' },
        { text: 'pan', start: 0, end: 3, role: 'camera.movement' },
      ];
      const result = deduplicateSpanInputs(spans);
      expect(result.spans).toHaveLength(1);
      expect(result.notes).toHaveLength(1);
    });
  });

  describe('normalizeSpan', () => {
    it('returns null when role is invalid in strict mode', () => {
      const result = normalizeSpan(
        { text: 'thing', start: 0, end: 5, role: 'invalid-role' },
        'thing',
        false
      );
      expect(result).toBeNull();
    });

    it('assigns default role and stable id in lenient mode', () => {
      const sourceText = 'hello world';
      const result = normalizeSpan(
        { text: 'hello', start: 0, end: 5, role: 'invalid-role', confidence: 1.5 },
        sourceText,
        true
      );
      expect(result?.role).toBe(TAXONOMY.SUBJECT.id);
      expect(result?.confidence).toBe(1);
      const textHash = createHash('sha256').update(sourceText).digest('hex').substring(0, 8);
      expect(result?.id).toBe(`${textHash}-0-5-${TAXONOMY.SUBJECT.id}`);
    });
  });

  describe('truncateToMaxSpans', () => {
    it('returns original spans when below max', () => {
      const spans: SpanLike[] = [
        { text: 'one', start: 0, end: 3, confidence: 0.5 },
      ];
      const result = truncateToMaxSpans(spans, 2);
      expect(result.spans).toEqual(spans);
      expect(result.notes).toHaveLength(0);
    });

    it('keeps highest confidence spans and preserves position order', () => {
      const spans: SpanLike[] = [
        { text: 'low', start: 0, end: 3, confidence: 0.2 },
        { text: 'mid', start: 10, end: 13, confidence: 0.6 },
        { text: 'high', start: 5, end: 9, confidence: 0.9 },
      ];
      const result = truncateToMaxSpans(spans, 2);
      expect(result.spans).toHaveLength(2);
      expect(result.spans[0]?.text).toBe('high');
      expect(result.spans[1]?.text).toBe('mid');
      expect(result.notes[0]).toContain('removed 1 spans');
    });
  });

  describe('filterNonVisualSpans', () => {
    it('drops meta labels, variation headers, and style references', () => {
      const text = [
        'Camera: Close up shot.',
        'Inspired by Stanley Kubrick.',
        'Alternatives',
        '**Variation 1 (Alternate Angle):** Low angle view.',
        'Main Action: chase sequence.',
      ].join('\n');

      const spans: SpanLike[] = [
        { text: 'Camera', start: text.indexOf('Camera'), end: text.indexOf('Camera') + 6, role: 'camera' },
        { text: 'Alternate Angle', start: text.indexOf('Alternate Angle'), end: text.indexOf('Alternate Angle') + 15, role: 'camera.angle' },
        { text: 'Low angle', start: text.indexOf('Low angle'), end: text.indexOf('Low angle') + 9, role: 'camera.angle' },
        { text: 'Stanley Kubrick', start: text.indexOf('Stanley Kubrick'), end: text.indexOf('Stanley Kubrick') + 15, role: 'style.aesthetic' },
        { text: 'Main Action', start: text.indexOf('Main Action'), end: text.indexOf('Main Action') + 11, role: 'action' },
      ];

      const result = filterNonVisualSpans(spans, text);
      expect(result.spans.map(span => span.text)).toEqual(['Low angle']);
      expect(result.notes).toHaveLength(4);
      expect(result.notes.join(' ')).toContain('Dropped');
    });
  });
});
