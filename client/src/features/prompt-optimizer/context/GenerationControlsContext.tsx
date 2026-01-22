import React, { createContext, useContext, useState, type ReactNode } from 'react';
import type { DraftModel, StartImage } from '@components/ToolSidebar/types';

export interface GenerationControlsHandlers {
  onDraft: (model: DraftModel) => void;
  onRender: (model: string) => void;
  isGenerating: boolean;
  activeDraftModel: string | null;
}

interface GenerationControlsContextValue {
  controls: GenerationControlsHandlers | null;
  setControls: (controls: GenerationControlsHandlers | null) => void;
  startImage: StartImage | null;
  setStartImage: (image: StartImage | null) => void;
}

const GenerationControlsContext = createContext<GenerationControlsContextValue | null>(null);

export function GenerationControlsProvider({ children }: { children: ReactNode }): React.ReactElement {
  const [controls, setControls] = useState<GenerationControlsHandlers | null>(null);
  const [startImage, setStartImage] = useState<StartImage | null>(null);

  return (
    <GenerationControlsContext.Provider
      value={{
        controls,
        setControls,
        startImage,
        setStartImage,
      }}
    >
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
