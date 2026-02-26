import { useState } from 'react';
import type { CapabilityValues } from '@shared/capabilities';
import type { VideoTier } from '@components/ToolSidebar/types';
import { loadSelectedMode } from '../promptStateStorage';
import {
  useGenerationControlsStoreActions,
  useGenerationControlsStoreState,
} from '../GenerationControlsStore';

export function usePromptConfigState(): {
  selectedMode: string;
  setSelectedMode: (mode: string) => void;
  selectedModel: string;
  setSelectedModel: (model: string) => void;
  generationParams: CapabilityValues;
  setGenerationParams: (params: CapabilityValues) => void;
  videoTier: VideoTier;
  setVideoTier: (tier: VideoTier) => void;
} {
  const [selectedMode, setSelectedMode] = useState<string>(() => loadSelectedMode());
  const { domain } = useGenerationControlsStoreState();
  const actions = useGenerationControlsStoreActions();

  return {
    selectedMode,
    setSelectedMode,
    selectedModel: domain.selectedModel,
    setSelectedModel: actions.setSelectedModel,
    generationParams: domain.generationParams,
    setGenerationParams: actions.setGenerationParams,
    videoTier: domain.videoTier,
    setVideoTier: actions.setVideoTier,
  };
}
