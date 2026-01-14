import { describe, expect, it } from 'vitest';

import { buildLabelSpansBody } from '@features/span-highlighting/api/spanLabelingRequest';

describe('spanLabelingRequest', () => {
  it('builds JSON payload from input', () => {
    const payload = {
      text: 'hello',
      maxSpans: 10,
      minConfidence: 0.5,
      policy: { allowOverlap: false },
      templateVersion: 'v1',
    };

    expect(buildLabelSpansBody(payload)).toBe(JSON.stringify(payload));
  });
});
