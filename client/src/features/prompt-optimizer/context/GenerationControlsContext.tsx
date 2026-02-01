import React, { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import type { DraftModel } from '@components/ToolSidebar/types';
import { useKeyframeUrlRefresh } from '../hooks/useKeyframeUrlRefresh';

export interface GenerationControlsHandlers {
  onDraft: (model: DraftModel) => void;
  onRender: (model: string) => void;
  onStoryboard: () => void;
  isGenerating: boolean;
  activeDraftModel: string | null;
}

interface GenerationControlsContextValue {
  controls: GenerationControlsHandlers | null;
  setControls: (controls: GenerationControlsHandlers | null) => void;
  onStoryboard: (() => void) | null;
}

const GenerationControlsContext = createContext<GenerationControlsContextValue | null>(null);

export function GenerationControlsProvider({ children }: { children: ReactNode }): React.ReactElement {
  const [controls, setControls] = useState<GenerationControlsHandlers | null>(null);

  useKeyframeUrlRefresh();

  const onStoryboard = useMemo(() => controls?.onStoryboard ?? null, [controls]);

  const contextValue = useMemo<GenerationControlsContextValue>(() => ({
    controls,
    setControls,
    onStoryboard,
  }), [controls]);

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
