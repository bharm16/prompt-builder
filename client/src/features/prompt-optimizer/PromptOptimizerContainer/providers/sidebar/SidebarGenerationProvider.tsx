import React, { type ReactNode } from 'react';
import type { GenerationOverrides } from '@/components/ToolSidebar/types';
import { SidebarGenerationContextProvider } from '@/components/ToolSidebar/context';
import { useGenerationControlsContext } from '@/features/prompt-optimizer/context/GenerationControlsContext';

interface SidebarGenerationProviderProps {
  children: ReactNode;
  onImageUpload?: (file: File) => void | Promise<void>;
  onStartFrameUpload?: (file: File) => void | Promise<void>;
}

export function SidebarGenerationProvider({
  children,
  onImageUpload,
  onStartFrameUpload,
}: SidebarGenerationProviderProps): React.ReactElement {
  const { controls } = useGenerationControlsContext();

  const value = {
    onDraft: (model: 'flux-kontext' | 'wan-2.2' | 'wan-2.5', overrides?: GenerationOverrides): void => {
      controls?.onDraft?.(model, overrides);
    },
    onRender: (model: string, overrides?: GenerationOverrides): void => {
      controls?.onRender?.(model, overrides);
    },
    onStoryboard: (): void => {
      controls?.onStoryboard?.();
    },
    ...(onImageUpload ? { onImageUpload } : {}),
    ...(onStartFrameUpload ? { onStartFrameUpload } : {}),
  };

  return <SidebarGenerationContextProvider value={value}>{children}</SidebarGenerationContextProvider>;
}
