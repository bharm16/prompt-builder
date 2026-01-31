import { describe, it, expect } from 'vitest';
import { VERSIONS, getVersionString, getVersionHash } from '../version';

describe('getVersionString', () => {
  describe('edge cases', () => {
    it('returns a non-empty string', () => {
      expect(getVersionString().length).toBeGreaterThan(0);
    });

    it('contains all version values', () => {
      const result = getVersionString();
      for (const version of Object.values(VERSIONS)) {
        expect(result).toContain(version);
      }
    });

    it('uses hyphen as separator', () => {
      const parts = getVersionString().split('-');
      expect(parts.length).toBe(Object.values(VERSIONS).length);
    });
  });

  describe('core behavior', () => {
    it('is deterministic', () => {
      expect(getVersionString()).toBe(getVersionString());
    });

    it('matches exact concatenation of VERSIONS values', () => {
      expect(getVersionString()).toBe(Object.values(VERSIONS).join('-'));
    });
  });
});

describe('getVersionHash', () => {
  describe('edge cases', () => {
    it('returns a non-empty string', () => {
      expect(getVersionHash().length).toBeGreaterThan(0);
    });

    it('returns a base-36 string (only alphanumeric lowercase)', () => {
      expect(getVersionHash()).toMatch(/^[0-9a-z]+$/);
    });
  });

  describe('core behavior', () => {
    it('is deterministic', () => {
      expect(getVersionHash()).toBe(getVersionHash());
    });

    it('produces non-negative value (no leading minus)', () => {
      expect(getVersionHash().startsWith('-')).toBe(false);
    });
  });
});

describe('VERSIONS', () => {
  it('has all expected keys', () => {
    expect(VERSIONS).toHaveProperty('TAXONOMY');
    expect(VERSIONS).toHaveProperty('PROMPT');
    expect(VERSIONS).toHaveProperty('CACHE');
    expect(VERSIONS).toHaveProperty('API');
  });

  it('all values are semver-like strings', () => {
    for (const val of Object.values(VERSIONS)) {
      expect(val).toMatch(/^\d+\.\d+\.\d+$/);
    }
  });
});
