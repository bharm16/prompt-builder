import { useCallback, useMemo, useRef, useState } from 'react';
import { useCreditBalance } from '@/contexts/CreditBalanceContext';

export interface InsufficientCreditsModalState {
  required: number;
  available: number;
  operation: string;
}

interface CreditGateResult {
  checkCredits: (cost: number, operation: string) => boolean;
  openInsufficientCredits: (required: number, operation: string) => void;
  insufficientCreditsModal: InsufficientCreditsModalState | null;
  dismissModal: () => void;
  balance: number | null;
  isLoading: boolean;
}

export function useCreditGate(): CreditGateResult {
  const { balance, isLoading } = useCreditBalance();
  const [modal, setModal] = useState<InsufficientCreditsModalState | null>(null);
  const balanceRef = useRef(balance);
  balanceRef.current = balance;

  const checkCredits = useCallback(
    (cost: number, operation: string): boolean => {
      const available = balanceRef.current ?? 0;
      if (available >= cost) return true;
      setModal({ required: cost, available, operation });
      return false;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- balance accessed via stable ref
    []
  );

  const openInsufficientCredits = useCallback(
    (required: number, operation: string): void => {
      setModal({ required, available: balanceRef.current ?? 0, operation });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- balance accessed via stable ref
    []
  );

  const dismissModal = useCallback(() => setModal(null), []);

  return useMemo(() => ({
    checkCredits,
    openInsufficientCredits,
    insufficientCreditsModal: modal,
    dismissModal,
    balance,
    isLoading,
  }), [checkCredits, openInsufficientCredits, modal, dismissModal, balance, isLoading]);
}
