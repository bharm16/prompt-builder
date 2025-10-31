import { describe, it, expect } from 'vitest';
import { labelSpans } from '../span-labeling/SpanLabelingService.js';

describe('labelSpans integration', () => {
  it('returns up to 60 spans with expanded token budget', async () => {
    const maxSpans = 60;
    const parts = Array.from({ length: maxSpans }, (_, index) => `phrase_${index}`);
    const text = parts.join(' ');

    let offset = 0;
    const spans = parts.map((word) => {
      const span = {
        text: word,
        start: offset,
        end: offset + word.length,
        role: 'Descriptive',
        confidence: 0.95,
      };
      offset += word.length + 1;
      return span;
    });

    const callArgs = [];
    const testCallFn = async (payload) => {
      callArgs.push(payload);
      return JSON.stringify({
        spans,
        meta: {
          version: 'v1',
          notes: '',
        },
      });
    };

    const result = await labelSpans(
      {
        text,
        maxSpans,
      },
      { callFn: testCallFn }
    );

    expect(callArgs).toHaveLength(1);
    expect(callArgs[0].max_tokens).toBe(1900);
    expect(result.spans).toHaveLength(maxSpans);
    expect(result.meta.version).toBe('v1');
    expect(result.meta.notes).toBe('');
  });
});
