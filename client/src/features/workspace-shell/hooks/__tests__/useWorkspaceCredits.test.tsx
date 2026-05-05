import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/contexts/CreditBalanceContext", () => ({
  useCreditBalance: () => ({ balance: 1234, isLoading: false, error: null }),
}));
vi.mock("@/hooks/useAuthUser", () => ({
  useAuthUser: () => ({ uid: "u1", photoURL: "https://example.com/a.png" }),
}));

import { useWorkspaceCredits } from "../useWorkspaceCredits";

describe("useWorkspaceCredits", () => {
  it("exposes credits as a number and avatarUrl as a string", () => {
    const { result } = renderHook(() => useWorkspaceCredits());
    expect(result.current.credits).toBe(1234);
    expect(result.current.avatarUrl).toBe("https://example.com/a.png");
  });
});

describe("useWorkspaceCredits when balance is null (loading)", () => {
  it("falls back to 0 credits", async () => {
    vi.resetModules();
    vi.doMock("@/contexts/CreditBalanceContext", () => ({
      useCreditBalance: () => ({ balance: null, isLoading: true, error: null }),
    }));
    vi.doMock("@/hooks/useAuthUser", () => ({
      useAuthUser: () => null,
    }));
    const { useWorkspaceCredits: useFresh } = await import(
      "../useWorkspaceCredits"
    );
    const { result } = renderHook(() => useFresh());
    expect(result.current.credits).toBe(0);
    expect(result.current.avatarUrl).toBeNull();
  });
});
