import { describe, it, expect } from 'vitest';
import { VERSIONS, getVersionString, getVersionHash } from '#shared/version';

describe('VERSIONS', () => {
  it('has exactly 4 keys', () => {
    expect(Object.keys(VERSIONS)).toHaveLength(4);
  });

  it('contains the expected keys', () => {
    expect(Object.keys(VERSIONS)).toEqual(
      expect.arrayContaining(['TAXONOMY', 'PROMPT', 'CACHE', 'API'])
    );
  });
});

describe('getVersionString', () => {
  it('joins all version values with hyphens', () => {
    const expected = Object.values(VERSIONS).join('-');
    expect(getVersionString()).toBe(expected);
  });

  it('contains each individual version value', () => {
    const result = getVersionString();
    for (const value of Object.values(VERSIONS)) {
      expect(result).toContain(value);
    }
  });
});

describe('getVersionHash', () => {
  it('returns a non-empty string', () => {
    const result = getVersionHash();
    expect(result).toBeTruthy();
    expect(result.length).toBeGreaterThan(0);
  });

  it('is deterministic across repeated calls', () => {
    const first = getVersionHash();
    const second = getVersionHash();
    const third = getVersionHash();
    expect(first).toBe(second);
    expect(second).toBe(third);
  });

  it('returns a base-36 string (only 0-9 and a-z)', () => {
    const result = getVersionHash();
    expect(result).toMatch(/^[0-9a-z]+$/);
  });

  it('is different from getVersionString', () => {
    expect(getVersionHash()).not.toBe(getVersionString());
  });
});
