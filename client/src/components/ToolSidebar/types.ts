import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import type { User, PromptHistoryEntry } from '@hooks/types';
import type { Asset, AssetType } from '@shared/types/asset';

export type ToolPanelType = 'sessions' | 'tool' | 'characters' | 'styles';

export type DraftModel = 'flux-kontext' | 'wan-2.2';

export interface StartImage {
  url: string;
  source: string;
  assetId?: string;
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
  aspectRatio: string;
  duration: number;
  selectedModel: string;
  onModelChange: (model: string) => void;
  onAspectRatioChange: (ratio: string) => void;
  onDurationChange: (duration: number) => void;
  onDraft: (model: DraftModel) => void;
  onRender: (model: string) => void;
  isDraftDisabled: boolean;
  isRenderDisabled: boolean;
  startImage?: StartImage | null;
  onImageUpload?: (file: File) => void | Promise<void>;
  onClearStartImage?: () => void;
  activeDraftModel?: string | null;

  // Characters panel
  assets: Asset[];
  assetsByType: Record<AssetType, Asset[]>;
  isLoadingAssets: boolean;
  onInsertTrigger: (trigger: string) => void;
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
  icon: LucideIcon;
  label: string;
  variant: 'header' | 'default';
}
