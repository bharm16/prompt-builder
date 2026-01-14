import { describe, expect, it, vi, afterEach } from 'vitest';

import { debounce } from '@features/prompt-optimizer/utils/debounce';

describe('debounce', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('delays invocation until wait time has elapsed', () => {
    vi.useFakeTimers();
    const handler = vi.fn();
    const debounced = debounce(handler, 200);

    debounced('first');
    debounced('second');

    expect(handler).not.toHaveBeenCalled();

    vi.advanceTimersByTime(199);
    expect(handler).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith('second');
  });

  it('can be cancelled to prevent invocation', () => {
    vi.useFakeTimers();
    const handler = vi.fn();
    const debounced = debounce(handler, 100);

    debounced('value');
    debounced.cancel();

    vi.advanceTimersByTime(200);
    expect(handler).not.toHaveBeenCalled();
  });
});
