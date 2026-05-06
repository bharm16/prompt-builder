import { useCreditBalance } from "@/contexts/CreditBalanceContext";
import { useAuthUser } from "@/hooks/useAuthUser";

export interface UseWorkspaceCreditsResult {
  credits: number;
  avatarUrl: string | null;
}

/**
 * Surfaces the credit balance + user avatar URL for the workspace top bar.
 *
 * Thin adapter over `useCreditBalance` (sourced from `CreditBalanceProvider`)
 * and `useAuthUser`. The provider is mounted high in the tree, so the
 * underlying balance is shared with every other consumer (no extra Firestore
 * subscription).
 *
 * Loading state collapses to `0`; the top bar treats credits as a display-only
 * number and does not need to distinguish "loading" from "actually zero".
 */
export function useWorkspaceCredits(): UseWorkspaceCreditsResult {
  const { balance } = useCreditBalance();
  const user = useAuthUser();
  const credits = typeof balance === "number" ? balance : 0;
  const avatarUrl =
    typeof user?.photoURL === "string" && user.photoURL.length > 0
      ? user.photoURL
      : null;
  return { credits, avatarUrl };
}
