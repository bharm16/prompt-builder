import React, { createContext, useContext, type ReactNode } from 'react';
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
  return <CreditBalanceContext.Provider value={state}>{children}</CreditBalanceContext.Provider>;
}

export function useCreditBalance(): CreditBalanceContextValue {
  return useContext(CreditBalanceContext);
}
