import React, { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useUserCreditBalance } from '@/hooks/useUserCreditBalance';

interface CreditBalanceContextValue {
  balance: number | null;
  isLoading: boolean;
  error: string | null;
}

const CreditBalanceContext = createContext<CreditBalanceContextValue>({
  balance: null,
  isLoading: false,
  error: null,
});

export function CreditBalanceProvider({
  userId,
  children,
}: {
  userId: string | null;
  children: ReactNode;
}): React.ReactElement {
  const state = useUserCreditBalance(userId);
  const value = useMemo<CreditBalanceContextValue>(() => ({
    balance: state.balance,
    isLoading: state.isLoading,
    error: state.error,
  }), [state.balance, state.isLoading, state.error]);
  return <CreditBalanceContext.Provider value={value}>{children}</CreditBalanceContext.Provider>;
}

export function useCreditBalance(): CreditBalanceContextValue {
  return useContext(CreditBalanceContext);
}
