import React from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/config/firebase';

type CreditBalanceState = {
  balance: number | null;
  isLoading: boolean;
  error: string | null;
};

function normalizeBalance(raw: unknown): number {
  if (typeof raw === 'number' && Number.isFinite(raw)) return Math.max(0, Math.trunc(raw));
  return 0;
}

export function useUserCreditBalance(userId: string | null): CreditBalanceState {
  const [state, setState] = React.useState<CreditBalanceState>({
    balance: null,
    isLoading: Boolean(userId),
    error: null,
  });

  React.useEffect(() => {
    if (!userId) {
      setState({ balance: null, isLoading: false, error: null });
      return;
    }

    setState((prev) => ({ balance: prev.balance, isLoading: true, error: null }));

    const userRef = doc(db, 'users', userId);
    const unsubscribe = onSnapshot(
      userRef,
      (snapshot) => {
        const data = snapshot.data() as Record<string, unknown> | undefined;
        setState({
          balance: normalizeBalance(data?.credits),
          isLoading: false,
          error: null,
        });
      },
      (error) => {
        setState({
          balance: null,
          isLoading: false,
          error: error instanceof Error ? error.message : 'Failed to load credit balance',
        });
      }
    );

    return () => unsubscribe();
  }, [userId]);

  return state;
}

