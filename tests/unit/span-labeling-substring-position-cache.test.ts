import { describe, expect, it, beforeEach } from 'vitest';

import { SubstringPositionCache } from '@llm/span-labeling/cache/SubstringPositionCache';

describe('SubstringPositionCache', () => {
  let cache: SubstringPositionCache;

  beforeEach(() => {
    cache = new SubstringPositionCache();
    cache.resetTelemetry();
  });

  it('finds all matches and handles empty substring', () => {
    const matches = cache.findAllMatches('alpha beta alpha', 'alpha');
    expect(matches).toEqual([
      { start: 0, end: 5 },
      { start: 11, end: 16 },
    ]);

    expect(cache.findAllMatches('text', '')).toEqual([]);
  });

  it('returns the closest match using preferredStart', () => {
    const match = cache.findBestMatch('alpha beta alpha', 'alpha', 9);
    expect(match).toEqual({ start: 11, end: 16 });
  });

  it('falls back to case-insensitive matching', () => {
    const match = cache.findBestMatch('Hello World', 'world');
    expect(match).toEqual({ start: 6, end: 11 });
    const telemetry = cache.getTelemetry();
    expect(telemetry.caseInsensitiveMatches).toBe(1);
    expect(telemetry.totalRequests).toBe(1);
  });

  it('uses fuzzy matching for near-matches', () => {
    const match = cache.findBestMatch('running quickly', 'running quickli');
    expect(match).toEqual({ start: 0, end: 15 });
    const telemetry = cache.getTelemetry();
    expect(telemetry.fuzzyMatches).toBe(1);
  });

  it('tracks failures when no match is found', () => {
    const match = cache.findBestMatch('nothing here', 'missing');
    expect(match).toBeNull();
    const telemetry = cache.getTelemetry();
    expect(telemetry.failures).toBe(1);
  });
});
