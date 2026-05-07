import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

// We need to test normalizeBalance which is not exported.
// We test it indirectly through the hook, but the hook depends on Firebase.
// Instead, we mock Firebase and test the hook's behavior which exercises normalizeBalance.

let snapshotCallback:
  | ((snap: { data: () => Record<string, unknown> | undefined }) => void)
  | null = null;
let errorCallback: ((err: Error) => void) | null = null;
const mockUnsubscribe = vi.fn();
const { fetchCreditBalanceMock } = vi.hoisted(() => ({
  fetchCreditBalanceMock: vi.fn(async () => 42),
}));

vi.mock("firebase/firestore", () => ({
  doc: vi.fn(),
  onSnapshot: vi.fn((ref, onNext, onError) => {
    snapshotCallback = onNext;
    errorCallback = onError;
    return mockUnsubscribe;
  }),
}));

vi.mock("@/config/firebase", () => ({
  db: {},
}));

vi.mock("@/features/billing/api/billingApi", () => ({
  fetchCreditBalance: fetchCreditBalanceMock,
}));

import { useUserCreditBalance } from "@hooks/useUserCreditBalance";

describe("useUserCreditBalance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    snapshotCallback = null;
    errorCallback = null;
  });

  describe("error handling", () => {
    it("sets error state when onSnapshot fires error callback", () => {
      const { result } = renderHook(() => useUserCreditBalance("user-1"));

      act(() => {
        errorCallback?.(new Error("Permission denied"));
      });

      expect(result.current.error).toBe("Permission denied");
      expect(result.current.balance).toBeNull();
      expect(result.current.isLoading).toBe(false);
    });

    it("sets generic error message for non-Error objects", () => {
      const { result } = renderHook(() => useUserCreditBalance("user-1"));

      act(() => {
        // Pass a string as error (non-Error)
        errorCallback?.({ message: undefined } as unknown as Error);
      });

      expect(result.current.error).toBe("Failed to load credit balance");
    });
  });

  describe("edge cases - normalizeBalance behavior", () => {
    it("falls back to API fetch (balance stays null) for undefined credits field", () => {
      // When Firestore doesn't have a credits field yet, the hook deliberately
      // does NOT settle on 0 — it triggers refreshBalanceFromApi() and keeps
      // the previous balance (null in first snapshot). Preventing a 0-flash
      // when the REST API has a fresher number.
      const { result } = renderHook(() => useUserCreditBalance("user-1"));

      act(() => {
        snapshotCallback?.({ data: () => ({}) });
      });

      expect(result.current.balance).toBeNull();
      // The whole point of staying null is that the REST fallback is doing
      // the real work — if that call silently stopped firing, balance would
      // stay null forever and this test would still pass. Assert it directly.
      expect(fetchCreditBalanceMock).toHaveBeenCalled();
    });

    it("falls back to API fetch (balance stays null) for null credits field", () => {
      const { result } = renderHook(() => useUserCreditBalance("user-1"));

      act(() => {
        snapshotCallback?.({ data: () => ({ credits: null }) });
      });

      expect(result.current.balance).toBeNull();
    });

    it("returns 0 for string credits", () => {
      const { result } = renderHook(() => useUserCreditBalance("user-1"));

      act(() => {
        snapshotCallback?.({ data: () => ({ credits: "100" }) });
      });

      expect(result.current.balance).toBe(0);
    });

    it("returns 0 for NaN credits", () => {
      const { result } = renderHook(() => useUserCreditBalance("user-1"));

      act(() => {
        snapshotCallback?.({ data: () => ({ credits: NaN }) });
      });

      expect(result.current.balance).toBe(0);
    });

    it("returns 0 for Infinity credits", () => {
      const { result } = renderHook(() => useUserCreditBalance("user-1"));

      act(() => {
        snapshotCallback?.({ data: () => ({ credits: Infinity }) });
      });

      expect(result.current.balance).toBe(0);
    });

    it("returns 0 for negative credits (clamps to 0)", () => {
      const { result } = renderHook(() => useUserCreditBalance("user-1"));

      act(() => {
        snapshotCallback?.({ data: () => ({ credits: -50 }) });
      });

      expect(result.current.balance).toBe(0);
    });

    it("truncates fractional credits to integer", () => {
      const { result } = renderHook(() => useUserCreditBalance("user-1"));

      act(() => {
        snapshotCallback?.({ data: () => ({ credits: 99.7 }) });
      });

      expect(result.current.balance).toBe(99);
    });

    it("falls back to API fetch (balance stays null) when snapshot data is undefined", () => {
      const { result } = renderHook(() => useUserCreditBalance("user-1"));

      act(() => {
        snapshotCallback?.({ data: () => undefined });
      });

      expect(result.current.balance).toBeNull();
    });
  });

  describe("core behavior", () => {
    it("returns null balance and no loading for null userId", () => {
      const { result } = renderHook(() => useUserCreditBalance(null));
      expect(result.current.balance).toBeNull();
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it("starts loading when userId is provided", () => {
      const { result } = renderHook(() => useUserCreditBalance("user-1"));
      expect(result.current.isLoading).toBe(true);
    });

    it("sets balance from snapshot data", () => {
      const { result } = renderHook(() => useUserCreditBalance("user-1"));

      act(() => {
        snapshotCallback?.({ data: () => ({ credits: 250 }) });
      });

      expect(result.current.balance).toBe(250);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it("unsubscribes on unmount", () => {
      const { unmount } = renderHook(() => useUserCreditBalance("user-1"));
      unmount();
      expect(mockUnsubscribe).toHaveBeenCalled();
    });

    it("resets to null balance when userId changes to null", () => {
      const { result, rerender } = renderHook(
        ({ userId }) => useUserCreditBalance(userId),
        { initialProps: { userId: "user-1" as string | null } },
      );

      act(() => {
        snapshotCallback?.({ data: () => ({ credits: 100 }) });
      });
      expect(result.current.balance).toBe(100);

      rerender({ userId: null });
      expect(result.current.balance).toBeNull();
      expect(result.current.isLoading).toBe(false);
    });
  });
});
