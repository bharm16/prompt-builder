import type { ReactNode, RefObject } from 'react';
import type { User, PromptHistoryEntry } from '@hooks/types';
import type { Asset, AssetType } from '@shared/types/asset';
import type { OptimizationOptions } from '@/features/prompt-optimizer/types';
import type { AppIcon } from '@/types';

export type ToolPanelType = 'sessions' | 'create' | 'studio' | 'characters' | 'styles';

export type DraftModel = 'flux-kontext' | 'wan-2.2' | 'wan-2.5';

export type VideoTier = 'draft' | 'render';

export interface KeyframeTile {
  id: string;
  url: string;
  source: 'upload' | 'library' | 'generation' | 'asset';
  assetId?: string;
  sourcePrompt?: string;
  storagePath?: string;
  viewUrlExpiresAt?: string;
}

export interface StartImage {
  url: string;
  source: string;
  assetId?: string;
  storagePath?: string;
  viewUrlExpiresAt?: string;
}

export interface GenerationOverrides {
  startImage?: StartImage | null;
  generationParams?: Record<string, unknown>;
  characterAssetId?: string | null;
  faceSwapAlreadyApplied?: boolean;
  faceSwapUrl?: string | null;
}

export interface ToolSidebarProps {
  user: User | null;

  // Sessions panel
  history: PromptHistoryEntry[];
  filteredHistory: PromptHistoryEntry[];
  isLoadingHistory: boolean;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onLoadFromHistory: (entry: PromptHistoryEntry) => void;
  onCreateNew: () => void;
  onDelete: (id: string) => void;
  onDuplicate?: (entry: PromptHistoryEntry) => void;
  onRename?: (entry: PromptHistoryEntry, title: string) => void;
  currentPromptUuid?: string | null;
  currentPromptDocId?: string | null;
  activeStatusLabel?: string;
  activeModelLabel?: string;

  // Generation controls panel
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
  onCreateFromTrigger?: (trigger: string) => void;
  onDraft: (model: DraftModel, overrides?: GenerationOverrides) => void;
  onRender: (model: string, overrides?: GenerationOverrides) => void;
  onImageUpload?: (file: File) => void | Promise<void>;
  onStoryboard: () => void;

  // Characters panel
  assets: Asset[];
  assetsByType: Record<AssetType, Asset[]>;
  isLoadingAssets: boolean;
  onInsertTrigger: (trigger: string, range?: { start: number; end: number }) => void;
  onEditAsset: (assetId: string) => void;
  onCreateAsset: (type: AssetType) => void;
}

export interface ToolRailProps {
  activePanel: ToolPanelType;
  onPanelChange: (panel: ToolPanelType) => void;
  user: User | null;
  onCreateNew: () => void;
}

export interface ToolPanelProps {
  activePanel: ToolPanelType;
  children: ReactNode;
}

export interface ToolNavItem {
  id: ToolPanelType;
  icon: AppIcon;
  label: string;
  variant: 'header' | 'default';
}
