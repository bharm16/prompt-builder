import React, { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import type { DraftModel, GenerationOverrides } from '@components/ToolSidebar/types';
import { useKeyframeUrlRefresh } from '../hooks/useKeyframeUrlRefresh';

export interface FaceSwapPreviewState {
  url: string;
  characterAssetId: string;
  targetImageUrl: string;
  createdAt: number;
}

export interface GenerationControlsHandlers {
  onDraft: (model: DraftModel, overrides?: GenerationOverrides) => void;
  onRender: (model: string, overrides?: GenerationOverrides) => void;
  onStoryboard: () => void;
  isGenerating: boolean;
  activeDraftModel: string | null;
}

interface GenerationControlsContextValue {
  controls: GenerationControlsHandlers | null;
  setControls: (controls: GenerationControlsHandlers | null) => void;
  onStoryboard: (() => void) | null;
  faceSwapPreview: FaceSwapPreviewState | null;
  setFaceSwapPreview: (preview: FaceSwapPreviewState | null) => void;
}

const GenerationControlsContext = createContext<GenerationControlsContextValue | null>(null);

export function GenerationControlsProvider({ children }: { children: ReactNode }): React.ReactElement {
  const [controls, setControls] = useState<GenerationControlsHandlers | null>(null);
  const [faceSwapPreview, setFaceSwapPreview] = useState<FaceSwapPreviewState | null>(null);

  useKeyframeUrlRefresh();

  const onStoryboard = useMemo(() => controls?.onStoryboard ?? null, [controls]);

  const contextValue = useMemo<GenerationControlsContextValue>(() => ({
    controls,
    setControls,
    onStoryboard,
    faceSwapPreview,
    setFaceSwapPreview,
  }), [controls, faceSwapPreview, onStoryboard]);

  return (
    <GenerationControlsContext.Provider value={contextValue}>
      {children}
    </GenerationControlsContext.Provider>
  );
}

export function useGenerationControlsContext(): GenerationControlsContextValue {
  const context = useContext(GenerationControlsContext);
  if (!context) {
    throw new Error('useGenerationControlsContext must be used within GenerationControlsProvider');
  }
  return context;
}
