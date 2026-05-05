/**
 * BalancePill — persistent credit balance display for the AppShell.
 *
 * Invariants:
 *  - numeric balance N → renders "N credits"
 *  - loading → renders "…" (terse, no blocking spinner)
 *  - null/error → renders "—" placeholder
 *  - authenticated check is the caller's responsibility (the provider
 *    returns balance=null when userId is null, which naturally falls to
 *    the placeholder path)
 *
 * Motivation: the balance pill previously only lived on the workspace
 * home, so navigating to /session/<id> hid it. Users
 * need to see their live balance while editing — especially when deciding
 * whether to click Generate.
 */

import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { BalancePill } from "../shared/BalancePill";

let mockBalance: number | null = null;
let mockIsLoading = false;
let mockError: string | null = null;

vi.mock("@/contexts/CreditBalanceContext", () => ({
  useCreditBalance: () => ({
    balance: mockBalance,
    isLoading: mockIsLoading,
    error: mockError,
  }),
}));

describe("BalancePill", () => {
  it("renders numeric balance as 'N credits'", () => {
    mockBalance = 42;
    mockIsLoading = false;
    mockError = null;
    render(<BalancePill />);
    expect(screen.getByTestId("balance-pill")).toHaveTextContent("42 credits");
  });

  it("renders 1000 without truncation or abbreviation", () => {
    mockBalance = 1000;
    mockIsLoading = false;
    mockError = null;
    render(<BalancePill />);
    expect(screen.getByTestId("balance-pill")).toHaveTextContent("1000");
    expect(screen.getByTestId("balance-pill")).toHaveTextContent("credits");
  });

  it("renders '…' during loading", () => {
    mockBalance = null;
    mockIsLoading = true;
    mockError = null;
    render(<BalancePill />);
    expect(screen.getByTestId("balance-pill")).toHaveTextContent("…");
  });

  it("renders '—' when balance is null and not loading", () => {
    mockBalance = null;
    mockIsLoading = false;
    mockError = null;
    render(<BalancePill />);
    expect(screen.getByTestId("balance-pill")).toHaveTextContent("—");
  });

  it("renders '—' on error", () => {
    mockBalance = null;
    mockIsLoading = false;
    mockError = "network failure";
    render(<BalancePill />);
    expect(screen.getByTestId("balance-pill")).toHaveTextContent("—");
  });

  it("has an aria-label describing the balance for screen readers", () => {
    mockBalance = 48;
    mockIsLoading = false;
    mockError = null;
    render(<BalancePill />);
    const pill = screen.getByTestId("balance-pill");
    expect(pill.getAttribute("aria-label")).toMatch(/48\s+credits?/i);
  });
});
