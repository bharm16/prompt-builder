import { describe, it, expect } from 'vitest';
import { filterNonVisualSpans } from '../VisualOnlyFilter';

const buildSpan = (text: string, start: number, end: number, role?: string) => ({
  text,
  start,
  end,
  role,
});

describe('filterNonVisualSpans', () => {
  describe('error handling', () => {
    it('drops meta taxonomy labels outside alternatives', () => {
      const text = 'Main Action happens here.';
      const spanText = 'Main Action';
      const start = text.indexOf(spanText);
      const spans = [buildSpan(spanText, start, start + spanText.length, 'action')];

      const result = filterNonVisualSpans(spans, text);

      expect(result.spans).toEqual([]);
      expect(result.notes[0]).toContain('Dropped non-visual span');
    });
  });

  describe('edge cases', () => {
    it('drops variation headers inside alternatives section', () => {
      const text = [
        'Intro paragraph.',
        'Alternatives',
        '**Variation 1 (Alternate Angle):**',
        'A wide shot of the desert.',
      ].join('\n');

      const spanText = 'Alternate Angle';
      const start = text.indexOf(spanText);
      const spans = [buildSpan(spanText, start, start + spanText.length, 'shot.type')];

      const result = filterNonVisualSpans(spans, text);

      expect(result.spans).toEqual([]);
      expect(result.notes[0]).toContain('variation-header');
    });
  });

  describe('core behavior', () => {
    it('keeps visual spans in alternatives but drops style references outside', () => {
      const text = [
        'Intro paragraph.',
        'Inspired by Van Gogh lighting.',
        'Alternatives',
        '**Variation 1 (Alternate Angle):**',
        'A wide shot of the desert.',
        'Main Action',
      ].join('\n');

      const styleText = 'Van Gogh';
      const styleStart = text.indexOf(styleText);
      const visualText = 'wide shot';
      const visualStart = text.indexOf(visualText);
      const metaText = 'Main Action';
      const metaStart = text.indexOf(metaText);
      const variationText = 'Alternate Angle';
      const variationStart = text.indexOf(variationText);

      const spans = [
        buildSpan(styleText, styleStart, styleStart + styleText.length, 'style.reference'),
        buildSpan(variationText, variationStart, variationStart + variationText.length, 'shot.type'),
        buildSpan(visualText, visualStart, visualStart + visualText.length, 'shot.type'),
        buildSpan(metaText, metaStart, metaStart + metaText.length, 'action'),
      ];

      const result = filterNonVisualSpans(spans, text);

      expect(result.spans).toHaveLength(1);
      expect(result.spans[0]?.text).toBe('wide shot');
      expect(result.notes.join(' ')).toContain('Dropped style-reference span');
      expect(result.notes.join(' ')).toContain('Dropped variation-header span');
      expect(result.notes.join(' ')).toContain('Dropped non-visual span in alternatives');
    });
  });
});
