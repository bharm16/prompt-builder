import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCreditGate } from '../useCreditGate';

const useCreditBalanceMock = vi.fn();

vi.mock('@/contexts/CreditBalanceContext', () => ({
  useCreditBalance: () => useCreditBalanceMock(),
}));

describe('useCreditGate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns true without opening modal when balance is sufficient', () => {
    useCreditBalanceMock.mockReturnValue({
      balance: 50,
      isLoading: false,
      error: null,
    });

    const { result } = renderHook(() => useCreditGate());

    let allowed = false;
    act(() => {
      allowed = result.current.checkCredits(30, 'Sora render');
    });

    expect(allowed).toBe(true);
    expect(result.current.insufficientCreditsModal).toBeNull();
  });

  it('returns false and opens modal when balance is insufficient', () => {
    useCreditBalanceMock.mockReturnValue({
      balance: 5,
      isLoading: false,
      error: null,
    });

    const { result } = renderHook(() => useCreditGate());

    let allowed = true;
    act(() => {
      allowed = result.current.checkCredits(80, 'Sora render');
    });

    expect(allowed).toBe(false);
    expect(result.current.insufficientCreditsModal).toEqual({
      required: 80,
      available: 5,
      operation: 'Sora render',
    });
  });

  it('openInsufficientCredits uses current balance when opening modal', () => {
    useCreditBalanceMock.mockReturnValue({
      balance: 12,
      isLoading: false,
      error: null,
    });

    const { result } = renderHook(() => useCreditGate());

    act(() => {
      result.current.openInsufficientCredits(35, 'Kling render');
    });

    expect(result.current.insufficientCreditsModal).toEqual({
      required: 35,
      available: 12,
      operation: 'Kling render',
    });
  });
});
