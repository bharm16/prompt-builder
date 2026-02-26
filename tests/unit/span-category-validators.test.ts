import { describe, expect, it } from 'vitest';

import { LEGACY_MAPPINGS, validateSpan } from '@features/span-highlighting/utils/categoryValidators';

const legacyKey: keyof typeof LEGACY_MAPPINGS = 'cameraMove';

describe('categoryValidators', () => {
  it('rejects missing span or empty text', () => {
    expect(validateSpan(null)).toEqual({ span: null, pass: false, reason: 'missing_span' });
    expect(validateSpan({ text: '   ' })).toEqual({
      span: { text: '   ' },
      pass: false,
      reason: 'empty_text',
    });
  });

  it('maps legacy categories to taxonomy ids', () => {
    const result = validateSpan({ text: 'pan', category: legacyKey });

    expect(result.pass).toBe(true);
    expect(result.category).toBe(LEGACY_MAPPINGS[legacyKey]);
  });

  it('rejects invalid taxonomy ids', () => {
    const result = validateSpan({ text: 'test', category: 'invalid.category' });

    expect(result.pass).toBe(false);
    expect(result.reason).toBe('invalid_taxonomy_id');
  });

  it('rejects spans when text is not found in source', () => {
    const taxonomyId = LEGACY_MAPPINGS[legacyKey];
    if (!taxonomyId) {
      throw new Error(`Missing legacy mapping for ${legacyKey}`);
    }
    const result = validateSpan({
      text: 'missing',
      category: taxonomyId,
      sourceText: 'hello world',
    });

    expect(result.pass).toBe(false);
    expect(result.reason).toBe('text_not_in_source');
  });
});
