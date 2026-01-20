import { useState } from 'react';
import type { CapabilityValues } from '@shared/capabilities';
import { loadGenerationParams, loadSelectedModel } from '../promptStateStorage';

export function usePromptConfigState(): {
  selectedMode: string;
  setSelectedMode: (mode: string) => void;
  selectedModel: string;
  setSelectedModel: (model: string) => void;
  generationParams: CapabilityValues;
  setGenerationParams: (params: CapabilityValues) => void;
} {
  const [selectedMode, setSelectedMode] = useState<string>('video');
  const [selectedModel, setSelectedModel] = useState<string>(() => loadSelectedModel());
  const [generationParams, setGenerationParams] = useState<CapabilityValues>(
    () => loadGenerationParams()
  );

  return {
    selectedMode,
    setSelectedMode,
    selectedModel,
    setSelectedModel,
    generationParams,
    setGenerationParams,
  };
}
