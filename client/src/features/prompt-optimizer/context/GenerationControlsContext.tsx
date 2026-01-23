import React, { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import type { DraftModel, KeyframeTile } from '@components/ToolSidebar/types';

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
  keyframes: KeyframeTile[];
  addKeyframe: (tile: Omit<KeyframeTile, 'id'>) => void;
  removeKeyframe: (id: string) => void;
  clearKeyframes: () => void;
  onStoryboard: (() => void) | null;
}

const GenerationControlsContext = createContext<GenerationControlsContextValue | null>(null);

export function GenerationControlsProvider({ children }: { children: ReactNode }): React.ReactElement {
  const [controls, setControls] = useState<GenerationControlsHandlers | null>(null);
  const [keyframes, setKeyframes] = useState<KeyframeTile[]>([]);

  const addKeyframe = useCallback((tile: Omit<KeyframeTile, 'id'>): void => {
    setKeyframes((prev) => {
      if (prev.length >= 3) return prev;
      const id = typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `keyframe-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      return [...prev, { id, ...tile }];
    });
  }, []);

  const removeKeyframe = useCallback((id: string): void => {
    setKeyframes((prev) => prev.filter((tile) => tile.id !== id));
  }, []);

  const clearKeyframes = useCallback((): void => {
    setKeyframes([]);
  }, []);

  const onStoryboard = useMemo(() => controls?.onStoryboard ?? null, [controls]);

  return (
    <GenerationControlsContext.Provider
      value={{
        controls,
        setControls,
        keyframes,
        addKeyframe,
        removeKeyframe,
        clearKeyframes,
        onStoryboard,
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
