import { describe, expect, it } from 'vitest';

import SpanLabelingConfig from '@llm/span-labeling/config/SpanLabelingConfig';
import { injectDefensiveMeta } from '@llm/span-labeling/services/robust-llm-client/defensiveMeta';

import type { ProcessingOptions } from '@llm/span-labeling/types';

describe('injectDefensiveMeta', () => {
  it('adds analysis trace and meta defaults when missing', () => {
    const value: Record<string, unknown> = { spans: [{ text: 'cat' }] };
    const options = { templateVersion: 'v2' } as ProcessingOptions;

    injectDefensiveMeta(value, options, 2);

    expect(typeof value.analysis_trace).toBe('string');
    expect((value.meta as Record<string, unknown>).version).toBe('v2');
    expect((value.meta as Record<string, unknown>).notes).toContain('Labeled 1 spans');

    const meta = value.meta as Record<string, unknown>;
    if (SpanLabelingConfig.NLP_FAST_PATH.TRACK_METRICS) {
      expect(meta.nlpAttempted).toBe(true);
      expect(meta.nlpSpansFound).toBe(2);
      expect(meta.nlpBypassFailed).toBe(true);
    }
  });

  it('ensures meta has required fields when partially provided', () => {
    const value: Record<string, unknown> = { spans: [], meta: { version: 'v1' } };
    const options = { templateVersion: 'v3' } as ProcessingOptions;

    injectDefensiveMeta(value, options);

    const meta = value.meta as Record<string, unknown>;
    expect(meta.version).toBe('v1');
    expect(meta.notes).toBe('');
  });
});
