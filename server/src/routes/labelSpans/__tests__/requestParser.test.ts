import { describe, it, expect } from 'vitest';
import { parseLabelSpansRequest } from '../requestParser';

describe('parseLabelSpansRequest', () => {
  it('maps isI2VMode to i2v templateVersion when missing', () => {
    const result = parseLabelSpansRequest({
      text: 'Camera pans left as she smiles.',
      isI2VMode: true,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.payload.templateVersion).toBe('i2v-v1');
  });
});
