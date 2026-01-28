import { describe, expect, it } from 'vitest';

import { createHighlightSignature } from '@features/span-highlighting/hooks/useSpanLabeling';
import { buildCacheKey } from '@features/span-highlighting/utils/cacheKey';
import { hashString } from '@features/span-highlighting/utils/hashing';

describe('span labeling cache keys', () => {
  it('builds a stable cache key for equivalent policy objects', () => {
    const basePayload = {
      text: 'hello world',
      maxSpans: 10,
      minConfidence: 0.5,
      templateVersion: 'v1',
    };

    const keyA = buildCacheKey(
      {
        ...basePayload,
        policy: { allowOverlap: true, nonTechnicalWordLimit: 3 },
      },
      hashString
    );

    const keyB = buildCacheKey(
      {
        ...basePayload,
        policy: { nonTechnicalWordLimit: 3, allowOverlap: true },
      },
      hashString
    );

    const keyC = buildCacheKey(
      {
        ...basePayload,
        text: 'hello world!',
        policy: { allowOverlap: true, nonTechnicalWordLimit: 3 },
      },
      hashString
    );

    expect(keyA).toBe(keyB);
    expect(keyA).not.toBe(keyC);
  });

  it('generates different signatures when text changes', () => {
    const signatureA = createHighlightSignature('consistent text');
    const signatureB = createHighlightSignature('consistent text');
    const signatureC = createHighlightSignature('consistent text!');

    expect(signatureA).toBe(signatureB);
    expect(signatureA).not.toBe(signatureC);
  });
});
