import { describe, expect, it } from 'vitest';

import { sanitizeText, serializePolicy } from '@features/span-highlighting/utils/textUtils';

describe('textUtils', () => {
  it('sanitizes text using NFC', () => {
    expect(sanitizeText('test')).toBe('test');
    expect(sanitizeText(null)).toBe('');
  });

  it('serializes policy objects deterministically', () => {
    const policy = { b: 2, a: 1, nested: { c: 3 } };
    expect(serializePolicy(policy)).toBe('a:1|b:2|nested:{"c":3}');
  });
});
