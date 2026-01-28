import { useEffect } from 'react';
import type { CapabilityValues } from '@shared/capabilities';
import { persistGenerationParams, persistSelectedModel } from '../promptStateStorage';

interface UsePromptStatePersistenceOptions {
  selectedModel: string;
  generationParams: CapabilityValues;
}

export const usePromptStatePersistence = ({
  selectedModel,
  generationParams,
}: UsePromptStatePersistenceOptions): void => {
  useEffect(() => {
    persistSelectedModel(selectedModel);
  }, [selectedModel]);

  useEffect(() => {
    persistGenerationParams(generationParams);
  }, [generationParams]);
};
