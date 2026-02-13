import React, { type ReactNode, type RefObject } from 'react';
import { SidebarPromptEditingContextProvider } from '@/components/ToolSidebar/context';
import type { OptimizationOptions } from '@/features/prompt-optimizer/types';
import { usePromptServices, usePromptUIStateContext } from '@/features/prompt-optimizer/context/PromptStateContext';

interface SidebarPromptEditingProviderProps {
  children: ReactNode;
  promptInputRef: RefObject<HTMLTextAreaElement>;
  onPromptChange: (prompt: string) => void;
  onOptimize: (promptToOptimize?: string, options?: OptimizationOptions) => Promise<void>;
  onInsertTrigger: (trigger: string, range?: { start: number; end: number }) => void;
  onCreateFromTrigger?: (trigger: string) => void;
}

export function SidebarPromptEditingProvider({
  children,
  promptInputRef,
  onPromptChange,
  onOptimize,
  onInsertTrigger,
  onCreateFromTrigger,
}: SidebarPromptEditingProviderProps): React.ReactElement {
  const { promptOptimizer } = usePromptServices();
  const { showResults } = usePromptUIStateContext();

  const value = {
    prompt: promptOptimizer.inputPrompt,
    onPromptChange,
    onOptimize,
    showResults,
    isProcessing: promptOptimizer.isProcessing,
    isRefining: promptOptimizer.isRefining,
    genericOptimizedPrompt: promptOptimizer.genericOptimizedPrompt ?? null,
    promptInputRef,
    ...(onCreateFromTrigger ? { onCreateFromTrigger } : {}),
    onInsertTrigger,
  };

  return <SidebarPromptEditingContextProvider value={value}>{children}</SidebarPromptEditingContextProvider>;
}
