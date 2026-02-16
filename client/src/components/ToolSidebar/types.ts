import type { ReactNode } from 'react';
import type { User, PromptHistoryEntry } from '@hooks/types';
import type { Asset, AssetType } from '@shared/types/asset';
import type { AppIcon } from '@/types';

export type ToolPanelType = 'sessions' | 'studio' | 'apps' | 'characters' | 'styles';

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

export interface ToolSidebarSessionsDomain {
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
}

export interface ToolSidebarPromptInteractionDomain {
  onInsertTrigger: (trigger: string) => void;
  onCreateFromTrigger?: (trigger: string) => void;
  isProcessing?: boolean;
  isRefining?: boolean;
}

export interface ToolSidebarGenerationDomain {
  onDraft: (model: DraftModel, overrides?: GenerationOverrides) => void;
  onRender: (model: string, overrides?: GenerationOverrides) => void;
  onImageUpload?: (file: File) => void | Promise<void>;
  onStartFrameUpload?: (file: File) => void | Promise<void>;
  onStoryboard: () => void;
}

export interface ToolSidebarAssetsDomain {
  assets: Asset[];
  assetsByType: Record<AssetType, Asset[]>;
  isLoadingAssets: boolean;
  onEditAsset: (assetId: string) => void;
  onCreateAsset: (type: AssetType) => void;
}

export interface ToolSidebarWorkspaceDomain {
  galleryOpen: boolean;
  setGalleryOpen: (open: boolean) => void;
  toggleGallery: () => void;
}

export type OptionalToolSidebarSessionsDomain = ToolSidebarSessionsDomain | null;
export type OptionalToolSidebarPromptInteractionDomain = ToolSidebarPromptInteractionDomain | null;
export type OptionalToolSidebarGenerationDomain = ToolSidebarGenerationDomain | null;
export type OptionalToolSidebarAssetsDomain = ToolSidebarAssetsDomain | null;
export type OptionalToolSidebarWorkspaceDomain = ToolSidebarWorkspaceDomain | null;

export interface ToolSidebarProps {
  user: User | null;
  sessions?: OptionalToolSidebarSessionsDomain;
  promptInteraction?: OptionalToolSidebarPromptInteractionDomain;
  generation?: OptionalToolSidebarGenerationDomain;
  assets?: OptionalToolSidebarAssetsDomain;
  workspace?: OptionalToolSidebarWorkspaceDomain;
}

export interface ToolRailProps {
  activePanel: ToolPanelType;
  onPanelChange: (panel: ToolPanelType) => void;
  user: User | null;
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
