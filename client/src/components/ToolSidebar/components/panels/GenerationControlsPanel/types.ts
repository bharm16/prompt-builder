import type { Asset } from '@shared/types/asset';
import type { DraftModel, GenerationOverrides } from '@components/ToolSidebar/types';
export type {
  GenerationControlsTab,
  ImageSubTab,
} from '@/features/prompt-optimizer/context/generationControlsStoreTypes';

export interface GenerationControlsPanelProps {
  isProcessing?: boolean;
  isRefining?: boolean;
  assets?: Asset[];
  onDraft: (model: DraftModel, overrides?: GenerationOverrides) => void;
  onRender: (model: string, overrides?: GenerationOverrides) => void;
  onBack?: () => void;
  onImageUpload?: (file: File) => void | Promise<void>;
  onStartFrameUpload?: (file: File) => void | Promise<void>;
  onUploadSidebarImage?: (file: File) => Promise<{
    url: string;
    storagePath?: string;
    viewUrlExpiresAt?: string;
  } | null>;
  onStoryboard: () => void;
}

export type GenerationControlsPanelInputProps = Partial<GenerationControlsPanelProps>;
