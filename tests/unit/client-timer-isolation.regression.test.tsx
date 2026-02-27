import { describe, expect, it, vi } from 'vitest';

describe('regression: client timer isolation', () => {
  it('allows a test to opt into fake timers', () => {
    expect(vi.isFakeTimers()).toBe(false);
    vi.useFakeTimers();
    expect(vi.isFakeTimers()).toBe(true);
  });

  it('starts the next test with real timers by default', () => {
    expect(vi.isFakeTimers()).toBe(false);
  });
});
