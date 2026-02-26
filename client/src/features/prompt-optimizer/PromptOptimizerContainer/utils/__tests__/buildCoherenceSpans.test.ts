import { describe, expect, it } from 'vitest';
import type { HighlightSnapshot } from '@features/prompt-optimizer/PromptCanvas/types';
import { buildCoherenceSpansFromSnapshot } from '../buildCoherenceSpans';

describe('buildCoherenceSpansFromSnapshot', () => {
  it('returns empty array for null snapshot', () => {
    expect(buildCoherenceSpansFromSnapshot(null, 'prompt text')).toEqual([]);
  });

  it('filters spans with invalid start/end ranges', () => {
    const snapshot: HighlightSnapshot = {
      spans: [
        { start: 4, end: 4, category: 'camera', confidence: 0.8 },
        { start: 8, end: 6, category: 'camera', confidence: 0.8 },
        { start: 0, end: 5, category: 'scene', confidence: 0.9 },
      ],
    };

    const result = buildCoherenceSpansFromSnapshot(snapshot, 'hello world');

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      start: 0,
      end: 5,
      text: 'hello',
      category: 'scene',
    });
  });

  it('clamps span offsets to prompt length and builds stable ids', () => {
    const snapshot: HighlightSnapshot = {
      spans: [{ start: -4, end: 999, category: 'style', confidence: 0.7 }],
    };

    const result = buildCoherenceSpansFromSnapshot(snapshot, 'cinematic');

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      id: 'span_0_9_0',
      start: 0,
      end: 9,
      category: 'style',
      confidence: 0.7,
      text: 'cinematic',
      quote: 'cinematic',
    });
  });

  it('drops spans that become empty after slice and trim', () => {
    const snapshot: HighlightSnapshot = {
      spans: [{ start: 0, end: 3, category: 'scene', confidence: 0.5 }],
    };

    const result = buildCoherenceSpansFromSnapshot(snapshot, '   \n');

    expect(result).toEqual([]);
  });
});
