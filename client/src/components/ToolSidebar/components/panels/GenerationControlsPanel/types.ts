import type { RefObject } from 'react';
import type { Asset } from '@shared/types/asset';
import type { OptimizationOptions } from '@/features/prompt-optimizer/types';
import type { DraftModel } from '@components/ToolSidebar/types';
export type {
  GenerationControlsTab,
  ImageSubTab,
} from '@/features/prompt-optimizer/context/generationControlsStoreTypes';

export interface GenerationControlsPanelProps {
  prompt: string;
  onPromptChange?: (prompt: string) => void;
  onOptimize?: (
    promptToOptimize?: string,
    options?: OptimizationOptions
  ) => Promise<void>;
  showResults?: boolean;
  isProcessing?: boolean;
  isRefining?: boolean;
  genericOptimizedPrompt?: string | null;
  promptInputRef?: RefObject<HTMLTextAreaElement | null>;
  assets?: Asset[];
  onInsertTrigger?: (trigger: string, range?: { start: number; end: number }) => void;
  onCreateFromTrigger?: (trigger: string) => void;
  onDraft: (model: DraftModel) => void;
  onRender: (model: string) => void;
  onBack?: () => void;
  onImageUpload?: (file: File) => void | Promise<void>;
  onStoryboard: () => void;
}
