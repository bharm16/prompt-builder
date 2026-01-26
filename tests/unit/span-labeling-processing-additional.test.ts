import { describe, expect, it } from 'vitest';

import { mergeAdjacentSpans } from '@server/llm/span-labeling/processing/AdjacentSpanMerger';
import { filterByConfidence } from '@server/llm/span-labeling/processing/ConfidenceFilter';
import { filterHeaders, isLikelyHeader } from '@server/llm/span-labeling/processing/HeaderFilter';
import { resolveOverlaps } from '@server/llm/span-labeling/processing/OverlapResolver';
import { deduplicateSpans } from '@server/llm/span-labeling/processing/SpanDeduplicator';
import { normalizeSpan } from '@server/llm/span-labeling/processing/SpanNormalizer';
import { truncateToMaxSpans } from '@server/llm/span-labeling/processing/SpanTruncator';
import { filterNonVisualSpans } from '@server/llm/span-labeling/processing/VisualOnlyFilter';
import type { SpanLike } from '@server/llm/span-labeling/types';

const makeSpan = (text: string, start: number, role?: string, confidence = 0.5): SpanLike => ({
  text,
  start,
  end: start + text.length,
  role,
  confidence,
});

describe('AdjacentSpanMerger (additional)', () => {
  describe('error handling', () => {
    it('returns empty result for null spans', () => {
      const result = mergeAdjacentSpans(null, 'Hello world');

      expect(result.spans).toEqual([]);
      expect(result.notes).toEqual([]);
    });

    it('does not merge when gap contains non-mergeable characters', () => {
      const text = 'Action/Shot';
      const spans = [
        makeSpan('Action', 0, 'action'),
        makeSpan('Shot', 7, 'action.type'),
      ];

      const result = mergeAdjacentSpans(spans, text);

      expect(result.spans).toHaveLength(2);
      expect(result.notes).toEqual([]);
      expect(result.spans[0]?.text).toBe('Action');
    });
  });

  describe('edge cases', () => {
    it('respects the maxMergedWords option', () => {
      const text = 'Action Shot';
      const spans = [
        makeSpan('Action', 0, 'action'),
        makeSpan('Shot', 7, 'action.type'),
      ];

      const result = mergeAdjacentSpans(spans, text, { maxMergedWords: 1 });

      expect(result.spans).toHaveLength(2);
      expect(result.notes).toEqual([]);
    });

    it('keeps spans separate when parent roles differ', () => {
      const text = 'Hero runs';
      const spans = [
        makeSpan('Hero', 0, 'subject.identity'),
        makeSpan('runs', 5, 'action.movement'),
      ];

      const result = mergeAdjacentSpans(spans, text);

      expect(result.spans).toHaveLength(2);
      expect(result.notes).toEqual([]);
    });
  });

  describe('core behavior', () => {
    it('merges adjacent spans and preserves the most specific role', () => {
      const text = 'Action Shot';
      const spans = [
        makeSpan('Action', 0, 'action', 0.4),
        makeSpan('Shot', 7, 'action.type', 0.8),
      ];

      const result = mergeAdjacentSpans(spans, text);

      expect(result.spans).toHaveLength(1);
      expect(result.spans[0]?.text).toBe('Action Shot');
      expect(result.spans[0]?.role).toBe('action.type');
      expect(result.spans[0]?.confidence).toBeCloseTo(0.6, 3);
      expect(result.notes[0]).toContain('Merged 2 adjacent action spans');
    });
  });
});

describe('ConfidenceFilter (additional)', () => {
  describe('error handling', () => {
    it('drops spans with missing confidence values', () => {
      const span = makeSpan('Low', 0, 'style', 0.5);
      delete (span as { confidence?: number }).confidence;
      const spans = [span];

      const result = filterByConfidence(spans, 0.2);

      expect(result.spans).toEqual([]);
      expect(result.notes[0]).toContain('confidence 0.00');
    });

    it('drops spans when threshold is above any possible confidence', () => {
      const spans = [makeSpan('Keep?', 0, 'style', 1.0)];

      const result = filterByConfidence(spans, 1.1);

      expect(result.spans).toEqual([]);
      expect(result.notes[0]).toContain('threshold 1.1');
    });
  });

  describe('edge cases', () => {
    it('keeps zero-confidence spans when threshold is zero', () => {
      const spans = [makeSpan('Zero', 0, 'style', 0)];

      const result = filterByConfidence(spans, 0);

      expect(result.spans).toHaveLength(1);
      expect(result.spans[0]?.text).toBe('Zero');
    });

    it('treats non-numeric confidence as zero for filtering', () => {
      const spans = [
        { ...makeSpan('Weird', 0, 'style', 0.9), confidence: 'high' as unknown as number },
      ];

      const result = filterByConfidence(spans, 0.1);

      expect(result.spans).toEqual([]);
      expect(result.notes[0]).toContain('confidence 0.00');
    });
  });

  describe('core behavior', () => {
    it('filters low-confidence spans and keeps the rest', () => {
      const spans = [
        makeSpan('Keep', 0, 'style', 0.9),
        makeSpan('Drop', 5, 'style', 0.1),
      ];

      const result = filterByConfidence(spans, 0.5);

      expect(result.spans).toHaveLength(1);
      expect(result.spans[0]?.text).toBe('Keep');
      expect(result.notes[0]).toContain('Drop');
    });
  });
});

describe('HeaderFilter (additional)', () => {
  describe('error handling', () => {
    it('flags very short text as header/label', () => {
      expect(isLikelyHeader(' ')).toBe(true);
      expect(isLikelyHeader('A')).toBe(true);
    });

    it('filters markdown headers', () => {
      const spans = [makeSpan('## Camera', 0, 'camera')];

      const result = filterHeaders(spans);

      expect(result.spans).toEqual([]);
      expect(result.notes[0]).toContain('Dropped header/label "## Camera"');
    });
  });

  describe('edge cases', () => {
    it('filters bold section titles', () => {
      expect(isLikelyHeader('**Camera**')).toBe(true);
    });

    it('filters colon-terminated labels', () => {
      expect(isLikelyHeader('Duration:')).toBe(true);
    });
  });

  describe('core behavior', () => {
    it('keeps actual descriptive spans', () => {
      const spans = [makeSpan('Soft lighting', 0, 'lighting')];

      const result = filterHeaders(spans);

      expect(result.spans).toHaveLength(1);
      expect(result.spans[0]?.text).toBe('Soft lighting');
      expect(result.notes).toEqual([]);
    });
  });
});

describe('OverlapResolver (additional)', () => {
  describe('error handling', () => {
    it('returns original spans when overlaps are allowed', () => {
      const spans = [makeSpan('Hero', 0, 'subject', 0.5)];

      const result = resolveOverlaps(spans, true);

      expect(result.spans).toBe(spans);
      expect(result.notes).toEqual([]);
    });

    it('keeps overlapping spans with different parent categories', () => {
      const spans = [
        makeSpan('Hero', 0, 'subject.identity', 0.5),
        makeSpan('runs', 1, 'action.movement', 0.6),
      ];

      const result = resolveOverlaps(spans, false);

      expect(result.spans).toHaveLength(2);
      expect(result.notes).toEqual([]);
    });
  });

  describe('edge cases', () => {
    it('prefers higher specificity when roles overlap', () => {
      const spans = [
        makeSpan('run', 0, 'action', 0.9),
        makeSpan('running', 0, 'action.movement', 0.2),
      ];

      const result = resolveOverlaps(spans, false);

      expect(result.spans).toHaveLength(1);
      expect(result.spans[0]?.role).toBe('action.movement');
    });

    it('prefers higher confidence for same specificity overlaps', () => {
      const spans = [
        makeSpan('blue', 0, 'style', 0.2),
        makeSpan('blue light', 0, 'style', 0.9),
      ];

      const result = resolveOverlaps(spans, false);

      expect(result.spans).toHaveLength(1);
      expect(result.spans[0]?.text).toBe('blue light');
    });
  });

  describe('core behavior', () => {
    it('records overlap notes when a span is discarded', () => {
      const spans = [
        makeSpan('cat', 0, 'subject', 0.4),
        makeSpan('cat portrait', 0, 'subject', 0.8),
      ];

      const result = resolveOverlaps(spans, false);

      expect(result.spans).toHaveLength(1);
      expect(result.notes).toHaveLength(1);
      expect(result.notes[0]).toContain('kept "cat portrait"');
    });
  });
});

describe('SpanDeduplicator (additional)', () => {
  describe('error handling', () => {
    it('removes duplicate spans and records notes', () => {
      const spans = [
        makeSpan('alpha', 0, 'style'),
        makeSpan('alpha', 0, 'style'),
      ];

      const result = deduplicateSpans(spans);

      expect(result.spans).toHaveLength(1);
      expect(result.notes[0]).toBe('span[1] ignored: duplicate span');
    });

    it('deduplicates repeated spans even when non-adjacent', () => {
      const spans = [
        makeSpan('alpha', 0, 'style'),
        makeSpan('beta', 6, 'style'),
        makeSpan('alpha', 0, 'style'),
      ];

      const result = deduplicateSpans(spans);

      expect(result.spans).toHaveLength(2);
      expect(result.notes[0]).toBe('span[2] ignored: duplicate span');
    });
  });

  describe('edge cases', () => {
    it('treats spans with same position but different text as unique', () => {
      const spans = [
        makeSpan('alpha', 0, 'style'),
        makeSpan('beta', 0, 'style'),
      ];

      const result = deduplicateSpans(spans);

      expect(result.spans).toHaveLength(2);
      expect(result.notes).toEqual([]);
    });

    it('keeps spans with matching text but different positions', () => {
      const spans = [
        makeSpan('alpha', 0, 'style'),
        makeSpan('alpha', 10, 'style'),
      ];

      const result = deduplicateSpans(spans);

      expect(result.spans).toHaveLength(2);
    });
  });

  describe('core behavior', () => {
    it('preserves the first occurrence ordering', () => {
      const spans = [
        makeSpan('alpha', 0, 'style'),
        makeSpan('beta', 6, 'style'),
      ];

      const result = deduplicateSpans(spans);

      expect(result.spans[0]?.text).toBe('alpha');
      expect(result.spans[1]?.text).toBe('beta');
    });
  });
});

describe('SpanNormalizer (additional)', () => {
  describe('error handling', () => {
    it('returns null for invalid roles in strict mode', () => {
      const result = normalizeSpan(
        { text: 'Bad', start: 0, end: 3, role: 'not-a-role' },
        'Bad'
      );

      expect(result).toBeNull();
    });

    it('clamps confidence values above 1', () => {
      const result = normalizeSpan(
        { text: 'High', start: 0, end: 4, role: 'subject', confidence: 2 },
        'High'
      );

      expect(result?.confidence).toBe(1);
    });
  });

  describe('edge cases', () => {
    it('uses subject role for invalid roles in lenient mode', () => {
      const result = normalizeSpan(
        { text: 'Lenient', start: 0, end: 7, role: 'invalid-role' },
        'Lenient',
        true
      );

      expect(result?.role).toBe('subject');
    });

    it('generates deterministic IDs based on source text', () => {
      const span = { text: 'Hero', start: 0, end: 4, role: 'subject' };

      const first = normalizeSpan(span, 'Hero arrives');
      const second = normalizeSpan(span, 'Hero arrives');
      const third = normalizeSpan(span, 'Hero departs');

      expect(first?.id).toBe(second?.id);
      expect(first?.id).not.toBe(third?.id);
    });
  });

  describe('core behavior', () => {
    it('applies default confidence when missing', () => {
      const result = normalizeSpan(
        { text: 'Hero', start: 0, end: 4, role: 'subject' },
        'Hero'
      );

      expect(result?.confidence).toBe(0.7);
      expect(result?.role).toBe('subject');
    });
  });
});

describe('SpanTruncator (additional)', () => {
  describe('error handling', () => {
    it('removes all spans when maxSpans is zero', () => {
      const spans = [
        makeSpan('alpha', 0, 'style', 0.2),
        makeSpan('beta', 6, 'style', 0.1),
      ];

      const result = truncateToMaxSpans(spans, 0);

      expect(result.spans).toEqual([]);
      expect(result.notes[0]).toContain('removed 2 spans');
    });

    it('returns the original list when within limit', () => {
      const spans = [makeSpan('alpha', 0, 'style', 0.2)];

      const result = truncateToMaxSpans(spans, 3);

      expect(result.spans).toBe(spans);
      expect(result.notes).toEqual([]);
    });
  });

  describe('edge cases', () => {
    it('breaks confidence ties by earliest position', () => {
      const spans = [
        makeSpan('late', 10, 'style', 0.9),
        makeSpan('early', 0, 'style', 0.9),
      ];

      const result = truncateToMaxSpans(spans, 1);

      expect(result.spans).toHaveLength(1);
      expect(result.spans[0]?.text).toBe('early');
    });

    it('returns spans sorted by position after truncation', () => {
      const spans = [
        makeSpan('b', 10, 'style', 0.8),
        makeSpan('a', 0, 'style', 0.9),
        makeSpan('c', 20, 'style', 0.7),
      ];

      const result = truncateToMaxSpans(spans, 2);

      expect(result.spans.map((span) => span.text)).toEqual(['a', 'b']);
    });
  });

  describe('core behavior', () => {
    it('keeps highest confidence spans and reports removal count', () => {
      const spans = [
        makeSpan('top', 0, 'style', 0.9),
        makeSpan('mid', 5, 'style', 0.6),
        makeSpan('low', 10, 'style', 0.2),
      ];

      const result = truncateToMaxSpans(spans, 2);

      expect(result.spans).toHaveLength(2);
      expect(result.notes[0]).toContain('removed 1 spans');
    });
  });
});

describe('VisualOnlyFilter (additional)', () => {
  describe('error handling', () => {
    it('filters meta spans outside alternatives', () => {
      const spans = [makeSpan('Lighting', 0, 'lighting')];

      const result = filterNonVisualSpans(spans, 'Lighting');

      expect(result.spans).toEqual([]);
      expect(result.notes[0]).toContain('Dropped non-visual span "Lighting"');
    });

    it('filters style-reference spans when context matches', () => {
      const text = 'A scene inspired by Wes Anderson with pastel tones.';
      const start = text.indexOf('Wes Anderson');
      const spans = [makeSpan('Wes Anderson', start, 'style.reference')];

      const result = filterNonVisualSpans(spans, text);

      expect(result.spans).toEqual([]);
      expect(result.notes[0]).toContain('Dropped style-reference span');
    });
  });

  describe('edge cases', () => {
    it('drops variation header spans inside alternatives section', () => {
      const text = 'Alternatives\n**Variation 1 (Alternate Angle):**\nSlow dolly.';
      const start = text.indexOf('Alternate Angle');
      const spans = [makeSpan('Alternate Angle', start, 'shot.type')];

      const result = filterNonVisualSpans(spans, text);

      expect(result.spans).toEqual([]);
      expect(result.notes[0]).toContain('variation-header span');
    });

    it('filters meta markers inside alternatives while keeping visual spans', () => {
      const text = 'Alternatives\nMain Action: running fast.';
      const metaStart = text.indexOf('Main Action');
      const visualStart = text.indexOf('running fast');
      const spans = [
        makeSpan('Main Action', metaStart, 'action'),
        makeSpan('running fast', visualStart, 'action.movement'),
      ];

      const result = filterNonVisualSpans(spans, text);

      expect(result.spans).toHaveLength(1);
      expect(result.spans[0]?.text).toBe('running fast');
    });
  });

  describe('core behavior', () => {
    it('keeps visual spans that are not meta text', () => {
      const text = 'A glowing neon alley.';
      const start = text.indexOf('glowing neon');
      const spans = [makeSpan('glowing neon', start, 'style')];

      const result = filterNonVisualSpans(spans, text);

      expect(result.spans).toHaveLength(1);
      expect(result.spans[0]?.text).toBe('glowing neon');
      expect(result.notes).toEqual([]);
    });
  });
});
