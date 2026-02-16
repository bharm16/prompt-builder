import { useCallback, useState } from 'react';
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

  const checkCredits = useCallback(
    (cost: number, operation: string): boolean => {
      const available = balance ?? 0;
      if (available >= cost) return true;
      setModal({ required: cost, available, operation });
      return false;
    },
    [balance]
  );

  const openInsufficientCredits = useCallback(
    (required: number, operation: string): void => {
      setModal({ required, available: balance ?? 0, operation });
    },
    [balance]
  );

  const dismissModal = useCallback(() => setModal(null), []);

  return {
    checkCredits,
    openInsufficientCredits,
    insufficientCreditsModal: modal,
    dismissModal,
    balance,
    isLoading,
  };
}
