import { useCallback, useEffect, useState } from 'react';
import { z } from 'zod';
import { WORKFLOW_CHIP_STORAGE_KEY } from '../constants';

const SeenSchema = z.literal('1');

const readSeenFlag = (): boolean => {
  if (typeof window === 'undefined') return false;
  try {
    const value = window.localStorage.getItem(WORKFLOW_CHIP_STORAGE_KEY);
    if (!value) return false;
    return SeenSchema.safeParse(value).success;
  } catch {
    return false;
  }
};

const writeSeenFlag = (): void => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(WORKFLOW_CHIP_STORAGE_KEY, '1');
  } catch {
    // ignore
  }
};

export const useWorkflowChipSeen = (): {
  hasSeenWorkflowChip: boolean;
  markWorkflowChipSeen: () => void;
} => {
  const [hasSeenWorkflowChip, setHasSeenWorkflowChip] = useState(false);

  useEffect(() => {
    setHasSeenWorkflowChip(readSeenFlag());
  }, []);

  const markWorkflowChipSeen = useCallback(() => {
    writeSeenFlag();
    setHasSeenWorkflowChip(true);
  }, []);

  return { hasSeenWorkflowChip, markWorkflowChipSeen };
};
