import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';

import { useClipboard } from '@features/prompt-optimizer/hooks/useClipboard';
vi.mock('@/services/LoggingService', () => ({
  logger: {
    child: () => ({ warn: vi.fn() }),
  },
}));

describe('useClipboard', () => {
  const originalClipboard = navigator.clipboard;

  beforeEach(() => {
    vi.useFakeTimers();
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
      configurable: true,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    Object.defineProperty(navigator, 'clipboard', {
      value: originalClipboard,
      configurable: true,
    });
  });

  it('sets copied state and resets after timeout', async () => {
    const { result } = renderHook(() => useClipboard());

    await act(async () => {
      await result.current.copy('text');
    });

    expect(result.current.copied).toBe(true);

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(result.current.copied).toBe(false);
  });

  it('logs warning when clipboard write fails', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('Denied'));
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });

    const { result } = renderHook(() => useClipboard());

    await act(async () => {
      await result.current.copy('text');
    });

    expect(writeText).toHaveBeenCalledWith('text');
  });
});
