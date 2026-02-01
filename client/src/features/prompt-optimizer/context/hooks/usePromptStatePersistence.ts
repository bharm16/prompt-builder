import { useEffect } from 'react';
import type { CapabilityValues } from '@shared/capabilities';
import { persistGenerationParams, persistSelectedModel, persistSelectedMode, persistVideoTier } from '../promptStateStorage';
import type { VideoTier } from '@components/ToolSidebar/types';

interface UsePromptStatePersistenceOptions {
  selectedModel: string;
  generationParams: CapabilityValues;
  selectedMode: string;
  videoTier: VideoTier;
}

export const usePromptStatePersistence = ({
  selectedModel,
  generationParams,
  selectedMode,
  videoTier,
}: UsePromptStatePersistenceOptions): void => {
  useEffect(() => {
    persistSelectedMode(selectedMode);
  }, [selectedMode]);

  useEffect(() => {
    persistSelectedModel(selectedModel);
  }, [selectedModel]);

  useEffect(() => {
    persistGenerationParams(generationParams);
  }, [generationParams]);

  useEffect(() => {
    persistVideoTier(videoTier);
  }, [videoTier]);
};
