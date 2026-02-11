import { describe, expect, it } from 'vitest';
import { safeUrlHost } from '../url';

describe('safeUrlHost', () => {
  it('returns hostname for valid URL strings', () => {
    expect(safeUrlHost('https://example.com/path?q=1')).toBe('example.com');
  });

  it('returns null for invalid or empty values', () => {
    expect(safeUrlHost('')).toBeNull();
    expect(safeUrlHost('not-a-url')).toBeNull();
    expect(safeUrlHost(undefined)).toBeNull();
    expect(safeUrlHost(123)).toBeNull();
  });
});
