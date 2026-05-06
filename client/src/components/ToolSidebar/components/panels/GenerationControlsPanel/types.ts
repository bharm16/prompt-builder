import type { Asset } from "@shared/types/asset";
import type {
  DraftModel,
  GenerationControlsTab,
  GenerationOverrides,
  ImageSubTab,
} from "@features/generation-controls";

export type {
  GenerationControlsTab,
  ImageSubTab,
} from "@features/generation-controls";

export interface GenerationControlsPanelProps {
  isProcessing?: boolean;
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

export type GenerationControlsPanelInputProps =
  Partial<GenerationControlsPanelProps>;
