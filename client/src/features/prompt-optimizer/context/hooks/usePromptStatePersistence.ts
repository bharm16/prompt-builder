import { useEffect } from 'react';
import { persistSelectedMode } from '../promptStateStorage';

interface UsePromptStatePersistenceOptions {
  selectedMode: string;
}

export const usePromptStatePersistence = ({
  selectedMode,
}: UsePromptStatePersistenceOptions): void => {
  useEffect(() => {
    persistSelectedMode(selectedMode);
  }, [selectedMode]);
};
