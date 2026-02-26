import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockGetAuthRepository } = vi.hoisted(() => ({
  mockGetAuthRepository: vi.fn(),
}));

vi.mock('@repositories/index', () => ({
  getAuthRepository: mockGetAuthRepository,
}));

import { useAuthUser } from '../useAuthUser';

describe('useAuthUser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('subscribes to auth changes, updates state, and calls lifecycle callbacks', () => {
    const unsubscribe = vi.fn();
    let onAuthStateChangedCallback: ((user: any) => void) | undefined;

    const onAuthStateChanged = vi.fn((callback: (user: any) => void) => {
      onAuthStateChangedCallback = callback;
      return unsubscribe;
    });
    mockGetAuthRepository.mockReturnValue({ onAuthStateChanged });

    const onInit = vi.fn();
    const onCleanup = vi.fn();
    const onChange = vi.fn();

    const { result, unmount } = renderHook(() =>
      useAuthUser({
        onInit,
        onCleanup,
        onChange,
      })
    );

    expect(onInit).toHaveBeenCalledTimes(1);
    expect(onAuthStateChanged).toHaveBeenCalledTimes(1);
    expect(result.current).toBeNull();

    const user = { uid: 'u1', email: 'user@example.com' };
    act(() => {
      onAuthStateChangedCallback?.(user);
    });

    expect(result.current).toEqual(user);
    expect(onChange).toHaveBeenCalledWith(user);

    unmount();

    expect(onCleanup).toHaveBeenCalledTimes(1);
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('uses latest callback references without re-subscribing', () => {
    const unsubscribe = vi.fn();
    let onAuthStateChangedCallback: ((user: any) => void) | undefined;

    const onAuthStateChanged = vi.fn((callback: (user: any) => void) => {
      onAuthStateChangedCallback = callback;
      return unsubscribe;
    });
    mockGetAuthRepository.mockReturnValue({ onAuthStateChanged });

    const firstOnChange = vi.fn();
    const secondOnChange = vi.fn();

    const { rerender } = renderHook(
      ({ onChange }: { onChange: (user: any) => void }) => useAuthUser({ onChange }),
      {
        initialProps: { onChange: firstOnChange },
      }
    );

    rerender({ onChange: secondOnChange });

    act(() => {
      onAuthStateChangedCallback?.({ uid: 'u2' });
    });

    expect(firstOnChange).not.toHaveBeenCalled();
    expect(secondOnChange).toHaveBeenCalledWith({ uid: 'u2' });
    expect(onAuthStateChanged).toHaveBeenCalledTimes(1);
  });
});
