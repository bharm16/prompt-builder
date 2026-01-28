import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { ReactNode } from 'react';

import { useShareLink } from '@features/prompt-optimizer/hooks/useShareLink';

const toast = {
  success: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
  info: vi.fn(),
};

vi.mock('@components/Toast', () => ({
  useToast: () => toast,
  ToastProvider: ({ children }: { children: ReactNode }) => children,
}));

describe('useShareLink', () => {
  const originalClipboard = navigator.clipboard;

  beforeEach(() => {
    vi.useFakeTimers();
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
      configurable: true,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    toast.success.mockClear();
    toast.error.mockClear();
    Object.defineProperty(navigator, 'clipboard', {
      value: originalClipboard,
      configurable: true,
    });
  });

  it('shows error when prompt id is missing', () => {
    const { result } = renderHook(() => useShareLink());

    act(() => {
      result.current.share('');
    });

    expect(toast.error).toHaveBeenCalledWith('Save the prompt first to generate a share link');
  });

  it('copies share link and toggles shared state', () => {
    const { result } = renderHook(() => useShareLink());

    act(() => {
      result.current.share('abc123');
    });

    expect(toast.success).toHaveBeenCalledWith('Share link copied to clipboard!');
    expect(result.current.shared).toBe(true);

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(result.current.shared).toBe(false);
  });
});
