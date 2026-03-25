import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  publishCreditBalanceSync,
  requestCreditBalanceRefresh,
  useUserCreditBalance,
} from "../useUserCreditBalance";

const docMock = vi.hoisted(() => vi.fn());
const onSnapshotMock = vi.hoisted(() => vi.fn());
const fetchCreditBalanceMock = vi.hoisted(() => vi.fn());

vi.mock("firebase/firestore", () => ({
  doc: (...args: unknown[]) => docMock(...args),
  onSnapshot: (...args: unknown[]) => onSnapshotMock(...args),
}));

vi.mock("@/config/firebase", () => ({
  db: { app: "test-db" },
}));

vi.mock("@/features/billing/api/billingApi", () => ({
  fetchCreditBalance: () => fetchCreditBalanceMock(),
}));

type SnapshotCallback = (snapshot: {
  data: () => Record<string, unknown> | undefined;
}) => void;

describe("regression: useUserCreditBalance applies immediate sync from generation responses", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.sessionStorage.clear();
    docMock.mockReturnValue({ path: "users/user-1" });
    fetchCreditBalanceMock.mockResolvedValue(0);
  });

  it("keeps a newer synced balance when Firestore is still replaying stale data", () => {
    let handleSnapshot: SnapshotCallback | null = null;

    onSnapshotMock.mockImplementation(
      (_ref: unknown, next: SnapshotCallback) => {
        handleSnapshot = next;
        return () => undefined;
      },
    );

    const { result } = renderHook(() => useUserCreditBalance("user-1"));

    act(() => {
      handleSnapshot?.({
        data: () => ({ credits: 25 }),
      });
    });

    expect(result.current.balance).toBe(25);

    act(() => {
      publishCreditBalanceSync(1);
    });

    expect(result.current.balance).toBe(1);

    act(() => {
      handleSnapshot?.({
        data: () => ({ credits: 25 }),
      });
    });

    expect(result.current.balance).toBe(1);

    act(() => {
      handleSnapshot?.({
        data: () => ({ credits: 1 }),
      });
    });

    expect(result.current.balance).toBe(1);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("refreshes the balance from the billing API when runtime requests a balance refresh", async () => {
    let handleSnapshot: SnapshotCallback | null = null;

    onSnapshotMock.mockImplementation(
      (_ref: unknown, next: SnapshotCallback) => {
        handleSnapshot = next;
        return () => undefined;
      },
    );
    fetchCreditBalanceMock.mockResolvedValue(1);

    const { result } = renderHook(() => useUserCreditBalance("user-1"));

    act(() => {
      handleSnapshot?.({
        data: () => undefined,
      });
    });

    await act(async () => {
      requestCreditBalanceRefresh();
      await Promise.resolve();
    });

    expect(fetchCreditBalanceMock).toHaveBeenCalled();
    expect(result.current.balance).toBe(1);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("keeps the synced balance across a remount when the fallback API still returns stale credits", async () => {
    let handleSnapshot: SnapshotCallback | null = null;

    onSnapshotMock.mockImplementation(
      (_ref: unknown, next: SnapshotCallback) => {
        handleSnapshot = next;
        return () => undefined;
      },
    );
    fetchCreditBalanceMock.mockResolvedValue(25);

    const { result, unmount } = renderHook(() =>
      useUserCreditBalance("user-1"),
    );

    act(() => {
      publishCreditBalanceSync(1);
    });

    expect(result.current.balance).toBe(1);

    unmount();

    const remounted = renderHook(() => useUserCreditBalance("user-1"));

    await act(async () => {
      handleSnapshot?.({
        data: () => undefined,
      });
      await Promise.resolve();
    });

    expect(fetchCreditBalanceMock).toHaveBeenCalled();
    expect(remounted.result.current.balance).toBe(1);
    expect(remounted.result.current.isLoading).toBe(false);
  });
});
