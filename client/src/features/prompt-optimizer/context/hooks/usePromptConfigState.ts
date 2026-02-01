import { useState } from 'react';
import type { CapabilityValues } from '@shared/capabilities';
import { loadGenerationParams, loadSelectedModel, loadSelectedMode, loadVideoTier } from '../promptStateStorage';
import type { VideoTier } from '@components/ToolSidebar/types';

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
  const [selectedModel, setSelectedModel] = useState<string>(() => loadSelectedModel());
  const [generationParams, setGenerationParams] = useState<CapabilityValues>(
    () => loadGenerationParams()
  );
  const [videoTier, setVideoTier] = useState<VideoTier>(() => loadVideoTier());

  return {
    selectedMode,
    setSelectedMode,
    selectedModel,
    setSelectedModel,
    generationParams,
    setGenerationParams,
    videoTier,
    setVideoTier,
  };
}
