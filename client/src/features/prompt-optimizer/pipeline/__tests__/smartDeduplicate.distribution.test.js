import { describe, it, expect } from 'vitest';
import { smartDeduplicate } from '../smartDeduplicate.js';
import { createCanonicalText } from '../../../../utils/canonicalText.js';

const buildSpan = ({ id, start, end, category, source = 'NLP' }) => ({
  id,
  start,
  end,
  displayStart: start,
  displayEnd: end,
  text: `segment-${id}`,
  quote: `segment-${id}`,
  displayQuote: `segment-${id}`,
  category,
  source,
  confidence: 0.9,
});

describe('smartDeduplicate distribution behavior', () => {
  it('drops later spans when category caps are hit, matching the current issue', () => {
    const paragraph = Array.from({ length: 60 }, (_, idx) => `word${idx}`).join(' ');
    const text = [
      `Paragraph one ${paragraph}.`,
      `Paragraph two ${paragraph}.`,
      `Paragraph three ${paragraph}.`,
    ].join('\n\n');

    const canonical = createCanonicalText(text);

    const spans = [
      buildSpan({ id: 'cam-1', start: 10, end: 30, category: 'camera' }),
      buildSpan({ id: 'cam-2', start: 60, end: 90, category: 'camera' }),
      buildSpan({ id: 'cam-3', start: 120, end: 150, category: 'camera' }),
      buildSpan({ id: 'cam-4', start: 300, end: 330, category: 'camera' }),
      buildSpan({ id: 'cam-5', start: 600, end: 630, category: 'camera' }),
      buildSpan({ id: 'cam-6', start: 900, end: 930, category: 'camera' }),
    ];

    const result = smartDeduplicate(spans, canonical);

    expect(result.map((span) => span.id)).toEqual([
      'cam-1',
      'cam-2',
      'cam-3',
      'cam-4',
      'cam-5',
      'cam-6',
    ]);
  });
});
